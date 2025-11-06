import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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

const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'almox_ssm', label: 'Almox SSM' },
  { value: 'almox_geral', label: 'Almox Geral' },
  { value: 'planejamento', label: 'Planejamento' },
  { value: 'producao', label: 'Produção' },
  { value: 'laboratorio', label: 'Laboratório' },
  { value: 'logistica', label: 'Logística' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'faturamento', label: 'Faturamento' },
];

export const UserRolesDialog = ({ open, onOpenChange, user, onSuccess }: UserRolesDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

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
      }

      toast({
        title: "Roles atualizadas",
        description: `Roles de ${user.full_name} foram atualizadas com sucesso`,
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Roles</DialogTitle>
          <DialogDescription>
            Selecione as roles de {user.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">Roles atuais:</p>
            <div className="flex gap-2 flex-wrap">
              {user.roles.length > 0 ? (
                user.roles.map(role => (
                  <Badge key={role} variant="secondary">
                    {AVAILABLE_ROLES.find(r => r.value === role)?.label || role}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Nenhuma role atribuída</span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {AVAILABLE_ROLES.map((role) => (
              <div key={role.value} className="flex items-center space-x-2">
                <Checkbox
                  id={role.value}
                  checked={selectedRoles.includes(role.value)}
                  onCheckedChange={() => toggleRole(role.value)}
                />
                <Label
                  htmlFor={role.value}
                  className="text-sm font-normal cursor-pointer"
                >
                  {role.label}
                </Label>
              </div>
            ))}
          </div>
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
