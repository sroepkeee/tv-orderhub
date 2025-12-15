import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Truck, 
  MessageSquare, 
  Clock, 
  RefreshCw, 
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QuoteMetrics {
  totalSent: number;
  totalResponded: number;
  totalPending: number;
  avgResponseTime: number;
}

interface RecentQuote {
  id: string;
  carrier_name: string;
  order_number: string;
  status: string;
  created_at: string;
  response_received_at: string | null;
}

export function AIAgentQuoteTab() {
  const [metrics, setMetrics] = useState<QuoteMetrics | null>(null);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
    autoRetry: true,
    retryCount: 3,
    expirationHours: 48,
    messageTemplate: `Olá! Somos da IMPLY e gostaríamos de solicitar cotação de frete para o seguinte pedido:

📦 *Pedido:* {{order_number}}
📍 *Destino:* {{destination}}
⚖️ *Peso:* {{weight}} kg
📐 *Dimensões:* {{dimensions}}

Aguardamos seu retorno com valores e prazo de entrega.

Obrigado!`
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const last7Days = subDays(new Date(), 7).toISOString();

      // Buscar cotações recentes
      const { data: quotes } = await supabase
        .from('freight_quotes')
        .select(`
          id,
          status,
          created_at,
          response_received_at,
          carriers!inner(name),
          orders!inner(order_number)
        `)
        .gte('created_at', last7Days)
        .order('created_at', { ascending: false })
        .limit(10);

      if (quotes) {
        setRecentQuotes(quotes.map((q: any) => ({
          id: q.id,
          carrier_name: q.carriers?.name || 'Desconhecido',
          order_number: q.orders?.order_number || 'N/A',
          status: q.status,
          created_at: q.created_at,
          response_received_at: q.response_received_at
        })));

        // Calcular métricas
        const sent = quotes.length;
        const responded = quotes.filter((q: any) => q.status === 'responded').length;
        const pending = quotes.filter((q: any) => q.status === 'sent' || q.status === 'pending').length;
        
        // Calcular tempo médio de resposta
        const respondedQuotes = quotes.filter((q: any) => q.response_received_at);
        let avgTime = 0;
        if (respondedQuotes.length > 0) {
          const totalTime = respondedQuotes.reduce((sum: number, q: any) => {
            const sent = new Date(q.created_at).getTime();
            const received = new Date(q.response_received_at).getTime();
            return sum + (received - sent);
          }, 0);
          avgTime = totalTime / respondedQuotes.length / (1000 * 60 * 60); // em horas
        }

        setMetrics({
          totalSent: sent,
          totalResponded: responded,
          totalPending: pending,
          avgResponseTime: avgTime
        });
      }
    } catch (error) {
      console.error('Error loading quote data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'responded':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Respondido</Badge>;
      case 'sent':
        return <Badge variant="secondary"><Send className="h-3 w-3 mr-1" />Enviado</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'expired':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
          <Truck className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold">Agente de Cotação de Frete</h3>
          <p className="text-sm text-muted-foreground">
            Gerencia comunicação com transportadoras para cotações de frete
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Enviadas (7 dias)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.totalSent || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Respondidas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{metrics?.totalResponded || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pendentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{metrics?.totalPending || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tempo Médio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {metrics?.avgResponseTime.toFixed(1) || 0}h
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações do Agente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Reenvio Automático</Label>
              <p className="text-sm text-muted-foreground">
                Reenviar cotação se não houver resposta
              </p>
            </div>
            <Switch 
              checked={config.autoRetry}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoRetry: checked }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tentativas de Reenvio</Label>
              <Input 
                type="number" 
                value={config.retryCount}
                onChange={(e) => setConfig(prev => ({ ...prev, retryCount: parseInt(e.target.value) }))}
                min={1}
                max={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Expiração (horas)</Label>
              <Input 
                type="number" 
                value={config.expirationHours}
                onChange={(e) => setConfig(prev => ({ ...prev, expirationHours: parseInt(e.target.value) }))}
                min={24}
                max={168}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Template */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Template de Mensagem
          </CardTitle>
          <CardDescription>
            Modelo usado para solicitar cotações às transportadoras
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            value={config.messageTemplate}
            onChange={(e) => setConfig(prev => ({ ...prev, messageTemplate: e.target.value }))}
            rows={10}
            className="font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{"{{order_number}}"}</Badge>
            <Badge variant="outline">{"{{destination}}"}</Badge>
            <Badge variant="outline">{"{{weight}}"}</Badge>
            <Badge variant="outline">{"{{dimensions}}"}</Badge>
            <Badge variant="outline">{"{{customer_name}}"}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Recent Quotes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Cotações Recentes
            </CardTitle>
            <CardDescription>Últimas 10 cotações enviadas</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentQuotes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma cotação recente
              </p>
            ) : (
              recentQuotes.map((quote) => (
                <div 
                  key={quote.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{quote.carrier_name}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">{quote.order_number}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(quote.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {getStatusBadge(quote.status)}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
