import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Save, MessageSquare, Mail, Clock, Bell, AlertTriangle, FlaskConical, Smartphone, Settings } from "lucide-react";
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
  auto_reply_enabled?: boolean;
  llm_model?: string;
  max_response_time_seconds?: number;
  human_handoff_keywords?: string[];
  auto_reply_delay_ms?: number;
  auto_reply_contact_types?: string[];
  test_phone?: string | null;
  use_signature?: boolean;
  closing_style?: string;
  conversation_style?: string;
  avoid_repetition?: boolean;
  forbidden_phrases?: string[];
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
      {/* Header Info */}
      <Card className="bg-muted/30 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Configurações Globais
          </CardTitle>
          <CardDescription>
            Estas configurações afetam <strong>todos os agentes</strong>. Para configurar a identidade e personalidade de cada agente individualmente, acesse a aba "Agentes".
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Modelo de IA Padrão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Palavras-chave para Transferência Humana
          </CardTitle>
          <CardDescription>
            Quando detectadas em qualquer agente, a IA para de responder e marca para atendimento humano
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={(formData.human_handoff_keywords ?? config.human_handoff_keywords ?? []).join(', ')}
            onChange={(e) => updateField('human_handoff_keywords', 
              e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0)
            )}
            placeholder="humano, atendente, pessoa, falar com alguém, gerente, supervisor..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Separe por vírgulas. Estas palavras são compartilhadas entre todos os agentes.
          </p>
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
            Selecione em quais mudanças de status os clientes receberão notificação automática (vale para todos os agentes)
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

      {/* Modo Teste */}
      <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-amber-500" />
            Modo Teste
            <Badge variant="outline" className="ml-2 border-amber-500/50 text-amber-600">
              Debug
            </Badge>
          </CardTitle>
          <CardDescription>
            Configure um número de teste para receber cópia de todas as notificações enviadas por qualquer agente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Smartphone className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="space-y-2 flex-1">
              <Label>Número de Teste (WhatsApp)</Label>
              <Input
                type="tel"
                value={formData.test_phone ?? config.test_phone ?? ''}
                onChange={(e) => updateField('test_phone', e.target.value || null)}
                placeholder="Ex: 5551999050190"
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Se configurado, este número receberá uma cópia de TODAS as notificações enviadas aos clientes, 
                com informações de debug (nome do cliente real, telefone, etc.)
              </p>
            </div>
          </div>
          
          {(formData.test_phone ?? config.test_phone) && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-green-700 dark:text-green-400">
                Modo teste ativo! Notificações serão enviadas para: {formData.test_phone ?? config.test_phone}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Canais de Comunicação
          </CardTitle>
          <CardDescription>Habilite os canais disponíveis para envio (global)</CardDescription>
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
          <CardDescription>Configure janelas de envio e limites de notificações (global)</CardDescription>
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
