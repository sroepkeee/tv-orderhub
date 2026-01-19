import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Truck,
  Clock,
  MessageSquare,
  Save,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  RotateCcw,
} from "lucide-react";

interface DeliveryConfirmationConfigData {
  id?: string;
  organization_id: string | null;
  is_active: boolean;
  trigger_after_hours: number;
  trigger_status: string[];
  message_template: string;
  followup_enabled: boolean;
  followup_after_hours: number;
  followup_message_template: string;
  max_attempts: number;
  retry_interval_hours: number;
  auto_complete_on_confirm: boolean;
  auto_create_analysis_on_not_received: boolean;
}

const DEFAULT_CONFIG: Omit<DeliveryConfirmationConfigData, 'organization_id'> = {
  is_active: false,
  trigger_after_hours: 48,
  trigger_status: ['in_transit', 'em_transito', 'delivered', 'entregue'],
  message_template: `📦 Olá! Aqui é da {{empresa}}. 

Seu pedido *#{{numero_pedido}}* foi enviado há alguns dias.

*A entrega foi realizada com sucesso?*

Responda:
✅ *SIM* - Recebi meu pedido
❌ *NÃO* - Ainda não recebi

Se não recebeu, por favor nos informe para abrirmos uma análise.`,
  followup_enabled: true,
  followup_after_hours: 24,
  followup_message_template: `📦 Olá! Ainda não recebemos sua confirmação.

Seu pedido *#{{numero_pedido}}* chegou?

Responda *SIM* ou *NÃO* para nos ajudar.`,
  max_attempts: 3,
  retry_interval_hours: 24,
  auto_complete_on_confirm: true,
  auto_create_analysis_on_not_received: true,
};

const STATUS_OPTIONS = [
  { value: 'in_transit', label: 'Em Trânsito' },
  { value: 'em_transito', label: 'Em Trânsito (PT)' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'entregue', label: 'Entregue (PT)' },
  { value: 'out_for_delivery', label: 'Saiu para Entrega' },
  { value: 'awaiting_pickup', label: 'Aguardando Coleta' },
];

interface PendingConfirmation {
  id: string;
  order_id: string;
  customer_name: string | null;
  customer_whatsapp: string;
  order_status: string;
  sent_at: string;
  attempts_count: number;
  response_type: string | null;
  requires_analysis: boolean;
  orders?: {
    order_number: string;
  };
}

