import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Settings2, 
  Loader2,
  FileText,
  AlertTriangle,
  BarChart3,
  Timer,
  Layers,
  Users,
  User,
  Phone,
  Zap,
  Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NOTIFICATION_PHASE_OPTIONS } from "@/lib/notificationPhases";
import { useOrganizationId } from "@/hooks/useOrganizationId";

interface ReportSchedule {
  id: string;
  name: string;
  frequency: string;
  send_time: string;
  send_days: number[];
  is_active: boolean;
  include_charts: boolean;
  last_sent_at: string | null;
  template_id: string | null;
  recipient_type: string;
  customer_notification_phases: string[];
  report_type: string;
}

interface Manager {
  id: string;
  whatsapp: string;
  name: string;
  user_id: string;
}

const REPORT_TYPES = [
  { 
    id: 'full', 
    label: 'Relatório Completo', 
    icon: FileText, 
    description: 'Todas as métricas, gráficos e análise detalhada',
    color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30'
  },
  { 
    id: 'summary', 
    label: 'Resumo Rápido', 
    icon: Layers, 
    description: 'Contagem por fase e SLA geral',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/30'
  },
  { 
    id: 'urgent', 
    label: 'Pedidos Urgentes', 
    icon: AlertTriangle, 
    description: 'Pedidos com entrega hoje/amanhã e críticos',
    color: 'bg-red-500/10 text-red-600 border-red-500/30'
  },
  { 
    id: 'delayed', 
    label: 'Pedidos Atrasados', 
    icon: Timer, 
    description: 'Lista dos pedidos mais atrasados',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/30'
  },
  { 
    id: 'phase_summary', 
    label: 'Resumo por Fase', 
    icon: BarChart3, 
    description: 'Quantidade de pedidos em cada fase',
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/30'
  },
];

const DAYS_OF_WEEK = [
  { id: 0, label: 'Dom', short: 'D' },
  { id: 1, label: 'Seg', short: 'S' },
  { id: 2, label: 'Ter', short: 'T' },
  { id: 3, label: 'Qua', short: 'Q' },
  { id: 4, label: 'Qui', short: 'Q' },
  { id: 5, label: 'Sex', short: 'S' },
  { id: 6, label: 'Sáb', short: 'S' },
];

