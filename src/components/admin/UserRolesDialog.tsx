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
import { ROLE_PHASE_MAPPING } from "@/lib/rolePhaseMapping";
import { Info, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  // Roles operacionais (todos exceto admin)
  const operationalRoles = availableRoles.filter(r => r.value !== 'admin').map(r => r.value);
  
  // Verificar se o perfil está incompleto
  const missingRoles = operationalRoles.filter(r => !selectedRoles.includes(r));
  const isProfileIncomplete = missingRoles.length > 0 && missingRoles.length <= 3 && selectedRoles.length > 0;
  
  const toggleRole = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const selectAllRoles = () => {
    setSelectedRoles(operationalRoles);
  };

  // Tooltips para roles importantes
  const roleTooltips: Record<string, string> = {
    'completion': 'Permite visualizar e gerenciar pedidos finalizados (entregues, cancelados, concluídos)',
    'laboratory': 'Acesso ao laboratório para instalação de firmware e imagens',
    'freight_quote': 'Cotação e seleção de transportadoras',
    'invoicing': 'Faturamento e preparação de notas fiscais',
    'logistics': 'Expedição e gestão de envios',
    'admin': 'Acesso total ao sistema, incluindo gerenciamento de usuários'
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
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
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
              
              {isProfileIncomplete && (
                <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs">
                    <span className="font-medium">Perfil Incompleto</span> ({selectedRoles.length}/{operationalRoles.length} roles)
                    <br />
                    Faltam: {missingRoles.map(r => {
                      const label = availableRoles.find(role => role.value === r);
                      return label?.label || r;
                    }).join(', ')}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllRoles}
              className="shrink-0"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Perfil Completo
            </Button>
          </div>

          {loadingRoles ? (
            <div className="text-sm text-muted-foreground">Carregando roles...</div>
          ) : (
            <TooltipProvider>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {availableRoles.map((role) => {
                  const hasTooltip = roleTooltips[role.value];
                  const checkboxElement = (
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
                        {hasTooltip && (
                          <Info className="inline h-3 w-3 ml-1 text-muted-foreground" />
                        )}
                      </Label>
                    </div>
                  );

                  return hasTooltip ? (
                    <Tooltip key={role.value}>
                      <TooltipTrigger asChild>
                        {checkboxElement}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">{roleTooltips[role.value]}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    checkboxElement
                  );
                })}
              </div>
            </TooltipProvider>
          )}

          {selectedRoles.length > 0 && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <div className="font-medium mb-2">Fases Visíveis no Kanban:</div>
                {selectedRoles.includes('admin') ? (
                  <div>
                    <Badge variant="default" className="text-xs mb-2">
                      Todas as Fases (Admin)
                    </Badge>
                    <p className="text-muted-foreground">
                      Administradores têm acesso total para visualizar, editar e deletar em todas as fases do sistema.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedRoles.filter(r => r !== 'admin').map(role => {
                      const roleLabel = ROLE_LABELS[role];
                      const roleMapping = ROLE_PHASE_MAPPING[role];
                      const rolePhases = roleMapping?.phases || [];
                      
                      return (
                        <div key={role} className="border-l-2 border-primary/30 pl-2">
                          <div className="font-medium text-xs mb-1">
                            ✅ {roleLabel?.name || role}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {rolePhases.map((phase: string) => {
                              const phaseLabel = ROLE_LABELS[phase];
                              return phaseLabel ? (
                                <Badge key={phase} variant="outline" className="text-xs">
                                  → {phaseLabel.name}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-muted-foreground pt-2">
                      ⚠️ Importante: O usuário deve fazer logout/login para ver as atualizações.
                    </p>
                  </div>
                )}
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