export function DeliveryConfirmationConfig() {
  const { organizationId } = useOrganizationId();
  const [config, setConfig] = useState<DeliveryConfirmationConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmation[]>([]);
  const [analysisRequired, setAnalysisRequired] = useState<PendingConfirmation[]>([]);

  const loadConfig = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      // Carregar configuração
      const { data, error } = await supabase
        .from('delivery_confirmation_config')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setConfig(data as any);
      } else {
        // Usar configuração padrão
        setConfig({
          ...DEFAULT_CONFIG,
          organization_id: organizationId,
        });
      }

      // Carregar confirmações pendentes
      const { data: pending } = await supabase
        .from('delivery_confirmations')
        .select(`
          *,
          orders:order_id (order_number)
        `)
        .eq('organization_id', organizationId)
        .eq('response_received', false)
        .order('sent_at', { ascending: false })
        .limit(10);

      setPendingConfirmations((pending || []) as any);

      // Carregar análises necessárias
      const { data: analysis } = await supabase
        .from('delivery_confirmations')
        .select(`
          *,
          orders:order_id (order_number)
        `)
        .eq('organization_id', organizationId)
        .eq('requires_analysis', true)
        .is('analyzed_at', null)
        .order('responded_at', { ascending: false })
        .limit(10);

      setAnalysisRequired((analysis || []) as any);

    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = async () => {
    if (!config || !organizationId) return;

    setSaving(true);
    try {
      const configData = {
        ...config,
        organization_id: organizationId,
      };

      if (config.id) {
        const { error } = await supabase
          .from('delivery_confirmation_config')
          .update(configData)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('delivery_confirmation_config')
          .insert([configData])
          .select()
          .single();

        if (error) throw error;
        setConfig(data as any);
      }

      toast.success('Configuração salva com sucesso');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof DeliveryConfirmationConfigData>(
    field: K,
    value: DeliveryConfirmationConfigData[K]
  ) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  const toggleStatus = (status: string) => {
    if (!config) return;
    const current = config.trigger_status || [];
    if (current.includes(status)) {
      updateField('trigger_status', current.filter(s => s !== status));
    } else {
      updateField('trigger_status', [...current, status]);
    }
  };

  const markAsAnalyzed = async (confirmationId: string) => {
    try {
      const { error } = await supabase
        .from('delivery_confirmations')
        .update({
          analyzed_at: new Date().toISOString(),
          analysis_notes: 'Analisado manualmente pelo gestor'
        })
        .eq('id', confirmationId);

      if (error) throw error;

      toast.success('Marcado como analisado');
      loadConfig();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao atualizar');
    }
  };

  const testTrigger = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-delivery-confirmations');
      
      if (error) throw error;

      toast.success(`Verificação executada: ${data?.orders_processed || 0} pedidos processados, ${data?.messages_sent || 0} mensagens enviadas`);
      loadConfig();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao executar verificação');
    }
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
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Confirmação de Entrega
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure o gatilho automático para confirmar entregas com os clientes via WhatsApp.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadConfig}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={testTrigger}>
            <Send className="h-4 w-4 mr-2" />
            Executar Agora
          </Button>
          <Button size="sm" onClick={saveConfig} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurações Principais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Configurações do Gatilho
            </CardTitle>
            <CardDescription>
              Defina quando e como enviar as confirmações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Ativar/Desativar */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar Confirmação de Entrega</Label>
                <p className="text-xs text-muted-foreground">
                  Enviar mensagens automáticas perguntando se a entrega foi realizada
                </p>
              </div>
              <Switch
                checked={config?.is_active || false}
                onCheckedChange={(checked) => updateField('is_active', checked)}
              />
            </div>

            <Separator />

            {/* Tempo após status */}
            <div className="space-y-2">
              <Label>Enviar confirmação após (horas)</Label>
              <Input
                type="number"
                value={config?.trigger_after_hours || 48}
                onChange={(e) => updateField('trigger_after_hours', parseInt(e.target.value) || 48)}
                min={1}
                max={168}
              />
              <p className="text-xs text-muted-foreground">
                Horas após o pedido entrar no status de trânsito/entrega
              </p>
            </div>

            {/* Status que disparam */}
            <div className="space-y-2">
              <Label>Status que disparam o gatilho</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <Badge
                    key={status.value}
                    variant={config?.trigger_status?.includes(status.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleStatus(status.value)}
                  >
                    {status.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Ações automáticas */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Ações Automáticas</Label>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm">Concluir pedido ao confirmar</span>
                  <p className="text-xs text-muted-foreground">
                    Marcar pedido como "Concluído" quando cliente confirmar entrega
                  </p>
                </div>
                <Switch
                  checked={config?.auto_complete_on_confirm || false}
                  onCheckedChange={(checked) => updateField('auto_complete_on_confirm', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm">Criar análise se não recebeu</span>
                  <p className="text-xs text-muted-foreground">
                    Abrir análise interna quando cliente reportar não recebimento
                  </p>
                </div>
                <Switch
                  checked={config?.auto_create_analysis_on_not_received || false}
                  onCheckedChange={(checked) => updateField('auto_create_analysis_on_not_received', checked)}
                />
              </div>
            </div>

            <Separator />

            {/* Follow-up */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Habilitar Follow-up</Label>
                <Switch
                  checked={config?.followup_enabled || false}
                  onCheckedChange={(checked) => updateField('followup_enabled', checked)}
                />
              </div>

              {config?.followup_enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Enviar follow-up após (horas)</Label>
                    <Input
                      type="number"
                      value={config?.followup_after_hours || 24}
                      onChange={(e) => updateField('followup_after_hours', parseInt(e.target.value) || 24)}
                      min={1}
                      max={72}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Máximo de tentativas</Label>
                    <Input
                      type="number"
                      value={config?.max_attempts || 3}
                      onChange={(e) => updateField('max_attempts', parseInt(e.target.value) || 3)}
                      min={1}
                      max={5}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Templates de Mensagem */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Templates de Mensagem
            </CardTitle>
            <CardDescription>
              Personalize as mensagens enviadas aos clientes.
              <br />
              Variáveis: <code>{'{{empresa}}'}</code>, <code>{'{{numero_pedido}}'}</code>, <code>{'{{cliente}}'}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mensagem Principal</Label>
              <Textarea
                value={config?.message_template || ''}
                onChange={(e) => updateField('message_template', e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {config?.followup_enabled && (
              <div className="space-y-2">
                <Label>Mensagem de Follow-up</Label>
                <Textarea
                  value={config?.followup_message_template || ''}
                  onChange={(e) => updateField('followup_message_template', e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            )}

            {/* Preview */}
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
              <div className="text-sm whitespace-pre-wrap">
                {(config?.message_template || '')
                  .replace(/\{\{empresa\}\}/g, 'Empresa Exemplo')
                  .replace(/\{\{numero_pedido\}\}/g, '140037')
                  .replace(/\{\{cliente\}\}/g, 'João Silva')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmações Pendentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aguardando Resposta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Aguardando Resposta
              {pendingConfirmations.length > 0 && (
                <Badge variant="secondary">{pendingConfirmations.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingConfirmations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma confirmação pendente
              </p>
            ) : (
              <div className="space-y-2">
                {pendingConfirmations.map((conf) => (
                  <div key={conf.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium">
                        Pedido #{conf.orders?.order_number || conf.order_id.substring(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conf.customer_name} • Tentativa {conf.attempts_count}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-yellow-600">
                      <Clock className="h-3 w-3 mr-1" />
                      Pendente
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Análises Necessárias */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Análises Necessárias
              {analysisRequired.length > 0 && (
                <Badge variant="destructive">{analysisRequired.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysisRequired.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma análise pendente
              </p>
            ) : (
              <div className="space-y-2">
                {analysisRequired.map((conf) => (
                  <div key={conf.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">
                        Pedido #{conf.orders?.order_number || conf.order_id.substring(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conf.customer_name} • Cliente reportou não recebimento
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markAsAnalyzed(conf.id)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Analisado
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legenda */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Cliente confirmou entrega</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Cliente não recebeu</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span>Aguardando resposta</span>
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-blue-500" />
              <span>Follow-up enviado</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