export function ReportScheduleManager() {
  const { organizationId } = useOrganizationId();
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Customer real-time notification config (from ai_agent_config)
  const [customerNotificationPhases, setCustomerNotificationPhases] = useState<string[]>([]);
  const [savingCustomerConfig, setSavingCustomerConfig] = useState(false);
  
  // Form state (only for manager schedules now)
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    frequency: 'daily',
    send_time: '08:00',
    send_days: [1, 2, 3, 4, 5, 6] as number[],
    include_charts: true,
    recipient_type: 'managers',
    customer_notification_phases: [] as string[],
    report_type: 'full',
  });

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*')
        .order('send_time', { ascending: true });

      if (error) throw error;
      
      // Map data with new fields, providing defaults for existing records
      const mappedData = (data || []).map(s => ({
        ...s,
        recipient_type: s.recipient_type || 'managers',
        customer_notification_phases: s.customer_notification_phases || [],
        report_type: s.report_type || 'full',
      }));
      
      setSchedules(mappedData);
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadManagers = async () => {
    try {
      const { data, error } = await supabase
        .from('management_report_recipients')
        .select('id, whatsapp, user_id, profiles(full_name)')
        .eq('is_active', true);

      if (error) throw error;
      
      const mappedManagers = (data || []).map((m: any) => ({
        id: m.id,
        whatsapp: m.whatsapp || '',
        name: m.profiles?.full_name || 'Gestor',
        user_id: m.user_id,
      }));
      
      setManagers(mappedManagers);
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  };

  const loadCustomerNotificationConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agent_config')
        .select('notification_phases')
        .eq('organization_id', organizationId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      setCustomerNotificationPhases(data?.notification_phases || []);
    } catch (error) {
      console.error('Error loading customer notification config:', error);
    }
  };

  const saveCustomerNotificationConfig = async (phases: string[]) => {
    setSavingCustomerConfig(true);
    try {
      const { error } = await supabase
        .from('ai_agent_config')
        .update({ notification_phases: phases })
        .eq('organization_id', organizationId);

      if (error) throw error;
      
      setCustomerNotificationPhases(phases);
      toast({
        title: "Fases de notificação atualizadas!",
        description: "Clientes serão notificados em tempo real nas fases selecionadas.",
      });
    } catch (error) {
      console.error('Error saving customer notification config:', error);
      toast({
        title: "Erro ao salvar configuração",
        variant: "destructive",
      });
    } finally {
      setSavingCustomerConfig(false);
    }
  };

  const toggleCustomerPhase = (phaseValue: string) => {
    const newPhases = customerNotificationPhases.includes(phaseValue)
      ? customerNotificationPhases.filter(p => p !== phaseValue)
      : [...customerNotificationPhases, phaseValue];
    
    saveCustomerNotificationConfig(newPhases);
  };

  useEffect(() => {
    loadSchedules();
    loadManagers();
    if (organizationId) {
      loadCustomerNotificationConfig();
    }
  }, [organizationId]);

  const toggleSchedule = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('report_schedules')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      
      setSchedules(prev => prev.map(s => 
        s.id === id ? { ...s, is_active: !isActive } : s
      ));
      
      toast({
        title: isActive ? "Agendamento desativado" : "Agendamento ativado",
      });
    } catch (error) {
      console.error('Error toggling schedule:', error);
      toast({
        title: "Erro ao atualizar",
        variant: "destructive",
      });
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('report_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setSchedules(prev => prev.filter(s => s.id !== id));
      
      toast({
        title: "Agendamento removido",
      });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Erro ao remover",
        variant: "destructive",
      });
    }
  };

  const addSchedule = async () => {
    if (!newSchedule.name.trim()) {
      toast({
        title: "Nome obrigatório",
        variant: "destructive",
      });
      return;
    }

    // Validate: Must have managers configured
    if (managers.length === 0) {
      toast({
        title: "Nenhum gestor ativo configurado",
        description: "Configure gestores em Administração > Relatórios Gerenciais",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('report_schedules')
        .insert({
          organization_id: organizationId,
          name: newSchedule.name,
          frequency: newSchedule.frequency,
          send_time: newSchedule.send_time,
          send_days: newSchedule.send_days,
          include_charts: newSchedule.include_charts,
          is_active: true,
          recipient_type: 'managers', // Always managers now
          customer_notification_phases: [], // Not used for managers
          report_type: newSchedule.report_type,
        });

      if (error) throw error;
      
      toast({
        title: "Agendamento criado!",
        description: "O relatório será enviado nos horários configurados.",
      });
      
      setShowAddDialog(false);
      setNewSchedule({
        name: '',
        frequency: 'daily',
        send_time: '08:00',
        send_days: [1, 2, 3, 4, 5, 6],
        include_charts: true,
        recipient_type: 'managers',
        customer_notification_phases: [],
        report_type: 'full',
      });
      
      loadSchedules();
    } catch (error) {
      console.error('Error adding schedule:', error);
      toast({
        title: "Erro ao criar agendamento",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (dayId: number) => {
    setNewSchedule(prev => ({
      ...prev,
      send_days: prev.send_days.includes(dayId)
        ? prev.send_days.filter(d => d !== dayId)
        : [...prev.send_days, dayId].sort()
    }));
  };

  const togglePhase = (phaseValue: string) => {
    setNewSchedule(prev => ({
      ...prev,
      customer_notification_phases: prev.customer_notification_phases.includes(phaseValue)
        ? prev.customer_notification_phases.filter(p => p !== phaseValue)
        : [...prev.customer_notification_phases, phaseValue]
    }));
  };

  const formatDays = (days: number[]) => {
    if (days.length === 7) return 'Todos os dias';
    if (days.length === 0) return 'Nenhum dia';
    if (JSON.stringify(days.sort()) === JSON.stringify([1, 2, 3, 4, 5])) return 'Seg-Sex';
    if (JSON.stringify(days.sort()) === JSON.stringify([1, 2, 3, 4, 5, 6])) return 'Seg-Sáb';
    return days.map(d => DAYS_OF_WEEK.find(day => day.id === d)?.short).join(', ');
  };

  const getReportTypeLabel = (type: string) => {
    return REPORT_TYPES.find(t => t.id === type)?.label || type;
  };

  const getPhaseLabels = (phases: string[]) => {
    return phases.map(p => NOTIFICATION_PHASE_OPTIONS.find(o => o.value === p)?.label || p).join(', ');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Manager Scheduled Reports Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-blue-600" />
                Relatórios para Gestores
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 ml-2">
                  Agendado
                </Badge>
              </CardTitle>
              <CardDescription>
                Configure horários e dias para envio automático de relatórios gerenciais
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Manager info */}
          <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Gestores ativos para receber relatórios:</span>
            </div>
            <Badge 
              variant="outline" 
              className={managers.length > 0 
                ? "bg-green-500/10 text-green-600 border-green-500/30" 
                : "bg-amber-500/10 text-amber-600 border-amber-500/30"
              }
            >
              {managers.length} gestor(es)
            </Badge>
          </div>

          {schedules.filter(s => s.recipient_type === 'managers').length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum agendamento configurado</p>
              <p className="text-sm">Clique em "Novo Agendamento" para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.filter(s => s.recipient_type === 'managers').map((schedule) => (
                <div 
                  key={schedule.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    schedule.is_active 
                      ? 'bg-background border-border' 
                      : 'bg-muted/30 border-muted'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={schedule.is_active}
                      onCheckedChange={() => toggleSchedule(schedule.id, schedule.is_active)}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${!schedule.is_active ? 'text-muted-foreground' : ''}`}>
                          {schedule.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{schedule.send_time}</span>
                        <span>•</span>
                        <Calendar className="h-3 w-3" />
                        <span>{formatDays(schedule.send_days || [])}</span>
                        <span>•</span>
                        <Badge variant="secondary" className="text-xs">
                          {getReportTypeLabel(schedule.report_type)}
                        </Badge>
                        {schedule.include_charts && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                              Com gráficos
                            </Badge>
                          </>
                        )}
                      </div>
                      {schedule.last_sent_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Último envio: {format(new Date(schedule.last_sent_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => deleteSchedule(schedule.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Manager Schedule Dialog - Simplified for managers only */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Novo Agendamento para Gestores
            </DialogTitle>
            <DialogDescription>
              Configure quando os relatórios gerenciais serão enviados automaticamente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Agendamento</Label>
              <Input
                id="name"
                placeholder="Ex: Relatório Matinal"
                value={newSchedule.name}
                onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
              />
            </div>

            {/* Opções para Gestores */}
            <div className="space-y-4 p-4 rounded-lg border bg-blue-500/5 border-blue-500/20">
              <div className="flex items-center justify-between">
                <Label className="text-blue-600 font-medium">Tipo de Relatório</Label>
                <Badge 
                  variant="outline" 
                  className={managers.length > 0 
                    ? "bg-green-500/10 text-green-600 border-green-500/30" 
                    : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  }
                >
                  <Users className="h-3 w-3 mr-1" />
                  {managers.length} gestor(es) ativo(s)
                </Badge>
              </div>
              
              {/* Lista de gestores ativos */}
              {managers.length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {managers.map((manager) => (
                    <div 
                      key={manager.id}
                      className="flex items-center justify-between p-2 rounded bg-background border text-sm"
                    >
                      <span className="font-medium">{manager.name}</span>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="text-xs">{formatPhone(manager.whatsapp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert className="bg-amber-500/10 border-amber-500/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-600 text-sm">
                    Nenhum gestor configurado. Vá em Administração &gt; Relatórios Gerenciais para adicionar gestores.
                  </AlertDescription>
                </Alert>
              )}

              <Select 
                value={newSchedule.report_type} 
                onValueChange={(v) => setNewSchedule({ ...newSchedule, report_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {REPORT_TYPES.find(t => t.id === newSchedule.report_type)?.description}
              </p>

              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="include_charts">Incluir gráficos</Label>
                <Switch
                  id="include_charts"
                  checked={newSchedule.include_charts}
                  onCheckedChange={(v) => setNewSchedule({ ...newSchedule, include_charts: v })}
                />
              </div>
            </div>

            {/* Horário e Frequência */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={newSchedule.send_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, send_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select 
                  value={newSchedule.frequency} 
                  onValueChange={(v) => setNewSchedule({ ...newSchedule, frequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dias da Semana */}
            <div className="space-y-2">
              <Label>Dias da Semana</Label>
              <div className="flex gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.id}
                    type="button"
                    variant={newSchedule.send_days.includes(day.id) ? "default" : "outline"}
                    size="sm"
                    className="w-10 h-10 p-0"
                    onClick={() => toggleDay(day.id)}
                  >
                    {day.short}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={addSchedule} disabled={saving || managers.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
