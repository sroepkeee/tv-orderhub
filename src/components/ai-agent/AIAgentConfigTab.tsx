import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Bot, MessageSquare, Mail, Clock, Bell } from "lucide-react";
import { toast } from "sonner";
import { NOTIFICATION_PHASE_OPTIONS } from "@/lib/notificationPhases";

interface AgentConfig {
  id: string;
  agent_name: string;
  personality: string;
  tone_of_voice: string;
  language: string;
  is_active: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  working_hours_start: string;
  working_hours_end: string;
  respect_working_hours: boolean;
  max_notifications_per_day: number;
  min_interval_minutes: number;
  signature: string;
  custom_instructions: string | null;
  notification_phases?: string[];
}

interface Props {
  config: AgentConfig | null;
  onUpdate: (updates: Partial<AgentConfig>) => Promise<{ error: any }>;
}

export function AIAgentConfigTab({ config, onUpdate }: Props) {
  const [formData, setFormData] = useState<Partial<AgentConfig>>(config || {});
  const [saving, setSaving] = useState(false);

  if (!config) {
    return <div className="text-center py-8 text-muted-foreground">Carregando configuração...</div>;
  }

  const handleSave = async () => {
    setSaving(true);
    const { error } = await onUpdate(formData);
    setSaving(false);
    
    if (error) {
      toast.error("Erro ao salvar configuração");
    } else {
      toast.success("Configuração salva com sucesso");
    }
  };

  const updateField = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const currentPhases = formData.notification_phases ?? config.notification_phases ?? [];

  const togglePhase = (phaseValue: string) => {
    const phases = [...currentPhases];
    const index = phases.indexOf(phaseValue);
    if (index > -1) {
      phases.splice(index, 1);
    } else {
      phases.push(phaseValue);
    }
    updateField('notification_phases', phases);
  };

  return (
    <div className="space-y-6">
      {/* Status e Identidade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Identidade do Agente
          </CardTitle>
          <CardDescription>Configure a personalidade e comportamento do agente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Status do Agente</Label>
              <p className="text-sm text-muted-foreground">Ativar ou desativar o envio de notificações</p>
            </div>
            <Switch
              checked={formData.is_active ?? config.is_active}
              onCheckedChange={(checked) => updateField('is_active', checked)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do Agente</Label>
              <Input
                value={formData.agent_name ?? config.agent_name}
                onChange={(e) => updateField('agent_name', e.target.value)}
                placeholder="Ex: Assistente Imply"
              />
            </div>
            <div className="space-y-2">
              <Label>Assinatura</Label>
              <Input
                value={formData.signature ?? config.signature}
                onChange={(e) => updateField('signature', e.target.value)}
                placeholder="Ex: Equipe Imply"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Personalidade</Label>
            <Textarea
              value={formData.personality ?? config.personality}
              onChange={(e) => updateField('personality', e.target.value)}
              placeholder="Descreva a personalidade do agente..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tom de Voz</Label>
              <Select
                value={formData.tone_of_voice ?? config.tone_of_voice}
                onValueChange={(value) => updateField('tone_of_voice', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="informal">Informal</SelectItem>
                  <SelectItem value="amigavel">Amigável</SelectItem>
                  <SelectItem value="profissional">Profissional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select
                value={formData.language ?? config.language}
                onValueChange={(value) => updateField('language', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Instruções Personalizadas</Label>
            <Textarea
              value={formData.custom_instructions ?? config.custom_instructions ?? ''}
              onChange={(e) => updateField('custom_instructions', e.target.value)}
              placeholder="Instruções adicionais para o agente..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fases de Notificação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Fases de Notificação ao Cliente
          </CardTitle>
          <CardDescription>
            Selecione em quais mudanças de status o cliente receberá notificação automática
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {NOTIFICATION_PHASE_OPTIONS.map((phase) => (
              <div
                key={phase.value}
                className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                  currentPhases.includes(phase.value) 
                    ? 'bg-primary/5 border-primary/30' 
                    : 'bg-muted/30 border-border'
                }`}
              >
                <Checkbox
                  id={phase.value}
                  checked={currentPhases.includes(phase.value)}
                  onCheckedChange={() => togglePhase(phase.value)}
                />
                <div className="space-y-1">
                  <label
                    htmlFor={phase.value}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {phase.label}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {phase.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {currentPhases.length} fase(s) selecionada(s)
          </p>
        </CardContent>
      </Card>

      {/* Canais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Canais de Comunicação
          </CardTitle>
          <CardDescription>Habilite os canais disponíveis para envio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <MessageSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <p className="text-sm text-muted-foreground">Enviar notificações via WhatsApp</p>
              </div>
            </div>
            <Switch
              checked={formData.whatsapp_enabled ?? config.whatsapp_enabled}
              onCheckedChange={(checked) => updateField('whatsapp_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <Label>E-mail</Label>
                <p className="text-sm text-muted-foreground">Enviar notificações via E-mail</p>
              </div>
            </div>
            <Switch
              checked={formData.email_enabled ?? config.email_enabled}
              onCheckedChange={(checked) => updateField('email_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Horários e Limites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horários e Limites
          </CardTitle>
          <CardDescription>Configure janelas de envio e limites de notificações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Respeitar Horário Comercial</Label>
              <p className="text-sm text-muted-foreground">Enviar apenas durante o horário definido</p>
            </div>
            <Switch
              checked={formData.respect_working_hours ?? config.respect_working_hours}
              onCheckedChange={(checked) => updateField('respect_working_hours', checked)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Início do Expediente</Label>
              <Input
                type="time"
                value={formData.working_hours_start ?? config.working_hours_start}
                onChange={(e) => updateField('working_hours_start', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim do Expediente</Label>
              <Input
                type="time"
                value={formData.working_hours_end ?? config.working_hours_end}
                onChange={(e) => updateField('working_hours_end', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Máximo de Notificações por Dia</Label>
              <Input
                type="number"
                value={formData.max_notifications_per_day ?? config.max_notifications_per_day}
                onChange={(e) => updateField('max_notifications_per_day', parseInt(e.target.value))}
                min={1}
                max={20}
              />
            </div>
            <div className="space-y-2">
              <Label>Intervalo Mínimo (minutos)</Label>
              <Input
                type="number"
                value={formData.min_interval_minutes ?? config.min_interval_minutes}
                onChange={(e) => updateField('min_interval_minutes', parseInt(e.target.value))}
                min={5}
                max={1440}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
