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
  Wifi,
  WifiOff,
  RefreshCw,
  Bot,
  Coins,
  DollarSign,
  Zap,
  BarChart3,
  Phone,
  Settings,
  Power,
  PowerOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";
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

interface WhatsAppStatus {
  connected: boolean;
  phoneNumber?: string;
  instanceName?: string;
}

interface TokenMetrics {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  byModel: Record<string, { tokens: number; calls: number }>;
  byDay: { date: string; tokens: number }[];
  totalCalls: number;
}

interface AgentInstance {
  id: string;
  instance_name: string;
  agent_type: string;
  description: string | null;
  is_active: boolean;
  whatsapp_number: string | null;
  llm_model: string | null;
  auto_reply_enabled: boolean | null;
  personality: string | null;
}

// OpenAI pricing per 1M tokens (approximate)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'default': { input: 0.50, output: 1.50 },
};

const AGENT_TYPE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  carrier: { bg: 'bg-amber-500/10', border: 'border-amber-500/50', text: 'text-amber-600', icon: '🚚' },
  customer: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-600', icon: '👤' },
  general: { bg: 'bg-purple-500/10', border: 'border-purple-500/50', text: 'text-purple-600', icon: '🤖' },
};

export function AIAgentDashboardTab() {
  const [notificationMetrics, setNotificationMetrics] = useState<NotificationMetrics | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({ connected: false });
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics | null>(null);
  const [agentInstances, setAgentInstances] = useState<AgentInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const last24h = subDays(now, 1).toISOString();
      const lastWeek = subDays(now, 7).toISOString();

      // Load agent instances
      const { data: instances } = await supabase
        .from('ai_agent_instances')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (instances) {
        setAgentInstances(instances as AgentInstance[]);
      }

      // Buscar logs de notificações
      const { data: logs24h } = await supabase
        .from('ai_notification_log')
        .select('channel, status')
        .gte('created_at', last24h);

      const { data: logsWeek } = await supabase
        .from('ai_notification_log')
        .select('channel, status, metadata, created_at')
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

      // Calculate token metrics from metadata
      let totalTokens = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      let estimatedCost = 0;
      const byModel: Record<string, { tokens: number; calls: number }> = {};
      const byDayMap: Record<string, number> = {};
      let totalCalls = 0;

      logsWeek?.forEach(log => {
        const metadata = log.metadata as Record<string, any> | null;
        if (metadata?.openai_usage || metadata?.token_usage) {
          const usage = metadata.openai_usage || metadata.token_usage;
          const model = metadata.model || usage.model || 'default';
          const prompt = usage.prompt_tokens || 0;
          const completion = usage.completion_tokens || 0;
          const total = usage.total_tokens || (prompt + completion);

          totalTokens += total;
          promptTokens += prompt;
          completionTokens += completion;
          totalCalls++;

          // Calculate cost
          const pricing = TOKEN_PRICING[model] || TOKEN_PRICING['default'];
          estimatedCost += (prompt / 1_000_000) * pricing.input + (completion / 1_000_000) * pricing.output;

          // By model
          if (!byModel[model]) {
            byModel[model] = { tokens: 0, calls: 0 };
          }
          byModel[model].tokens += total;
          byModel[model].calls++;

          // By day
          const day = format(new Date(log.created_at!), 'dd/MM');
          byDayMap[day] = (byDayMap[day] || 0) + total;
        }
      });

      // Convert byDayMap to sorted array
      const byDay = Object.entries(byDayMap)
        .map(([date, tokens]) => ({ date, tokens }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setTokenMetrics({
        totalTokens,
        promptTokens,
        completionTokens,
        estimatedCost,
        byModel,
        byDay,
        totalCalls,
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

  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
    return tokens.toString();
  };

  const getAgentTypeLabel = (type: string) => {
    switch (type) {
      case 'carrier': return 'Transportadoras';
      case 'customer': return 'Clientes';
      default: return 'Geral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Agent Instances Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agentes Cadastrados
          </h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Navigate to instances tab - this will be handled by parent
              const event = new CustomEvent('navigate-to-tab', { detail: 'instances' });
              window.dispatchEvent(event);
            }}
          >
            <Settings className="h-4 w-4 mr-2" />
            Gerenciar Agentes
          </Button>
        </div>

        {agentInstances.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhum agente cadastrado ainda.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => {
                  const event = new CustomEvent('navigate-to-tab', { detail: 'instances' });
                  window.dispatchEvent(event);
                }}
              >
                Criar Primeiro Agente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agentInstances.map((agent) => {
              const colors = AGENT_TYPE_COLORS[agent.agent_type] || AGENT_TYPE_COLORS.general;
              
              return (
                <Card 
                  key={agent.id} 
                  className={cn(
                    "relative overflow-hidden transition-all hover:shadow-md",
                    colors.border,
                    agent.is_active ? 'border-2' : 'border opacity-75'
                  )}
                >
                  {/* Status indicator bar */}
                  <div className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    agent.is_active ? 'bg-green-500' : 'bg-gray-400'
                  )} />
                  
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{colors.icon}</span>
                        <div>
                          <CardTitle className="text-base">{agent.instance_name}</CardTitle>
                          <Badge variant="outline" className={cn("text-xs mt-1", colors.text, colors.bg)}>
                            {getAgentTypeLabel(agent.agent_type)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {agent.is_active ? (
                          <Power className="h-4 w-4 text-green-500" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    {agent.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {agent.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-2">
                      {agent.whatsapp_number && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          +{agent.whatsapp_number}
                        </Badge>
                      )}
                      {agent.llm_model && (
                        <Badge variant="secondary" className="text-xs">
                          {agent.llm_model.replace('google/', '').replace('openai/', '')}
                        </Badge>
                      )}
                      {agent.auto_reply_enabled && (
                        <Badge className="text-xs bg-green-500/20 text-green-600 border-green-500/30">
                          Auto-reply
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className={cn(
                        "text-xs font-medium flex items-center gap-1",
                        agent.is_active ? 'text-green-600' : 'text-muted-foreground'
                      )}>
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          agent.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                        )} />
                        {agent.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Token Usage Card */}
      <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            Uso de Tokens (7 dias)
          </CardTitle>
          <CardDescription>Consumo de tokens com OpenAI/LLM</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Total Tokens */}
            <div className="p-4 rounded-lg bg-background/80 border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Zap className="h-4 w-4" />
                Total Tokens
              </div>
              <p className="text-3xl font-bold">{formatTokens(tokenMetrics?.totalTokens || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {tokenMetrics?.totalCalls || 0} chamadas
              </p>
            </div>

            {/* Estimated Cost */}
            <div className="p-4 rounded-lg bg-background/80 border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                Custo Estimado
              </div>
              <p className="text-3xl font-bold text-green-600">
                ${(tokenMetrics?.estimatedCost || 0).toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ~R${((tokenMetrics?.estimatedCost || 0) * 6.0).toFixed(2)}
              </p>
            </div>

            {/* Prompt vs Completion */}
            <div className="p-4 rounded-lg bg-background/80 border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <BarChart3 className="h-4 w-4" />
                Prompt / Completion
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-blue-600">
                  {formatTokens(tokenMetrics?.promptTokens || 0)}
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="text-xl font-bold text-purple-600">
                  {formatTokens(tokenMetrics?.completionTokens || 0)}
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600">
                  Input
                </Badge>
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600">
                  Output
                </Badge>
              </div>
            </div>

            {/* By Model */}
            <div className="p-4 rounded-lg bg-background/80 border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Bot className="h-4 w-4" />
                Por Modelo
              </div>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {tokenMetrics && Object.entries(tokenMetrics.byModel).length > 0 ? (
                  Object.entries(tokenMetrics.byModel)
                    .sort((a, b) => b[1].tokens - a[1].tokens)
                    .slice(0, 3)
                    .map(([model, data]) => (
                      <div key={model} className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[100px]" title={model}>
                          {model.replace('google/', '').replace('openai/', '')}
                        </span>
                        <span className="font-mono font-medium">{formatTokens(data.tokens)}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-muted-foreground">Sem dados</p>
                )}
              </div>
            </div>
          </div>

          {/* Daily Usage Bar Chart */}
          {tokenMetrics && tokenMetrics.byDay.length > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-background/80 border">
              <p className="text-sm text-muted-foreground mb-3">Uso diário de tokens</p>
              <div className="flex items-end gap-1 h-16">
                {tokenMetrics.byDay.map((day, idx) => {
                  const maxTokens = Math.max(...tokenMetrics.byDay.map(d => d.tokens));
                  const heightPercent = maxTokens > 0 ? (day.tokens / maxTokens) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-amber-500/80 rounded-t transition-all hover:bg-amber-500"
                        style={{ height: `${Math.max(heightPercent, 5)}%` }}
                        title={`${day.date}: ${formatTokens(day.tokens)} tokens`}
                      />
                      <span className="text-[10px] text-muted-foreground">{day.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
              Resumo de Notificações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-500" />
                <div>
                  <span className="font-bold">{notificationMetrics?.byChannel.whatsapp || 0}</span>
                  <span className="text-xs text-muted-foreground ml-1">WhatsApp</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-500" />
                <div>
                  <span className="font-bold">{notificationMetrics?.byChannel.email || 0}</span>
                  <span className="text-xs text-muted-foreground ml-1">E-mail</span>
                </div>
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
                  <p className="text-xs text-muted-foreground">Canal principal</p>
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
                  <p className="text-xs text-muted-foreground">Canal secundário</p>
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
