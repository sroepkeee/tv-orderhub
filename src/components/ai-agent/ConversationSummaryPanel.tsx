import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Target,
  AlertCircle,
  RefreshCw,
  Smile,
  Meh,
  Frown,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ConversationSummary {
  sentiment: 'positive' | 'neutral' | 'negative' | 'critical';
  score: number;
  summary: string;
  topics: string[];
  pending_actions: string[];
  message_count: number;
  inbound_count: number;
  outbound_count: number;
  last_interaction: string | null;
}

interface Props {
  carrierId: string;
  contactName: string;
  onClose?: () => void;
}

export function ConversationSummaryPanel({ carrierId, contactName, onClose }: Props) {
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-agent-conversation-summary', {
        body: { carrierId, contactName }
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setSummary(data);
    } catch (err: any) {
      console.error('Error loading summary:', err);
      setError(err.message || 'Erro ao carregar resumo');
      toast.error('Erro ao gerar resumo da conversa');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentConfig = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return { 
          icon: Smile, 
          label: 'Positivo', 
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-950/30',
          border: 'border-green-200 dark:border-green-800'
        };
      case 'negative':
        return { 
          icon: Frown, 
          label: 'Negativo', 
          color: 'text-orange-600 dark:text-orange-400',
          bg: 'bg-orange-50 dark:bg-orange-950/30',
          border: 'border-orange-200 dark:border-orange-800'
        };
      case 'critical':
        return { 
          icon: AlertTriangle, 
          label: 'Crítico', 
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-950/30',
          border: 'border-red-200 dark:border-red-800'
        };
      default:
        return { 
          icon: Meh, 
          label: 'Neutro', 
          color: 'text-muted-foreground',
          bg: 'bg-muted/30',
          border: 'border-border'
        };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400';
    if (score >= 5) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Initial state - show button to generate
  if (!summary && !loading && !error) {
    return (
      <div className="p-6 text-center">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="font-medium mb-2">Resumo IA</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Gere um resumo inteligente desta conversa com análise de sentimento
        </p>
        <Button onClick={loadSummary} className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Gerar Resumo
        </Button>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-center gap-2 py-4">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Analisando conversa...</span>
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={loadSummary} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!summary) return null;

  const sentimentConfig = getSentimentConfig(summary.sentiment);
  const SentimentIcon = sentimentConfig.icon;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header with refresh */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Resumo IA
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadSummary}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Sentiment & Score Card */}
        <div className={`p-4 rounded-lg border ${sentimentConfig.bg} ${sentimentConfig.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SentimentIcon className={`h-5 w-5 ${sentimentConfig.color}`} />
              <span className={`font-medium ${sentimentConfig.color}`}>
                {sentimentConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-2xl font-bold ${getScoreColor(summary.score)}`}>
                {summary.score}
              </span>
              <span className="text-sm text-muted-foreground">/10</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <MessageSquare className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-semibold">{summary.message_count}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <ArrowUpRight className="h-4 w-4 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-semibold">{summary.outbound_count}</p>
            <p className="text-[10px] text-muted-foreground">Enviadas</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <ArrowDownLeft className="h-4 w-4 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-semibold">{summary.inbound_count}</p>
            <p className="text-[10px] text-muted-foreground">Recebidas</p>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Resumo
          </h4>
          <p className="text-sm leading-relaxed">{summary.summary}</p>
        </div>

        {/* Topics */}
        {summary.topics && summary.topics.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Target className="h-3 w-3" />
              Tópicos
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {summary.topics.map((topic, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Pending Actions */}
        {summary.pending_actions && summary.pending_actions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Ações Pendentes
            </h4>
            <ul className="space-y-1">
              {summary.pending_actions.map((action, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Last Interaction */}
        {summary.last_interaction && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Última interação: {formatDistanceToNow(new Date(summary.last_interaction), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
