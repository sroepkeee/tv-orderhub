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
import { Info, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PhaseConfig {
  phase_key: string;
  display_name: string;
  responsible_role: string;
}

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
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { roles: availableRoles, loading: loadingRoles } = useAvailableRoles();

  useEffect(() => {
    setSelectedRoles(user.roles);
    loadPhases();
  }, [user.roles]);

  const loadPhases = async () => {
    try {
      const { data, error } = await supabase
        .from('phase_config')
        .select('phase_key, display_name, responsible_role')
        .order('order_index');
      
      if (error) throw error;
      setPhases(data || []);
    } catch (error) {
      console.error('Error loading phases:', error);
    }
  };

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

  const getPhasesByRole = (role: string) => {
    return phases.filter(p => p.responsible_role === role);
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

  // Group roles by area
  const rolesByArea = {
    'Operações': availableRoles.filter(r => ['almox_ssm', 'order_generation', 'almox_general', 'production', 'balance_generation', 'laboratory'].includes(r.value)),
    'Expedição': availableRoles.filter(r => ['packaging', 'logistics', 'in_transit'].includes(r.value)),
    'Comercial': availableRoles.filter(r => r.value === 'freight_quote'),
    'Financeiro': availableRoles.filter(r => ['ready_to_invoice', 'invoicing'].includes(r.value)),
    'Finalização': availableRoles.filter(r => r.value === 'completion'),
    'Administração': availableRoles.filter(r => r.value === 'admin'),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Roles de {user.full_name}</DialogTitle>
          <DialogDescription>
            Selecione as permissões de acesso para este usuário
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Alert de perfil incompleto + Botão de perfil completo */}
          <div className="flex items-start gap-4">
            {isProfileIncomplete ? (
              <Alert variant="default" className="flex-1 border-amber-500/50 bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  <span className="font-medium">Perfil Incompleto</span> — {selectedRoles.length}/{operationalRoles.length} roles atribuídas
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Faltam: {missingRoles.map(r => availableRoles.find(role => role.value === r)?.label || r).join(', ')}
                  </span>
                </AlertDescription>
              </Alert>
            ) : selectedRoles.length > 0 ? (
              <Alert variant="default" className="flex-1 border-green-500/50 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm">
                  <span className="font-medium">Perfil Completo</span> — {selectedRoles.length} roles atribuídas
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex-1" />
            )}
            
            <Button
              variant="outline"
              size="default"
              onClick={selectAllRoles}
              className="shrink-0"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Atribuir Todas
            </Button>
          </div>

          <Separator />

          {/* Roles organizadas por área */}
          {loadingRoles ? (
            <div className="text-sm text-muted-foreground">Carregando roles...</div>
          ) : (
            <TooltipProvider>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(rolesByArea).map(([area, roles]) => {
                  if (roles.length === 0) return null;
                  
                  return (
                    <Card key={area} className="border-muted">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold">{area}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {roles.map((role) => {
                          const rolePhases = getPhasesByRole(role.value);
                          const phaseNames = rolePhases.map(p => p.display_name).join(', ');
                          
                          return (
                            <Tooltip key={role.value}>
                              <TooltipTrigger asChild>
                                <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                                  <Checkbox
                                    id={role.value}
                                    checked={selectedRoles.includes(role.value)}
                                    onCheckedChange={() => toggleRole(role.value)}
                                  />
                                  <Label
                                    htmlFor={role.value}
                                    className="text-sm font-medium cursor-pointer flex-1"
                                  >
                                    {role.label}
                                  </Label>
                                </div>
                              </TooltipTrigger>
                              {phaseNames && (
                                <TooltipContent side="right" className="max-w-xs">
                                  <p className="text-xs"><strong>Fase(s):</strong> {phaseNames}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TooltipProvider>
          )}

          <Separator />

          {/* Resumo de fases com acesso */}
          {selectedRoles.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {selectedRoles.includes('admin') ? (
                  <div>
                    <div className="font-medium mb-1">Acesso Total (Admin)</div>
                    <p className="text-xs text-muted-foreground">
                      Administradores têm acesso completo a todas as fases e funcionalidades do sistema.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium mb-2">Fases com Acesso:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(new Set(selectedRoles.flatMap(role => getPhasesByRole(role)))).map(phase => (
                        <Badge key={phase.phase_key} variant="secondary" className="text-xs">
                          {phase.display_name}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      ⚠️ O usuário deve fazer logout e login novamente para ver as atualizações.
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
