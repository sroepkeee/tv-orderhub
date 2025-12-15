import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  MessageSquare, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp,
  Wifi,
  WifiOff,
  RefreshCw,
  Send,
  Truck,
  Users,
  Bot
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";
import { AgentType, AgentConfig } from "@/hooks/useAIAgentAdmin";
import { cn } from "@/lib/utils";

interface NotificationMetrics {
  total24h: number;
  totalWeek: number;
  successRate: number;
  byChannel: {
    whatsapp: number;
    email: number;
  };
  byStatus: {
    sent: number;
    failed: number;
    pending: number;
  };
}

interface QuoteMetrics {
  totalSent: number;
  totalResponded: number;
  responseRate: number;
}

interface WhatsAppStatus {
  connected: boolean;
  phoneNumber?: string;
  instanceName?: string;
}

interface Props {
  config: AgentConfig | null;
  configs: Record<AgentType, AgentConfig | null>;
  selectedAgentType: AgentType;
  onToggleActive: (active: boolean) => Promise<void>;
}

export function AIAgentDashboardTab({ config, configs, selectedAgentType, onToggleActive }: Props) {
  const [notificationMetrics, setNotificationMetrics] = useState<NotificationMetrics | null>(null);
  const [quoteMetrics, setQuoteMetrics] = useState<QuoteMetrics | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const carrierConfig = configs.carrier;
  const customerConfig = configs.customer;

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const last24h = subDays(now, 1).toISOString();
      const lastWeek = subDays(now, 7).toISOString();

      // Buscar logs de notificações
      const { data: logs24h } = await supabase
        .from('ai_notification_log')
        .select('channel, status')
        .gte('created_at', last24h);

      const { data: logsWeek } = await supabase
        .from('ai_notification_log')
        .select('channel, status')
        .gte('created_at', lastWeek);

      const total24h = logs24h?.length || 0;
      const totalWeek = logsWeek?.length || 0;

      const sent = logsWeek?.filter(l => l.status === 'sent').length || 0;
      const failed = logsWeek?.filter(l => l.status === 'failed').length || 0;
      const pending = logsWeek?.filter(l => l.status === 'pending').length || 0;

      const whatsappCount = logsWeek?.filter(l => l.channel === 'whatsapp').length || 0;
      const emailCount = logsWeek?.filter(l => l.channel === 'email').length || 0;

      const successRate = totalWeek > 0 ? (sent / totalWeek) * 100 : 0;

      setNotificationMetrics({
        total24h,
        totalWeek,
        successRate,
        byChannel: { whatsapp: whatsappCount, email: emailCount },
        byStatus: { sent, failed, pending },
      });

      // Buscar métricas de cotações
      const { data: quotes } = await supabase
        .from('freight_quotes')
        .select('status')
        .gte('created_at', lastWeek);

      if (quotes) {
        const totalQuotes = quotes.length;
        const responded = quotes.filter(q => q.status === 'responded').length;
        setQuoteMetrics({
          totalSent: totalQuotes,
          totalResponded: responded,
          responseRate: totalQuotes > 0 ? (responded / totalQuotes) * 100 : 0
        });
      }

      // Buscar status do WhatsApp
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('status, phone_number, name')
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();

      setWhatsappStatus({
        connected: !!instance,
        phoneNumber: instance?.phone_number,
        instanceName: instance?.name,
      });

    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleToggle = async () => {
    if (!config) return;
    setToggling(true);
    await onToggleActive(!config.is_active);
    setToggling(false);
  };

  return (
    <div className="space-y-6">
      {/* Agent Status Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Carrier Agent Card */}
        <Card className={cn(
          "relative overflow-hidden",
          carrierConfig?.is_active ? 'border-amber-500/50' : 'border-border',
          selectedAgentType === 'carrier' && 'ring-2 ring-amber-500/50'
        )}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-amber-500" />
              Agente de Transportadoras
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-3 h-3 rounded-full",
                  carrierConfig?.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                )} />
                <span className="text-xl font-bold">
                  {carrierConfig?.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{quoteMetrics?.totalSent || 0}</p>
                <p className="text-xs text-muted-foreground">cotações (7d)</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                {quoteMetrics?.responseRate.toFixed(0) || 0}% respondidas
              </Badge>
              {carrierConfig?.auto_reply_enabled && (
                <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                  Auto-reply ON
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer Agent Card */}
        <Card className={cn(
          "relative overflow-hidden",
          customerConfig?.is_active ? 'border-blue-500/50' : 'border-border',
          selectedAgentType === 'customer' && 'ring-2 ring-blue-500/50'
        )}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Agente de Clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-3 h-3 rounded-full",
                  customerConfig?.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                )} />
                <span className="text-xl font-bold">
                  {customerConfig?.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{notificationMetrics?.total24h || 0}</p>
                <p className="text-xs text-muted-foreground">notificações (24h)</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                {notificationMetrics?.successRate.toFixed(0) || 0}% sucesso
              </Badge>
              {customerConfig?.auto_reply_enabled && (
                <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">
                  Auto-reply ON
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Agent Control */}
      <Card className={cn(
        "border-2",
        selectedAgentType === 'carrier' ? 'border-amber-500/30' : 'border-blue-500/30'
      )}>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Controle do Agente Selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {selectedAgentType === 'carrier' ? (
                  <>
                    <Truck className="h-5 w-5 text-amber-500" />
                    {config?.agent_name || 'Agente de Transportadoras'}
                  </>
                ) : (
                  <>
                    <Users className="h-5 w-5 text-blue-500" />
                    {config?.agent_name || 'Agente de Clientes'}
                  </>
                )}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {config?.personality?.slice(0, 100)}...
              </p>
            </div>
            <Button 
              size="lg" 
              variant={config?.is_active ? 'destructive' : 'default'}
              onClick={handleToggle}
              disabled={toggling}
            >
              {toggling ? 'Aguarde...' : (config?.is_active ? 'Desativar' : 'Ativar')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* WhatsApp Status */}
        <Card className={whatsappStatus.connected ? 'border-green-500/50' : 'border-red-500/50'}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              {whatsappStatus.connected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              WhatsApp Business
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={whatsappStatus.connected ? 'default' : 'destructive'}>
                {whatsappStatus.connected ? 'Conectado' : 'Desconectado'}
              </Badge>
              {whatsappStatus.phoneNumber && (
                <span className="text-sm text-muted-foreground font-mono">
                  +{whatsappStatus.phoneNumber}
                </span>
              )}
            </div>
            {!whatsappStatus.connected && (
              <p className="text-xs text-muted-foreground mt-2">
                Acesse a aba Conexões para configurar
              </p>
            )}
          </CardContent>
        </Card>

        {/* Channel Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Canais Habilitados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <MessageSquare className={cn(
                  "h-5 w-5",
                  config?.whatsapp_enabled ? 'text-green-500' : 'text-muted-foreground'
                )} />
                <span className={config?.whatsapp_enabled ? 'font-medium' : 'text-muted-foreground'}>
                  WhatsApp
                </span>
                {config?.whatsapp_enabled ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Mail className={cn(
                  "h-5 w-5",
                  config?.email_enabled ? 'text-blue-500' : 'text-muted-foreground'
                )} />
                <span className={config?.email_enabled ? 'font-medium' : 'text-muted-foreground'}>
                  E-mail
                </span>
                {config?.email_enabled ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Notifications by Channel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Notificações por Canal (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    {config?.whatsapp_enabled ? 'Habilitado' : 'Desabilitado'}
                  </p>
                </div>
              </div>
              <span className="text-2xl font-bold">{notificationMetrics?.byChannel.whatsapp || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">E-mail</p>
                  <p className="text-xs text-muted-foreground">
                    {config?.email_enabled ? 'Habilitado' : 'Desabilitado'}
                  </p>
                </div>
              </div>
              <span className="text-2xl font-bold">{notificationMetrics?.byChannel.email || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Notifications by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Por Status (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Enviadas</span>
              </div>
              <span className="text-xl font-bold text-green-600">{notificationMetrics?.byStatus.sent || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-red-500" />
                <span>Falhas</span>
              </div>
              <span className="text-xl font-bold text-red-600">{notificationMetrics?.byStatus.failed || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span>Pendentes</span>
              </div>
              <span className="text-xl font-bold text-yellow-600">{notificationMetrics?.byStatus.pending || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={loadMetrics} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && 'animate-spin')} />
          Atualizar Métricas
        </Button>
      </div>
    </div>
  );
}