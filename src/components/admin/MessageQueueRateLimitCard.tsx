import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RateLimitConfig {
  maxPerMinute: number;
  maxPerHour: number;
  delayBetweenMs: number;
  sendWindowStart: string | null;
  sendWindowEnd: string | null;
  respectSendWindow: boolean;
}

interface RateLimitUsage {
  lastMinute: number;
  lastHour: number;
  avgDelayMs: number;
}

interface MessageQueueRateLimitCardProps {
  messages: Array<{ status: string; sent_at: string | null; created_at: string }>;
}

export function MessageQueueRateLimitCard({ messages }: MessageQueueRateLimitCardProps) {
  const [config, setConfig] = useState<RateLimitConfig>({
    maxPerMinute: 15,
    maxPerHour: 200,
    delayBetweenMs: 3000,
    sendWindowStart: '08:00',
    sendWindowEnd: '20:00',
    respectSendWindow: true,
  });

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from('ai_agent_config')
        .select('max_messages_per_minute, max_messages_per_hour, delay_between_messages_ms, send_window_start, send_window_end, respect_send_window')
        .limit(1)
        .single();

      if (data) {
        setConfig({
          maxPerMinute: data.max_messages_per_minute || 15,
          maxPerHour: data.max_messages_per_hour || 200,
          delayBetweenMs: data.delay_between_messages_ms || 3000,
          sendWindowStart: data.send_window_start,
          sendWindowEnd: data.send_window_end,
          respectSendWindow: data.respect_send_window ?? true,
        });
      }
    };

    fetchConfig();
  }, []);

  // Calculate usage from sent messages
  const usage: RateLimitUsage = (() => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const sentMessages = messages.filter(m => m.status === 'sent' && m.sent_at);
    
    const lastMinute = sentMessages.filter(m => 
      new Date(m.sent_at!) >= oneMinuteAgo
    ).length;

    const lastHour = sentMessages.filter(m => 
      new Date(m.sent_at!) >= oneHourAgo
    ).length;

    // Calculate average delay between messages
    const sortedSent = sentMessages
      .filter(m => new Date(m.sent_at!) >= oneHourAgo)
      .sort((a, b) => new Date(a.sent_at!).getTime() - new Date(b.sent_at!).getTime());

    let totalDelay = 0;
    let delayCount = 0;
    for (let i = 1; i < sortedSent.length; i++) {
      const delay = new Date(sortedSent[i].sent_at!).getTime() - new Date(sortedSent[i-1].sent_at!).getTime();
      if (delay < 60000) { // Only count delays less than 1 minute
        totalDelay += delay;
        delayCount++;
      }
    }

    return {
      lastMinute,
      lastHour,
      avgDelayMs: delayCount > 0 ? Math.round(totalDelay / delayCount) : 0,
    };
  })();

  const minutePercent = Math.min(100, (usage.lastMinute / config.maxPerMinute) * 100);
  const hourPercent = Math.min(100, (usage.lastHour / config.maxPerHour) * 100);

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-red-500';
    if (percent >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const isNearLimit = minutePercent >= 80 || hourPercent >= 80;

  // Check if we're in send window
  const isInSendWindow = (() => {
    if (!config.respectSendWindow || !config.sendWindowStart || !config.sendWindowEnd) {
      return true;
    }
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return currentTime >= config.sendWindowStart && currentTime <= config.sendWindowEnd;
  })();

  return (
    <div className="space-y-4">
      {isNearLimit && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            ⚠️ <strong>Atenção:</strong> Você está próximo do limite de mensagens. 
            Taxa atual: {Math.round(Math.max(minutePercent, hourPercent))}% do limite.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Rate per Minute */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              Taxa por Minuto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">{usage.lastMinute}</span>
              <span className="text-sm text-muted-foreground">/ {config.maxPerMinute}</span>
            </div>
            <Progress value={minutePercent} className={`h-2 ${getProgressColor(minutePercent)}`} />
            <p className="text-xs text-muted-foreground">
              {Math.round(minutePercent)}% do limite
            </p>
          </CardContent>
        </Card>

        {/* Rate per Hour */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Taxa por Hora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">{usage.lastHour}</span>
              <span className="text-sm text-muted-foreground">/ {config.maxPerHour}</span>
            </div>
            <Progress value={hourPercent} className={`h-2 ${getProgressColor(hourPercent)}`} />
            <p className="text-xs text-muted-foreground">
              {Math.round(hourPercent)}% do limite
            </p>
          </CardContent>
        </Card>

        {/* Config Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Configuração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Delay:</span>
              <Badge variant="outline">{(config.delayBetweenMs / 1000).toFixed(1)}s</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Delay médio:</span>
              <Badge variant={usage.avgDelayMs >= config.delayBetweenMs ? "default" : "destructive"}>
                {usage.avgDelayMs > 0 ? `${(usage.avgDelayMs / 1000).toFixed(1)}s` : 'N/A'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Janela:</span>
              <Badge variant={isInSendWindow ? "default" : "secondary"}>
                {config.respectSendWindow 
                  ? `${config.sendWindowStart} - ${config.sendWindowEnd}`
                  : '24h'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
