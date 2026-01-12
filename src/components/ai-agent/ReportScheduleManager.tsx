import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Layers
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    frequency: 'daily',
    send_time: '08:00',
    send_days: [1, 2, 3, 4, 5, 6] as number[],
    include_charts: true,
  });

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*')
        .order('send_time', { ascending: true });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

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

    setSaving(true);
    try {
      const { error } = await supabase
        .from('report_schedules')
        .insert({
          name: newSchedule.name,
          frequency: newSchedule.frequency,
          send_time: newSchedule.send_time,
          send_days: newSchedule.send_days,
          include_charts: newSchedule.include_charts,
          is_active: true,
        });

      if (error) throw error;
      
      toast({
        title: "Agendamento criado!",
      });
      
      setShowAddDialog(false);
      setNewSchedule({
        name: '',
        frequency: 'daily',
        send_time: '08:00',
        send_days: [1, 2, 3, 4, 5, 6],
        include_charts: true,
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

  const formatDays = (days: number[]) => {
    if (days.length === 7) return 'Todos os dias';
    if (days.length === 0) return 'Nenhum dia';
    if (JSON.stringify(days.sort()) === JSON.stringify([1, 2, 3, 4, 5])) return 'Seg-Sex';
    if (JSON.stringify(days.sort()) === JSON.stringify([1, 2, 3, 4, 5, 6])) return 'Seg-Sáb';
    return days.map(d => DAYS_OF_WEEK.find(day => day.id === d)?.short).join(', ');
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Agendamentos Configurados
              </CardTitle>
              <CardDescription>
                Configure horários e dias para envio automático de relatórios
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum agendamento configurado</p>
              <p className="text-sm">Clique em "Novo Agendamento" para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
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
                      <p className={`font-medium ${!schedule.is_active ? 'text-muted-foreground' : ''}`}>
                        {schedule.name}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{schedule.send_time}</span>
                        <span>•</span>
                        <Calendar className="h-3 w-3" />
                        <span>{formatDays(schedule.send_days || [])}</span>
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

      {/* Add Schedule Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Agendamento de Relatório</DialogTitle>
            <DialogDescription>
              Configure quando o relatório será enviado automaticamente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Agendamento</Label>
              <Input
                id="name"
                placeholder="Ex: Relatório Matinal"
                value={newSchedule.name}
                onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
              />
            </div>

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

            <div className="flex items-center justify-between">
              <Label htmlFor="include_charts">Incluir gráficos</Label>
              <Switch
                id="include_charts"
                checked={newSchedule.include_charts}
                onCheckedChange={(v) => setNewSchedule({ ...newSchedule, include_charts: v })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={addSchedule} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
