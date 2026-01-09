import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

// Get organization ID string from hook
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Save,
  Loader2,
  RefreshCw,
  Zap,
  AlertTriangle,
} from "lucide-react";

// Types
interface ManagerTriggerConfig {
  id: string;
  organization_id: string | null;
  trigger_name: string;
  trigger_type: string;
  trigger_status: string[];
  is_active: boolean;
  include_order_number: boolean;
  include_customer_name: boolean;
  include_item_count: boolean;
  include_total_value: boolean;
  include_status: boolean;
  include_delivery_date: boolean;
  include_days_until_delivery: boolean;
  include_phase_info: boolean;
  include_item_list: boolean;
  include_priority: boolean;
  filter_purchase_items: boolean;
  channels: string[];
  priority: number;
  delay_minutes: number;
  custom_template: string | null;
  created_at: string;
  updated_at: string;
}

// Status options grouped by phase
const STATUS_OPTIONS = {
  compras: [
    { value: 'purchase_pending', label: 'Aguardando Compra' },
    { value: 'purchase_required', label: 'Compra Necessária' },
    { value: 'awaiting_material', label: 'Aguardando Material' },
  ],
  producao: [
    { value: 'separation_started', label: 'Separação Iniciada' },
    { value: 'in_production', label: 'Em Produção' },
    { value: 'separation_completed', label: 'Separação Concluída' },
    { value: 'production_completed', label: 'Produção Concluída' },
  ],
  laboratorio: [
    { value: 'awaiting_lab', label: 'Aguardando Lab' },
    { value: 'in_lab_analysis', label: 'Em Análise' },
    { value: 'lab_completed', label: 'Lab Concluído' },
  ],
  frete: [
    { value: 'freight_quote_requested', label: 'Cotação Solicitada' },
    { value: 'freight_quote_received', label: 'Cotação Recebida' },
    { value: 'freight_approved', label: 'Frete Aprovado' },
  ],
  expedicao: [
    { value: 'released_for_shipping', label: 'Liberado p/ Expedição' },
    { value: 'in_expedition', label: 'Em Expedição' },
    { value: 'pickup_scheduled', label: 'Coleta Agendada' },
    { value: 'awaiting_pickup', label: 'Aguardando Coleta' },
  ],
  faturamento: [
    { value: 'ready_to_invoice', label: 'Pronto p/ Faturar' },
    { value: 'invoiced', label: 'Faturado' },
  ],
};

const TRIGGER_TYPES = [
  { value: 'status_change', label: 'Mudança de Status' },
  { value: 'new_order', label: 'Novo Pedido' },
  { value: 'sla_alert', label: 'Alerta de SLA' },
  { value: 'urgent_alert', label: 'Alerta Urgente' },
];

const FIELD_OPTIONS = [
  { key: 'include_order_number', label: 'Número do Pedido', emoji: '📦' },
  { key: 'include_customer_name', label: 'Nome do Cliente', emoji: '👤' },
  { key: 'include_item_count', label: 'Quantidade de Itens', emoji: '📊' },
  { key: 'include_total_value', label: 'Valor Total', emoji: '💰' },
  { key: 'include_status', label: 'Status Atual', emoji: '🏷️' },
  { key: 'include_delivery_date', label: 'Data de Entrega', emoji: '📅' },
  { key: 'include_days_until_delivery', label: 'Dias até Entrega', emoji: '⏱️' },
  { key: 'include_phase_info', label: 'Informação da Fase', emoji: '📍' },
  { key: 'include_item_list', label: 'Lista de Itens', emoji: '📋' },
  { key: 'include_priority', label: 'Prioridade', emoji: '⚡' },
];

const STATUS_LABELS: Record<string, string> = {
  purchase_pending: 'Aguardando Compra',
  purchase_required: 'Compra Necessária',
  awaiting_material: 'Aguardando Material',
  separation_started: 'Separação Iniciada',
  in_production: 'Em Produção',
  separation_completed: 'Separação Concluída',
  production_completed: 'Produção Concluída',
  awaiting_lab: 'Aguardando Lab',
  in_lab_analysis: 'Em Análise Lab',
  lab_completed: 'Lab Concluído',
  freight_quote_requested: 'Cotação Solicitada',
  freight_quote_received: 'Cotação Recebida',
  freight_approved: 'Frete Aprovado',
  released_for_shipping: 'Liberado p/ Expedição',
  in_expedition: 'Em Expedição',
  pickup_scheduled: 'Coleta Agendada',
  awaiting_pickup: 'Aguardando Coleta',
  ready_to_invoice: 'Pronto p/ Faturar',
  invoiced: 'Faturado',
};

