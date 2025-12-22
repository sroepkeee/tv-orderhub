import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Users, UserCheck, Building, Clock, Bell } from "lucide-react";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface PhaseConfig {
  id: string;
  phase_key: string;
  display_name: string;
  order_index: number;
  responsible_role: string | null;
  organization_id: string | null;
  manager_user_id?: string | null;
  max_days_allowed?: number;
  warning_days?: number;
  stall_alerts_enabled?: boolean;
}

export interface UserByRole {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface OrgUser {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
}

interface EditPhaseDialogProps {
  phase: PhaseConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (phase: PhaseConfig) => void;
  usersByRole?: Record<string, UserByRole[]>;
}

export function EditPhaseDialog({ phase, open, onOpenChange, onSave, usersByRole = {} }: EditPhaseDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [responsibleRole, setResponsibleRole] = useState<string>("");
  const [managerUserId, setManagerUserId] = useState<string>("");
  const [maxDaysAllowed, setMaxDaysAllowed] = useState<number>(5);
  const [warningDays, setWarningDays] = useState<number>(3);
  const [stallAlertsEnabled, setStallAlertsEnabled] = useState<boolean>(true);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { organization } = useOrganization();

  useEffect(() => {
    if (phase) {
      setDisplayName(phase.display_name);
      setResponsibleRole(phase.responsible_role || "__none__");
      setManagerUserId(phase.manager_user_id || "__none__");
      setMaxDaysAllowed(phase.max_days_allowed ?? 5);
      setWarningDays(phase.warning_days ?? 3);
      setStallAlertsEnabled(phase.stall_alerts_enabled ?? true);
    }
  }, [phase]);

  useEffect(() => {
    if (open && organization?.id) {
      loadOrgUsers();
    }
  }, [open, organization?.id]);

  const loadOrgUsers = async () => {
    if (!organization?.id) return;

    try {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, department')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setOrgUsers(data || []);
    } catch (error) {
      console.error('Error loading org users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phase || !displayName.trim()) return;

    onSave({
      ...phase,
      display_name: displayName.trim(),
      responsible_role: responsibleRole === "__none__" ? null : responsibleRole || null,
      manager_user_id: managerUserId === "__none__" ? null : managerUserId || null,
      max_days_allowed: maxDaysAllowed,
      warning_days: warningDays,
      stall_alerts_enabled: stallAlertsEnabled,
    });
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return '?';
  };

  const availableRoles = Object.entries(ROLE_LABELS).filter(
    ([key]) => !['admin'].includes(key)
  );

  const currentRoleUsers = responsibleRole && responsibleRole !== "__none__" 
    ? usersByRole[responsibleRole] || [] 
    : [];

  const selectedManager = orgUsers.find(u => u.id === managerUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Fase</DialogTitle>
          <DialogDescription>
            Altere as configurações da fase "{phase?.phase_key}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editDisplayName">Nome da Fase</Label>
            <Input
              id="editDisplayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Verificação de Qualidade"
            />
          </div>

          <div className="space-y-2">
            <Label>Chave Única</Label>
            <Input
              value={phase?.phase_key || ""}
              disabled
              className="font-mono text-sm bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              A chave única não pode ser alterada após a criação.
            </p>
          </div>

          {/* Gestor Principal (Usuário) */}
          <div className="space-y-2">
            <Label htmlFor="managerUser" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Gestor Principal
            </Label>
            <Select value={managerUserId} onValueChange={setManagerUserId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingUsers ? "Carregando..." : "Selecione um gestor"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {orgUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <span>{user.full_name || user.email || 'Sem nome'}</span>
                      {user.department && (
                        <span className="text-xs text-muted-foreground">({user.department})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O gestor é o responsável principal por esta fase e receberá alertas.
            </p>
          </div>

          {/* Mostrar gestor selecionado */}
          {selectedManager && managerUserId !== "__none__" && (
            <div className="p-3 bg-primary/5 rounded-lg border">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {getInitials(selectedManager.full_name, selectedManager.email)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{selectedManager.full_name || selectedManager.email}</p>
                  {selectedManager.department && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {selectedManager.department}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Configuração de Tempo Máximo */}
          <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              <span>Controle de Tempo na Fase</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxDays" className="text-xs">
                  Tempo máximo (dias)
                </Label>
                <Input
                  id="maxDays"
                  type="number"
                  min={1}
                  max={90}
                  value={maxDaysAllowed}
                  onChange={(e) => setMaxDaysAllowed(parseInt(e.target.value) || 5)}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Alerta crítico após esse tempo
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="warningDays" className="text-xs">
                  Dias para aviso
                </Label>
                <Input
                  id="warningDays"
                  type="number"
                  min={1}
                  max={maxDaysAllowed - 1}
                  value={warningDays}
                  onChange={(e) => setWarningDays(parseInt(e.target.value) || 3)}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Aviso antes do limite
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="stallAlerts" className="flex items-center gap-2 text-sm cursor-pointer">
                <Bell className="h-4 w-4" />
                Alertas de estagnação habilitados
              </Label>
              <Switch
                id="stallAlerts"
                checked={stallAlertsEnabled}
                onCheckedChange={setStallAlertsEnabled}
              />
            </div>
          </div>

          {/* Role Responsável (para referência/fallback) */}
          <div className="space-y-2">
            <Label htmlFor="editResponsibleRole" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Role Responsável (Fallback)
            </Label>
            <Select value={responsibleRole} onValueChange={setResponsibleRole}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {availableRoles.map(([key, roleInfo]) => (
                  <SelectItem key={key} value={key}>
                    {roleInfo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Role usada como fallback quando não há gestor definido.
            </p>
          </div>

          {currentRoleUsers.length > 0 && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                <span>{currentRoleUsers.length} usuário{currentRoleUsers.length !== 1 ? 's' : ''} com esta função</span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {currentRoleUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-full text-xs">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[8px]">
                        {getInitials(user.full_name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[100px]">
                      {user.full_name || user.email || 'Sem nome'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!displayName.trim()}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
