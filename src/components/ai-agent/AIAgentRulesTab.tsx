import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Bell, Zap, MessageSquare, Mail } from "lucide-react";
import { toast } from "sonner";
import { STATUS_LABELS } from "@/lib/statusLabels";

interface NotificationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_status: string | null;
  trigger_conditions: Record<string, any>;
  channels: string[];
  priority: number;
  delay_minutes: number;
  is_active: boolean;
  template_id: string | null;
}

interface NotificationTemplate {
  id: string;
  name: string;
  channel: string;
}

interface Props {
  rules: NotificationRule[];
  templates: NotificationTemplate[];
  onAdd: (rule: Omit<NotificationRule, 'id'>) => Promise<{ data: any; error: any }>;
  onUpdate: (id: string, updates: Partial<NotificationRule>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
}

const TRIGGER_TYPES = [
  { value: 'status_change', label: 'Mudança de Status' },
  { value: 'deadline', label: 'Prazo de Entrega' },
  { value: 'manual', label: 'Envio Manual' },
  { value: 'scheduled', label: 'Agendado' },
];

export function AIAgentRulesTab({ rules, templates, onAdd, onUpdate, onDelete }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'status_change',
    trigger_status: '',
    channels: ['whatsapp'] as string[],
    priority: 0,
    delay_minutes: 0,
    is_active: true,
    template_id: '',
  });

  const handleOpenDialog = (rule?: NotificationRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        description: rule.description || '',
        trigger_type: rule.trigger_type,
        trigger_status: rule.trigger_status || '',
        channels: rule.channels,
        priority: rule.priority,
        delay_minutes: rule.delay_minutes,
        is_active: rule.is_active,
        template_id: rule.template_id || '',
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        trigger_type: 'status_change',
        trigger_status: '',
        channels: ['whatsapp'],
        priority: 0,
        delay_minutes: 0,
        is_active: true,
        template_id: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const data = {
      name: formData.name,
      description: formData.description || null,
      trigger_type: formData.trigger_type,
      trigger_status: formData.trigger_status || null,
      trigger_conditions: {},
      channels: formData.channels,
      priority: formData.priority,
      delay_minutes: formData.delay_minutes,
      is_active: formData.is_active,
      template_id: formData.template_id || null,
    };

    if (editingRule) {
      const { error } = await onUpdate(editingRule.id, data);
      if (error) {
        toast.error("Erro ao atualizar regra");
      } else {
        toast.success("Regra atualizada");
        setDialogOpen(false);
      }
    } else {
      const { error } = await onAdd(data);
      if (error) {
        toast.error("Erro ao adicionar regra");
      } else {
        toast.success("Regra adicionada");
        setDialogOpen(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta regra?")) return;
    
    const { error } = await onDelete(id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Regra excluída");
    }
  };

  const handleToggleActive = async (rule: NotificationRule) => {
    await onUpdate(rule.id, { is_active: !rule.is_active });
  };

  const toggleChannel = (channel: string) => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Regras de Notificação</h3>
          <p className="text-sm text-muted-foreground">
            Configure quando e como as notificações são disparadas
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Editar Regra' : 'Nova Regra de Notificação'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Nome da Regra</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Notificar quando pedido sair para entrega"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional..."
                  rows={2}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de Gatilho</Label>
                  <Select
                    value={formData.trigger_type}
                    onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.trigger_type === 'status_change' && (
                  <div className="space-y-2">
                    <Label>Status que Dispara</Label>
                    <Select
                      value={formData.trigger_status}
                      onValueChange={(value) => setFormData({ ...formData, trigger_status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um status" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Canais de Envio</Label>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="whatsapp"
                      checked={formData.channels.includes('whatsapp')}
                      onCheckedChange={() => toggleChannel('whatsapp')}
                    />
                    <label htmlFor="whatsapp" className="flex items-center gap-1 text-sm">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                      WhatsApp
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="email"
                      checked={formData.channels.includes('email')}
                      onCheckedChange={() => toggleChannel('email')}
                    />
                    <label htmlFor="email" className="flex items-center gap-1 text-sm">
                      <Mail className="h-4 w-4 text-blue-600" />
                      E-mail
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Template de Mensagem</Label>
                <Select
                  value={formData.template_id}
                  onValueChange={(value) => setFormData({ ...formData, template_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} ({template.channel})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prioridade (0-10)</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    min={0}
                    max={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Atraso no Envio (minutos)</Label>
                  <Input
                    type="number"
                    value={formData.delay_minutes}
                    onChange={(e) => setFormData({ ...formData, delay_minutes: parseInt(e.target.value) })}
                    min={0}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label>Regra Ativa</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingRule ? 'Salvar Alterações' : 'Criar Regra'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {rules.map(rule => (
          <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${rule.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Zap className={`h-4 w-4 ${rule.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{rule.name}</CardTitle>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={() => handleToggleActive(rule)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(rule)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {TRIGGER_TYPES.find(t => t.value === rule.trigger_type)?.label || rule.trigger_type}
                </Badge>
                {rule.trigger_status && (
                  <Badge variant="secondary">
                    Status: {STATUS_LABELS[rule.trigger_status] || rule.trigger_status}
                  </Badge>
                )}
                {rule.channels.map(channel => (
                  <Badge key={channel} className={channel === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                    {channel === 'whatsapp' ? <MessageSquare className="h-3 w-3 mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
                    {channel}
                  </Badge>
                ))}
                {rule.delay_minutes > 0 && (
                  <Badge variant="outline">Atraso: {rule.delay_minutes}min</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma regra configurada</p>
        </div>
      )}
    </div>
  );
}
