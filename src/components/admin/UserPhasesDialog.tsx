import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Crown, Bell, AlertTriangle, Calendar, Plus, Trash2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganizationId } from "@/hooks/useOrganizationId";

interface PhaseManager {
  id: string;
  phase_key: string;
  is_active: boolean;
  receive_new_orders: boolean;
  receive_urgent_alerts: boolean;
  receive_daily_summary: boolean;
}

interface PhaseConfig {
  phase_key: string;
  display_name: string;
  manager_user_id?: string | null;
}

interface UserPhasesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userWhatsapp: string | null;
  onSuccess: () => void;
}

export const UserPhasesDialog = ({
  open,
  onOpenChange,
  userId,
  userName,
  userWhatsapp,
  onSuccess,
}: UserPhasesDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userPhases, setUserPhases] = useState<PhaseManager[]>([]);
  const [allPhases, setAllPhases] = useState<PhaseConfig[]>([]);
  const [selectedPhaseToAdd, setSelectedPhaseToAdd] = useState<string>("");
  const { toast } = useToast();
  const { organizationId } = useOrganizationId();

  useEffect(() => {
    if (open && userId) {
      loadData();
    }
  }, [open, userId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar todas as fases configuradas
      const { data: phases, error: phasesError } = await supabase
        .from('phase_config')
        .select('phase_key, display_name, manager_user_id')
        .order('order_index');

      if (phasesError) throw phasesError;
      setAllPhases((phases || []) as PhaseConfig[]);

      // Buscar fases do usuário
      const { data: managers, error: managersError } = await supabase
        .from('phase_managers')
        .select('id, phase_key, is_active, receive_new_orders, receive_urgent_alerts, receive_daily_summary')
        .eq('user_id', userId);

      if (managersError) throw managersError;
      setUserPhases(managers || []);
    } catch (error) {
      console.error('Error loading phases:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as fases",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhase = async () => {
    if (!selectedPhaseToAdd || !organizationId) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('phase_managers')
        .insert([{
          user_id: userId,
          phase_key: selectedPhaseToAdd,
          whatsapp: userWhatsapp || '',
          organization_id: organizationId,
          is_active: true,
          receive_new_orders: true,
          receive_urgent_alerts: true,
          receive_daily_summary: false,
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Fase adicionada ao usuário",
      });
      setSelectedPhaseToAdd("");
      loadData();
      onSuccess();
    } catch (error) {
      console.error('Error adding phase:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a fase",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhase = async (phaseManagerId: string) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('phase_managers')
        .delete()
        .eq('id', phaseManagerId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Fase removida do usuário",
      });
      loadData();
      onSuccess();
    } catch (error) {
      console.error('Error removing phase:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a fase",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePreference = async (
    phaseManagerId: string,
    field: 'is_active' | 'receive_new_orders' | 'receive_urgent_alerts' | 'receive_daily_summary',
    value: boolean
  ) => {
    try {
      const { error } = await supabase
        .from('phase_managers')
        .update({ [field]: value })
        .eq('id', phaseManagerId);

      if (error) throw error;

      setUserPhases(prev =>
        prev.map(pm =>
          pm.id === phaseManagerId ? { ...pm, [field]: value } : pm
        )
      );
    } catch (error) {
      console.error('Error updating preference:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar preferência",
        variant: "destructive",
      });
    }
  };

  const getPhaseDisplayName = (phaseKey: string) => {
    return allPhases.find(p => p.phase_key === phaseKey)?.display_name || phaseKey;
  };

  const isPrimaryManager = (phaseKey: string) => {
    const phase = allPhases.find(p => p.phase_key === phaseKey);
    return phase?.manager_user_id === userId;
  };

  const availablePhases = allPhases.filter(
    phase => !userPhases.some(up => up.phase_key === phase.phase_key)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Fases de {userName}
          </DialogTitle>
          <DialogDescription>
            Configure as fases que este usuário gerencia e suas preferências de notificação
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Adicionar nova fase */}
            {availablePhases.length > 0 && (
              <div className="flex gap-2 items-end p-4 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <Label className="text-sm mb-2 block">Adicionar fase</Label>
                  <Select value={selectedPhaseToAdd} onValueChange={setSelectedPhaseToAdd}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma fase..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePhases.map(phase => (
                        <SelectItem key={phase.phase_key} value={phase.phase_key}>
                          {phase.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddPhase}
                  disabled={!selectedPhaseToAdd || saving}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            )}

            {/* Lista de fases do usuário */}
            {userPhases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Este usuário não gerencia nenhuma fase
              </div>
            ) : (
              <div className="space-y-3">
                {userPhases.map(phase => (
                  <div
                    key={phase.id}
                    className={`border rounded-lg p-4 ${
                      phase.is_active ? 'bg-background' : 'bg-muted/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-medium">
                          {isPrimaryManager(phase.phase_key) && (
                            <Crown className="h-3 w-3 mr-1 text-amber-500" />
                          )}
                          {getPhaseDisplayName(phase.phase_key)}
                        </Badge>
                        {isPrimaryManager(phase.phase_key) && (
                          <span className="text-xs text-amber-600">Gestor Principal</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={phase.is_active}
                            onCheckedChange={(v) => handleTogglePreference(phase.id, 'is_active', v)}
                          />
                          <span className="text-sm text-muted-foreground">Ativo</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePhase(phase.id)}
                          disabled={saving}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`new-${phase.id}`}
                          checked={phase.receive_new_orders}
                          onCheckedChange={(v) => handleTogglePreference(phase.id, 'receive_new_orders', v)}
                        />
                        <Label htmlFor={`new-${phase.id}`} className="flex items-center gap-1 text-sm cursor-pointer">
                          <Bell className="h-3.5 w-3.5 text-blue-500" />
                          Novas Ordens
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`urgent-${phase.id}`}
                          checked={phase.receive_urgent_alerts}
                          onCheckedChange={(v) => handleTogglePreference(phase.id, 'receive_urgent_alerts', v)}
                        />
                        <Label htmlFor={`urgent-${phase.id}`} className="flex items-center gap-1 text-sm cursor-pointer">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          Alertas Urgentes
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`daily-${phase.id}`}
                          checked={phase.receive_daily_summary}
                          onCheckedChange={(v) => handleTogglePreference(phase.id, 'receive_daily_summary', v)}
                        />
                        <Label htmlFor={`daily-${phase.id}`} className="flex items-center gap-1 text-sm cursor-pointer">
                          <Calendar className="h-3.5 w-3.5 text-green-500" />
                          Resumo Diário
                        </Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!userWhatsapp && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Este usuário não possui WhatsApp configurado. Configure na aba de usuários para receber notificações.
                </span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