// Default trigger for new ones
const DEFAULT_TRIGGER: Partial<ManagerTriggerConfig> = {
  trigger_name: '',
  trigger_type: 'status_change',
  trigger_status: [],
  is_active: true,
  include_order_number: true,
  include_customer_name: true,
  include_item_count: true,
  include_total_value: true,
  include_status: true,
  include_delivery_date: false,
  include_days_until_delivery: false,
  include_phase_info: false,
  include_item_list: false,
  include_priority: false,
  filter_purchase_items: false,
  channels: ['whatsapp'],
  priority: 5,
  delay_minutes: 0,
  custom_template: null,
};

export function AIAgentManagerTriggersTab() {
  const { organizationId } = useOrganizationId();
  const [triggers, setTriggers] = useState<ManagerTriggerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<Partial<ManagerTriggerConfig> | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTrigger, setPreviewTrigger] = useState<ManagerTriggerConfig | null>(null);

  // Load triggers
  const loadTriggers = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_manager_trigger_config')
        .select('*')
        .eq('organization_id', organizationId)
        .order('priority', { ascending: true });

      if (error) throw error;
      setTriggers(data || []);
    } catch (error) {
      console.error('Error loading triggers:', error);
      toast.error('Erro ao carregar gatilhos');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);

  // Create default triggers if none exist
  const createDefaultTriggers = async () => {
    if (!organizationId) return;
    
    const defaults = [
      {
        ...DEFAULT_TRIGGER,
        organization_id: organizationId,
        trigger_name: 'Novo Pedido',
        trigger_type: 'new_order',
        trigger_status: ['pending', 'received'],
        include_delivery_date: true,
      },
      {
        ...DEFAULT_TRIGGER,
        organization_id: organizationId,
        trigger_name: 'Em Produção',
        trigger_type: 'status_change',
        trigger_status: ['in_production', 'separation_started'],
        include_delivery_date: true,
        include_days_until_delivery: true,
      },
      {
        ...DEFAULT_TRIGGER,
        organization_id: organizationId,
        trigger_name: 'Aguardando Compra',
        trigger_type: 'status_change',
        trigger_status: ['purchase_pending', 'purchase_required', 'awaiting_material'],
      },
      {
        ...DEFAULT_TRIGGER,
        organization_id: organizationId,
        trigger_name: 'Pronto para Faturar',
        trigger_type: 'status_change',
        trigger_status: ['ready_to_invoice'],
        include_delivery_date: true,
      },
      {
        ...DEFAULT_TRIGGER,
        organization_id: organizationId,
        trigger_name: 'Em Expedição',
        trigger_type: 'status_change',
        trigger_status: ['released_for_shipping', 'in_expedition'],
        include_delivery_date: true,
        include_days_until_delivery: true,
      },
    ];

    try {
      const { error } = await supabase
        .from('ai_manager_trigger_config')
        .insert(defaults);

      if (error) throw error;
      toast.success('Gatilhos padrão criados');
      loadTriggers();
    } catch (error) {
      console.error('Error creating default triggers:', error);
      toast.error('Erro ao criar gatilhos padrão');
    }
  };

  // Save trigger
  const saveTrigger = async () => {
    if (!editingTrigger || !organizationId) return;
    
    setSaving(true);
    try {
      const triggerData = {
        trigger_name: editingTrigger.trigger_name,
        trigger_type: editingTrigger.trigger_type,
        trigger_status: editingTrigger.trigger_status,
        is_active: editingTrigger.is_active,
        include_order_number: editingTrigger.include_order_number,
        include_customer_name: editingTrigger.include_customer_name,
        include_item_count: editingTrigger.include_item_count,
        include_total_value: editingTrigger.include_total_value,
        include_status: editingTrigger.include_status,
        include_delivery_date: editingTrigger.include_delivery_date,
        include_days_until_delivery: editingTrigger.include_days_until_delivery,
        include_phase_info: editingTrigger.include_phase_info,
        include_item_list: editingTrigger.include_item_list,
        include_priority: editingTrigger.include_priority,
        filter_purchase_items: editingTrigger.filter_purchase_items,
        channels: editingTrigger.channels,
        priority: editingTrigger.priority,
        delay_minutes: editingTrigger.delay_minutes,
        custom_template: editingTrigger.custom_template,
        organization_id: organizationId,
      };

      if (editingTrigger.id) {
        // Update
        const { error } = await supabase
          .from('ai_manager_trigger_config')
          .update(triggerData)
          .eq('id', editingTrigger.id);

        if (error) throw error;
        toast.success('Gatilho atualizado');
      } else {
        // Insert
        const { error } = await supabase
          .from('ai_manager_trigger_config')
          .insert([triggerData]);

        if (error) throw error;
        toast.success('Gatilho criado');
      }

      setDialogOpen(false);
      setEditingTrigger(null);
      loadTriggers();
    } catch (error) {
      console.error('Error saving trigger:', error);
      toast.error('Erro ao salvar gatilho');
    } finally {
      setSaving(false);
    }
  };

  // Delete trigger
  const deleteTrigger = async (id: string) => {
    if (!confirm('Deseja excluir este gatilho?')) return;
    
    try {
      const { error } = await supabase
        .from('ai_manager_trigger_config')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Gatilho excluído');
      loadTriggers();
    } catch (error) {
      console.error('Error deleting trigger:', error);
      toast.error('Erro ao excluir gatilho');
    }
  };

  // Toggle trigger active
  const toggleTriggerActive = async (trigger: ManagerTriggerConfig) => {
    try {
      const { error } = await supabase
        .from('ai_manager_trigger_config')
        .update({ is_active: !trigger.is_active })
        .eq('id', trigger.id);

      if (error) throw error;
      setTriggers(triggers.map(t => 
        t.id === trigger.id ? { ...t, is_active: !t.is_active } : t
      ));
    } catch (error) {
      console.error('Error toggling trigger:', error);
      toast.error('Erro ao atualizar gatilho');
    }
  };

  // Generate preview message
  const generatePreviewMessage = (trigger: Partial<ManagerTriggerConfig>): string => {
    let message = `📋 *${trigger.trigger_name?.toUpperCase() || 'NOTIFICAÇÃO'}*\n━━━━━━━━━━━━━━━━━━\n`;
    
    if (trigger.include_order_number) message += '📦 Pedido: #140037\n';
    if (trigger.include_customer_name) message += '👤 Cliente: Empresa Exemplo LTDA\n';
    if (trigger.include_item_count) message += '📊 Itens: 5\n';
    if (trigger.include_total_value) message += '💰 Valor: R$ 15.450,00\n';
    if (trigger.include_status) message += '🏷️ Status: Em Produção\n';
    if (trigger.include_delivery_date) message += '📅 Entrega: 15/01/2026\n';
    if (trigger.include_days_until_delivery) message += '⏱️ Prazo: 6 dias\n';
    if (trigger.include_phase_info) message += '📍 Fase: Produção Cliente\n';
    if (trigger.include_priority) message += '⚡ Prioridade: Alta\n';
    if (trigger.include_item_list) {
      if (trigger.filter_purchase_items) {
        message += '\n🛒 *Itens para Compra (3):*\n';
        message += '• MOTOR-5HP: 2 un\n';
        message += '  Motor elétrico 5HP trifás...\n';
        message += '• REDUTOR-40: 1 un\n';
        message += '  Redutor de velocidade 40:1...\n';
        message += '• ROLAMENTO-6205: 8 un\n';
        message += '  Rolamento 6205-2RS blind...\n';
      } else {
        message += '\n📋 *Itens (5):*\n';
        message += '• PROD001: 2 un\n';
        message += '  Produto Exemplo 1...\n';
        message += '• PROD002: 1 un\n';
        message += '  Produto Exemplo 2...\n';
        message += '_...e mais 3 itens_\n';
      }
    }
    
    message += '\n💬 Responda "ver 140037" para detalhes';
    
    return message;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Gatilhos Gerenciais</h3>
          <p className="text-sm text-muted-foreground">
            Configure quais eventos disparam notificações para os gestores e quais informações são enviadas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadTriggers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => {
            setEditingTrigger({ ...DEFAULT_TRIGGER });
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Gatilho
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {triggers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">Nenhum gatilho configurado</h4>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Crie gatilhos para notificar gestores automaticamente quando eventos ocorrerem.
            </p>
            <Button onClick={createDefaultTriggers}>
              <Zap className="h-4 w-4 mr-2" />
              Criar Gatilhos Padrão
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Triggers list */}
      <div className="grid gap-4">
        {triggers.map((trigger) => (
          <Card key={trigger.id} className={!trigger.is_active ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={trigger.is_active}
                    onCheckedChange={() => toggleTriggerActive(trigger)}
                  />
                  <div>
                    <CardTitle className="text-base">{trigger.trigger_name}</CardTitle>
                    <CardDescription className="text-xs">
                      {TRIGGER_TYPES.find(t => t.value === trigger.trigger_type)?.label}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setPreviewTrigger(trigger);
                      setPreviewOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingTrigger(trigger);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTrigger(trigger.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2 mb-3">
                {trigger.trigger_status.map((status) => (
                  <Badge key={status} variant="secondary" className="text-xs">
                    {STATUS_LABELS[status] || status}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {FIELD_OPTIONS.filter(f => trigger[f.key as keyof ManagerTriggerConfig]).map((field) => (
                  <Badge key={field.key} variant="outline" className="text-xs">
                    {field.emoji} {field.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTrigger?.id ? 'Editar Gatilho' : 'Novo Gatilho'}
            </DialogTitle>
            <DialogDescription>
              Configure quando este gatilho deve disparar e quais informações enviar.
            </DialogDescription>
          </DialogHeader>

          {editingTrigger && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trigger_name">Nome do Gatilho</Label>
                  <Input
                    id="trigger_name"
                    value={editingTrigger.trigger_name || ''}
                    onChange={(e) => setEditingTrigger({
                      ...editingTrigger,
                      trigger_name: e.target.value
                    })}
                    placeholder="Ex: Pedido em Produção"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trigger_type">Tipo de Gatilho</Label>
                  <Select
                    value={editingTrigger.trigger_type}
                    onValueChange={(value) => setEditingTrigger({
                      ...editingTrigger,
                      trigger_type: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status Selection */}
              <div className="space-y-2">
                <Label>Status que Disparam o Gatilho</Label>
                <Card>
                  <ScrollArea className="h-48 p-4">
                    {Object.entries(STATUS_OPTIONS).map(([group, statuses]) => (
                      <div key={group} className="mb-4">
                        <h5 className="text-sm font-medium mb-2 capitalize">{group}</h5>
                        <div className="grid grid-cols-2 gap-2">
                          {statuses.map((status) => (
                            <label
                              key={status.value}
                              className="flex items-center gap-2 text-sm cursor-pointer"
                            >
                              <Checkbox
                                checked={editingTrigger.trigger_status?.includes(status.value)}
                                onCheckedChange={(checked) => {
                                  const current = editingTrigger.trigger_status || [];
                                  setEditingTrigger({
                                    ...editingTrigger,
                                    trigger_status: checked
                                      ? [...current, status.value]
                                      : current.filter(s => s !== status.value)
                                  });
                                }}
                              />
                              {status.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </Card>
              </div>

              <Separator />

              {/* Field Selection */}
              <div className="space-y-2">
                <Label>Informações Incluídas na Mensagem</Label>
                <div className="grid grid-cols-2 gap-3">
                  {FIELD_OPTIONS.map((field) => (
                    <label
                      key={field.key}
                      className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md hover:bg-muted"
                    >
                      <Checkbox
                        checked={!!editingTrigger[field.key as keyof ManagerTriggerConfig]}
                        onCheckedChange={(checked) => {
                          setEditingTrigger({
                            ...editingTrigger,
                            [field.key]: checked
                          });
                        }}
                      />
                      <span>{field.emoji}</span>
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
                
                {/* Filtro de Itens de Compra - aparece quando Lista de Itens está marcada */}
                {editingTrigger.include_item_list && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-dashed">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={!!editingTrigger.filter_purchase_items}
                        onCheckedChange={(checked) => {
                          setEditingTrigger({
                            ...editingTrigger,
                            filter_purchase_items: !!checked
                          });
                        }}
                      />
                      <span>🛒</span>
                      <span className="font-medium">Filtrar apenas itens para compra</span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                      Mostra apenas itens com status de compra pendente (purchase_required, out_of_stock, etc.)
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Advanced Options */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridade (1-10)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min={1}
                    max={10}
                    value={editingTrigger.priority || 5}
                    onChange={(e) => setEditingTrigger({
                      ...editingTrigger,
                      priority: parseInt(e.target.value) || 5
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delay">Atraso (minutos)</Label>
                  <Input
                    id="delay"
                    type="number"
                    min={0}
                    value={editingTrigger.delay_minutes || 0}
                    onChange={(e) => setEditingTrigger({
                      ...editingTrigger,
                      delay_minutes: parseInt(e.target.value) || 0
                    })}
                  />
                </div>
              </div>

              {/* Custom Template */}
              <div className="space-y-2">
                <Label htmlFor="custom_template">Template Customizado (opcional)</Label>
                <Textarea
                  id="custom_template"
                  value={editingTrigger.custom_template || ''}
                  onChange={(e) => setEditingTrigger({
                    ...editingTrigger,
                    custom_template: e.target.value || null
                  })}
                  placeholder="Deixe em branco para usar template automático"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {'{order_number}'}, {'{customer_name}'}, {'{total_value}'}, etc.
                </p>
              </div>

              <Separator />

              {/* Preview */}
              <div className="space-y-2">
                <Label>Preview da Mensagem</Label>
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {generatePreviewMessage(editingTrigger)}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveTrigger} disabled={saving || !editingTrigger?.trigger_name}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview: {previewTrigger?.trigger_name}</DialogTitle>
            <DialogDescription>
              Visualização de como a mensagem será enviada aos gestores.
            </DialogDescription>
          </DialogHeader>
          {previewTrigger && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {generatePreviewMessage(previewTrigger)}
                </pre>
              </CardContent>
            </Card>
          )}
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
