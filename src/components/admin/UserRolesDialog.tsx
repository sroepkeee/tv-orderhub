import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAvailableRoles } from "@/hooks/useAvailableRoles";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UserRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string;
    roles: string[];
  };
  onSuccess: () => void;
}

export const UserRolesDialog = ({ open, onOpenChange, user, onSuccess }: UserRolesDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { roles: availableRoles, loading: loadingRoles } = useAvailableRoles();

  useEffect(() => {
    setSelectedRoles(user.roles);
  }, [user.roles]);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleSubmit = async () => {
    if (selectedRoles.length === 0) {
      toast({
        title: "Role obrigatória",
        description: "Usuário deve ter pelo menos uma role",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Remover todas as roles antigas
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Adicionar novas roles
      const rolesToInsert = selectedRoles.map(role => ({
        user_id: user.id,
        role: role as any,
      }));

      const { error: insertError } = await supabase
        .from('user_roles')
        .insert(rolesToInsert);

      if (insertError) throw insertError;

      // Registrar no audit log
      const rolesAdded = selectedRoles.filter(r => !user.roles.includes(r));
      const rolesRemoved = user.roles.filter(r => !selectedRoles.includes(r));

      if (rolesAdded.length > 0 || rolesRemoved.length > 0) {
        // Log no permission_audit_log
        const { error: logError } = await supabase
          .from('permission_audit_log')
          .insert({
            action_type: 'role_granted',
            performed_by: currentUser?.id,
            target_user_id: user.id,
            details: {
              user_name: user.full_name,
              roles_added: rolesAdded,
              roles_removed: rolesRemoved,
            },
          });

        if (logError) throw logError;

        // Log no user_activity_log
        const description = rolesAdded.length > 0 && rolesRemoved.length > 0
          ? `Atualizou roles do usuário ${user.full_name}`
          : rolesAdded.length > 0
          ? `Concedeu roles ${rolesAdded.join(', ')} para ${user.full_name}`
          : `Removeu roles ${rolesRemoved.join(', ')} de ${user.full_name}`;

        await supabase.from('user_activity_log').insert({
          user_id: currentUser?.id,
          action_type: 'update',
          table_name: 'user_roles',
          record_id: user.id,
          description,
          metadata: {
            target_user: user.full_name,
            roles_added: rolesAdded,
            roles_removed: rolesRemoved,
          }
        });
      }

      toast({
        title: "Roles atualizadas com sucesso",
        description: `As permissões de ${user.full_name} foram atualizadas. O usuário deve atualizar a página para ver as mudanças.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating roles:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar as roles do usuário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Roles</DialogTitle>
          <DialogDescription>
            Selecione as roles de {user.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {user.roles.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1.5">Roles atuais:</p>
              <div className="flex gap-1.5 flex-wrap">
                {user.roles.map(role => {
                  const roleLabel = availableRoles.find(r => r.value === role);
                  return (
                    <Badge key={role} variant="secondary" className="text-xs">
                      {roleLabel?.label || role}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {loadingRoles ? (
            <div className="text-sm text-muted-foreground">Carregando roles...</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {availableRoles.map((role) => (
                <div key={role.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={role.value}
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => toggleRole(role.value)}
                  />
                  <Label
                    htmlFor={role.value}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {role.label}
                  </Label>
                </div>
              ))}
            </div>
          )}

          {selectedRoles.length > 0 && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <div className="font-medium mb-1">Permissões de Visualização:</div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedRoles
                    .filter(role => role !== 'admin')
                    .map(role => {
                      const roleLabel = ROLE_LABELS[role];
                      return roleLabel ? (
                        <Badge key={role} variant="outline" className="text-xs">
                          {roleLabel.name}
                        </Badge>
                      ) : null;
                    })}
                  {selectedRoles.includes('admin') && (
                    <Badge variant="default" className="text-xs">
                      Todas as Fases (Admin)
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground">
                  {selectedRoles.includes('admin') 
                    ? 'Administradores têm acesso total a todas as fases do sistema.'
                    : 'Cada role permite visualizar e editar apenas sua fase correspondente, mais visualização de fases anteriores para contexto.'
                  }
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
