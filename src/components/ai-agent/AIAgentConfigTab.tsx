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
import { Slider } from "@/components/ui/slider";
import { Save, MessageSquare, Mail, Clock, Bell, AlertTriangle, FlaskConical, Smartphone, Settings, Plus, X, Shield, Zap, Eye, Rocket, TestTube } from "lucide-react";
import { toast } from "sonner";
import { NOTIFICATION_PHASE_OPTIONS } from "@/lib/notificationPhases";
import { QuickActionsPanel } from "./QuickActionsPanel";

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
  test_phones?: string[];
  use_signature?: boolean;
  closing_style?: string;
  conversation_style?: string;
  avoid_repetition?: boolean;
  forbidden_phrases?: string[];
  // Novos campos de rate limiting
  delay_between_messages_ms?: number;
  max_messages_per_minute?: number;
  max_messages_per_hour?: number;
  send_window_start?: string;
  send_window_end?: string;
  respect_send_window?: boolean;
  queue_outside_window?: boolean;
  // Novos campos de estilo de mensagem
  message_style?: string;
  use_progress_bar?: boolean;
  custom_greeting?: string;
  custom_closing?: string;
  // Modo teste/produção
  test_mode_enabled?: boolean;
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

      {/* Modo de Operação: Teste vs Produção */}
      <Card className={`border-2 transition-all ${
        (formData.test_mode_enabled ?? config.test_mode_enabled ?? true)
          ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent'
          : 'border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent'
      }`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(formData.test_mode_enabled ?? config.test_mode_enabled ?? true) 
              ? <TestTube className="h-5 w-5 text-amber-500" />
              : <Rocket className="h-5 w-5 text-green-500" />
            }
            Modo de Operação
            <Badge 
              variant="outline" 
              className={`ml-2 ${
                (formData.test_mode_enabled ?? config.test_mode_enabled ?? true)
                  ? 'border-amber-500/50 text-amber-600'
                  : 'border-green-500/50 text-green-600'
              }`}
            >
              {(formData.test_mode_enabled ?? config.test_mode_enabled ?? true) ? 'TESTE' : 'PRODUÇÃO'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Controle se as notificações vão para números de teste ou para clientes reais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle principal */}
          <div className={`flex items-center justify-between p-4 rounded-lg border ${
            (formData.test_mode_enabled ?? config.test_mode_enabled ?? true)
              ? 'bg-amber-500/10 border-amber-500/20'
              : 'bg-green-500/10 border-green-500/20'
          }`}>
            <div className="flex items-center gap-3">
              {(formData.test_mode_enabled ?? config.test_mode_enabled ?? true) 
                ? <TestTube className="h-5 w-5 text-amber-500" />
                : <Rocket className="h-5 w-5 text-green-500" />
              }
              <div>
                <Label className="font-medium">
                  {(formData.test_mode_enabled ?? config.test_mode_enabled ?? true) 
                    ? 'Modo Teste Ativo'
                    : 'Modo Produção Ativo'
                  }
                </Label>
                <p className="text-sm text-muted-foreground">
                  {(formData.test_mode_enabled ?? config.test_mode_enabled ?? true) 
                    ? 'Notificações vão APENAS para números de teste abaixo'
                    : 'Notificações vão para o WhatsApp REAL do cliente'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Teste</span>
              <Switch
                checked={!(formData.test_mode_enabled ?? config.test_mode_enabled ?? true)}
                onCheckedChange={(checked) => updateField('test_mode_enabled', !checked)}
              />
              <span className="text-xs text-muted-foreground">Produção</span>
            </div>
          </div>

          {/* Aviso de produção */}
          {!(formData.test_mode_enabled ?? config.test_mode_enabled ?? true) && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  ⚠️ Atenção: Modo Produção Ativo!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todas as notificações serão enviadas para os clientes REAIS. 
                  Cópias ainda serão enviadas aos números de teste para monitoramento.
                </p>
              </div>
            </div>
          )}

          {/* Números de teste */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border">
            <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-3 flex-1">
              <Label>
                {(formData.test_mode_enabled ?? config.test_mode_enabled ?? true)
                  ? 'Números que Receberão as Notificações'
                  : 'Números para Cópia de Monitoramento'
                }
              </Label>
              
              {/* Lista de números cadastrados */}
              <div className="space-y-2">
                {(formData.test_phones ?? config.test_phones ?? []).map((phone, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Badge variant="secondary" className="flex-1 justify-between py-2 px-3 font-mono">
                      {phone}
                      <button
                        type="button"
                        onClick={() => {
                          const currentPhones = formData.test_phones ?? config.test_phones ?? [];
                          const newPhones = currentPhones.filter((_, i) => i !== index);
                          updateField('test_phones', newPhones);
                        }}
                        className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </div>
                ))}
              </div>
              
              {/* Input para adicionar novo número */}
              <div className="flex gap-2">
                <Input
                  type="tel"
                  id="new-test-phone"
                  placeholder="Ex: 5551999050190"
                  className="bg-background font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.target as HTMLInputElement;
                      const newPhone = input.value.replace(/\D/g, '');
                      if (newPhone.length >= 10) {
                        const currentPhones = formData.test_phones ?? config.test_phones ?? [];
                        if (!currentPhones.includes(newPhone)) {
                          updateField('test_phones', [...currentPhones, newPhone]);
                          input.value = '';
                        }
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const input = document.getElementById('new-test-phone') as HTMLInputElement;
                    const newPhone = input?.value.replace(/\D/g, '');
                    if (newPhone && newPhone.length >= 10) {
                      const currentPhones = formData.test_phones ?? config.test_phones ?? [];
                      if (!currentPhones.includes(newPhone)) {
                        updateField('test_phones', [...currentPhones, newPhone]);
                        input.value = '';
                      }
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                {(formData.test_mode_enabled ?? config.test_mode_enabled ?? true)
                  ? 'Em modo TESTE, apenas estes números receberão notificações. Clientes reais NÃO são notificados.'
                  : 'Em modo PRODUÇÃO, estes números recebem cópias das notificações para monitoramento.'
                }
              </p>
            </div>
          </div>
          
          {/* Status */}
          {(formData.test_phones ?? config.test_phones ?? []).length > 0 && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              (formData.test_mode_enabled ?? config.test_mode_enabled ?? true)
                ? 'bg-amber-500/10 border border-amber-500/20'
                : 'bg-green-500/10 border border-green-500/20'
            }`}>
              <div className={`h-2 w-2 rounded-full animate-pulse ${
                (formData.test_mode_enabled ?? config.test_mode_enabled ?? true)
                  ? 'bg-amber-500'
                  : 'bg-green-500'
              }`} />
              <span className={`text-sm ${
                (formData.test_mode_enabled ?? config.test_mode_enabled ?? true)
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-green-700 dark:text-green-400'
              }`}>
                {(formData.test_mode_enabled ?? config.test_mode_enabled ?? true)
                  ? `Modo teste ativo! ${(formData.test_phones ?? config.test_phones ?? []).length} número(s) receberão notificações`
                  : `Modo produção ativo! Clientes reais receberão notificações + ${(formData.test_phones ?? config.test_phones ?? []).length} cópia(s)`
                }
              </span>
            </div>
          )}

          {(formData.test_phones ?? config.test_phones ?? []).length === 0 && (formData.test_mode_enabled ?? config.test_mode_enabled ?? true) && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                Adicione pelo menos um número de teste para receber notificações
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

      {/* Proteção Anti-Bloqueio */}
      <Card className="border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Proteção Anti-Bloqueio
            <Badge variant="outline" className="ml-2 border-orange-500/50 text-orange-600">
              Rate Limiting
            </Badge>
          </CardTitle>
          <CardDescription>
            Configure limites de envio para evitar bloqueio do número WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Delay entre mensagens */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Delay entre mensagens
              </Label>
              <Badge variant="secondary" className="font-mono">
                {((formData.delay_between_messages_ms ?? config.delay_between_messages_ms ?? 3000) / 1000).toFixed(1)}s
              </Badge>
            </div>
            <Slider
              value={[(formData.delay_between_messages_ms ?? config.delay_between_messages_ms ?? 3000) / 1000]}
              onValueChange={([value]) => updateField('delay_between_messages_ms', value * 1000)}
              min={1}
              max={10}
              step={0.5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Tempo mínimo de espera entre cada mensagem enviada (1-10 segundos)
            </p>
          </div>

          {/* Limites por período */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Máximo por minuto
              </Label>
              <Input
                type="number"
                value={formData.max_messages_per_minute ?? config.max_messages_per_minute ?? 15}
                onChange={(e) => updateField('max_messages_per_minute', parseInt(e.target.value))}
                min={1}
                max={30}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Recomendado: 10-15 por minuto
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Máximo por hora
              </Label>
              <Input
                type="number"
                value={formData.max_messages_per_hour ?? config.max_messages_per_hour ?? 200}
                onChange={(e) => updateField('max_messages_per_hour', parseInt(e.target.value))}
                min={10}
                max={500}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Recomendado: 100-200 por hora
              </p>
            </div>
          </div>

          {/* Janela de envio */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Respeitar Janela de Envio</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar apenas dentro do horário definido
                </p>
              </div>
              <Switch
                checked={formData.respect_send_window ?? config.respect_send_window ?? true}
                onCheckedChange={(checked) => updateField('respect_send_window', checked)}
              />
            </div>

            {(formData.respect_send_window ?? config.respect_send_window ?? true) && (
              <div className="grid gap-4 md:grid-cols-2 p-3 rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <Label>Início da Janela</Label>
                  <Input
                    type="time"
                    value={(formData.send_window_start ?? config.send_window_start ?? '08:00').toString().slice(0, 5)}
                    onChange={(e) => updateField('send_window_start', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim da Janela</Label>
                  <Input
                    type="time"
                    value={(formData.send_window_end ?? config.send_window_end ?? '20:00').toString().slice(0, 5)}
                    onChange={(e) => updateField('send_window_end', e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div>
                <Label>Enfileirar Fora do Horário</Label>
                <p className="text-sm text-muted-foreground">
                  Guardar mensagens para enviar quando a janela abrir
                </p>
              </div>
              <Switch
                checked={formData.queue_outside_window ?? config.queue_outside_window ?? true}
                onCheckedChange={(checked) => updateField('queue_outside_window', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estilo Visual das Mensagens */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Estilo Visual das Mensagens
          </CardTitle>
          <CardDescription>
            Configure a aparência das mensagens enviadas aos clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Estilo da Mensagem</Label>
            <Select
              value={formData.message_style ?? config.message_style ?? 'visual'}
              onValueChange={(value) => updateField('message_style', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estilo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visual">📊 Visual (com separadores e formatação)</SelectItem>
                <SelectItem value="simple">💬 Simples (conversa natural)</SelectItem>
                <SelectItem value="minimal">📝 Minimalista (só informações)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Mostrar Barra de Progresso</Label>
              <p className="text-sm text-muted-foreground">
                Exibir progresso visual do pedido (🟢🟢🟢⚪⚪)
              </p>
            </div>
            <Switch
              checked={formData.use_progress_bar ?? config.use_progress_bar ?? true}
              onCheckedChange={(checked) => updateField('use_progress_bar', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Saudação Personalizada (opcional)</Label>
            <Input
              value={formData.custom_greeting ?? config.custom_greeting ?? ''}
              onChange={(e) => updateField('custom_greeting', e.target.value)}
              placeholder="Ex: Olá, {nome}! 👋"
            />
            <p className="text-xs text-muted-foreground">
              Use {'{nome}'} para incluir o nome do cliente. Deixe vazio para saudações variadas.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Fechamento Personalizado (opcional)</Label>
            <Input
              value={formData.custom_closing ?? config.custom_closing ?? ''}
              onChange={(e) => updateField('custom_closing', e.target.value)}
              placeholder="Ex: Qualquer dúvida, estamos à disposição! 😊"
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para fechamentos variados e naturais.
            </p>
          </div>

          {/* Preview da mensagem */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <Label className="text-xs uppercase text-muted-foreground mb-2 block">Preview</Label>
            <div className="font-mono text-xs whitespace-pre-wrap text-foreground/80">
{`━━━━━━━━━━━━━━━━━
📦 *Atualização do seu Pedido*
━━━━━━━━━━━━━━━━━

${formData.custom_greeting?.replace('{nome}', 'João') ?? 'Oi, João! 😊'}

Seu pedido *#12345* avançou! 🎉

📍 *Status:* Em Produção
📅 *Previsão:* 28/01/2026

${(formData.use_progress_bar ?? config.use_progress_bar ?? true) ? '*Progresso:* 🟢🟢⚪⚪⚪' : ''}

${formData.custom_closing ?? 'Me avisa se precisar! ✨'}`}
            </div>
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

      {/* Ações Rápidas */}
      <QuickActionsPanel />

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
