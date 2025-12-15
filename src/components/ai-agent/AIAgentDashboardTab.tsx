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
  Send
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface WhatsAppStatus {
  connected: boolean;
  phoneNumber?: string;
  instanceName?: string;
}

interface Props {
  config: {
    is_active: boolean;
    whatsapp_enabled: boolean;
    email_enabled: boolean;
  } | null;
  onToggleActive: (active: boolean) => Promise<void>;
}

export function AIAgentDashboardTab({ config, onToggleActive }: Props) {
  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const last24h = subDays(now, 1).toISOString();
      const lastWeek = subDays(now, 7).toISOString();

      // Buscar logs das últimas 24h
      const { data: logs24h } = await supabase
        .from('ai_notification_log')
        .select('channel, status')
        .gte('created_at', last24h);

      // Buscar logs da última semana
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

      setMetrics({
        total24h,
        totalWeek,
        successRate,
        byChannel: { whatsapp: whatsappCount, email: emailCount },
        byStatus: { sent, failed, pending },
      });

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
      {/* Status Principal */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Status do Agente */}
        <Card className={config?.is_active ? 'border-green-500/50' : 'border-yellow-500/50'}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Status do Agente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${config?.is_active ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                <span className="text-xl font-bold">
                  {config?.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <Button 
                size="sm" 
                variant={config?.is_active ? 'destructive' : 'default'}
                onClick={handleToggle}
                disabled={toggling}
              >
                {toggling ? 'Aguarde...' : (config?.is_active ? 'Desativar' : 'Ativar')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Status */}
        <Card className={whatsappStatus.connected ? 'border-green-500/50' : 'border-red-500/50'}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              {whatsappStatus.connected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={whatsappStatus.connected ? 'default' : 'destructive'}>
                {whatsappStatus.connected ? 'Conectado' : 'Desconectado'}
              </Badge>
              {whatsappStatus.phoneNumber && (
                <span className="text-sm text-muted-foreground">
                  {whatsappStatus.phoneNumber}
                </span>
              )}
            </div>
            {!whatsappStatus.connected && config?.whatsapp_enabled && (
              <p className="text-xs text-muted-foreground mt-2">
                Configure em Configurações WhatsApp
              </p>
            )}
          </CardContent>
        </Card>

        {/* Notificações 24h */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Últimas 24h
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.total24h || 0}</div>
            <p className="text-xs text-muted-foreground">notificações enviadas</p>
          </CardContent>
        </Card>

        {/* Taxa de Sucesso */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Taxa de Sucesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {metrics?.successRate.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">última semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Detalhes */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Por Canal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Por Canal (7 dias)
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
              <span className="text-2xl font-bold">{metrics?.byChannel.whatsapp || 0}</span>
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
              <span className="text-2xl font-bold">{metrics?.byChannel.email || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Por Status */}
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
              <span className="text-xl font-bold text-green-600">{metrics?.byStatus.sent || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-red-500" />
                <span>Falhas</span>
              </div>
              <span className="text-xl font-bold text-red-600">{metrics?.byStatus.failed || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span>Pendentes</span>
              </div>
              <span className="text-xl font-bold text-yellow-600">{metrics?.byStatus.pending || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botão Atualizar */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={loadMetrics} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Métricas
        </Button>
      </div>
    </div>
  );
}
