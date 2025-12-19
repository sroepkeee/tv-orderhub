import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Package,
  Clock,
  DollarSign,
  Zap,
  Send,
  Bot,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Minus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ManagerMetrics {
  onTimeRate: number;
  activeOrders: number;
  onTimeCount: number;
  criticalCount: number;
  overdueCount: number;
  overdueValue: number;
  totalValue: number;
  phaseMetrics: Array<{
    phase: string;
    count: number;
    avgDays: number;
    threshold: number;
    isBottleneck: boolean;
  }>;
  weeklyTrend: {
    newOrdersThisWeek: number;
    newOrdersLastWeek: number;
    newOrdersChange: number;
    deliveredThisWeek: number;
    deliveredLastWeek: number;
    deliveredChange: number;
    valueThisWeek: number;
    valueLastWeek: number;
    valueChange: number;
  };
  criticalAlerts: Array<{
    type: string;
    count: number;
    severity: 'critical' | 'warning' | 'info';
    details: string;
  }>;
  topOrders: Array<{
    orderNumber: string;
    customerName: string;
    value: number;
    deliveryDate: string;
    status: string;
    daysUntilDelivery: number;
  }>;
  calculatedAt: string;
}

export function ManagerAgentDashboard() {
  const [metrics, setMetrics] = useState<ManagerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingAlerts, setSendingAlerts] = useState(false);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manager-metrics');
      
      if (error) throw error;
      
      if (data?.success && data?.metrics) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
      toast.error('Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  };

  const sendSmartAlerts = async () => {
    setSendingAlerts(true);
    try {
      const { data, error } = await supabase.functions.invoke('manager-smart-alerts');
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`${data.messagesQueued || 0} alertas enviados para a fila`);
      } else {
        toast.info('Nenhum alerta para enviar');
      }
    } catch (error) {
      console.error('Error sending alerts:', error);
      toast.error('Erro ao enviar alertas');
    } finally {
      setSendingAlerts(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getPhaseEmoji = (phase: string) => {
    const emojis: Record<string, string> = {
      'Produção': '🔧',
      'Laboratório': '🔬',
      'Embalagem': '📦',
      'Faturamento': '💳',
      'Expedição': '📤',
      'Cotação': '💰',
      'Transporte': '🚛',
    };
    return emojis[phase] || '📋';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Agente Gerencial
          </h2>
          <p className="text-muted-foreground">
            Dashboard de métricas e alertas inteligentes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadMetrics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={sendSmartAlerts} disabled={sendingAlerts}>
            <Send className={`h-4 w-4 mr-2 ${sendingAlerts ? 'animate-pulse' : ''}`} />
            Enviar Alertas
          </Button>
        </div>
      </div>

      {metrics && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="phases">Por Fase</TabsTrigger>
            <TabsTrigger value="trends">Tendências</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
            <TabsTrigger value="top-orders">Top Pedidos</TabsTrigger>
          </TabsList>

          {/* VISÃO GERAL */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Taxa no Prazo</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.onTimeRate}%</div>
                  <Progress value={metrics.onTimeRate} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.onTimeCount} de {metrics.activeOrders} pedidos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pedidos Ativos</CardTitle>
                  <Package className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.activeOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(metrics.totalValue)} valor total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{metrics.overdueCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(metrics.overdueValue)} em risco
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Críticos (48h)</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{metrics.criticalCount}</div>
                  <p className="text-xs text-muted-foreground">
                    Vencem em até 2 dias
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Alertas Resumidos */}
            {metrics.criticalAlerts.length > 0 && (
              <Card className="border-yellow-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Alertas Ativos ({metrics.criticalAlerts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {metrics.criticalAlerts.map((alert, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <Badge variant={
                          alert.severity === 'critical' ? 'destructive' : 
                          alert.severity === 'warning' ? 'secondary' : 'outline'
                        }>
                          {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}
                        </Badge>
                        <span className="text-sm flex-1">{alert.details}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* POR FASE */}
          <TabsContent value="phases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Fase</CardTitle>
                <CardDescription>Pedidos em cada etapa do processo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.phaseMetrics.map((phase, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span>{getPhaseEmoji(phase.phase)}</span>
                          <span className="font-medium">{phase.phase}</span>
                          {phase.isBottleneck && (
                            <Badge variant="destructive" className="text-xs">Gargalo</Badge>
                          )}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {phase.count} pedidos • ~{phase.avgDays} dias
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={Math.min((phase.avgDays / phase.threshold) * 100, 100)} 
                          className={phase.isBottleneck ? 'bg-red-100' : ''}
                        />
                        <span className="text-xs text-muted-foreground w-20">
                          Limite: {phase.threshold}d
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TENDÊNCIAS */}
          <TabsContent value="trends" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Novos Pedidos
                    {getTrendIcon(metrics.weeklyTrend.newOrdersChange)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.weeklyTrend.newOrdersThisWeek}</div>
                  <p className="text-xs text-muted-foreground">
                    vs {metrics.weeklyTrend.newOrdersLastWeek} semana anterior
                  </p>
                  <Badge 
                    variant={metrics.weeklyTrend.newOrdersChange >= 0 ? 'secondary' : 'destructive'}
                    className="mt-2"
                  >
                    {metrics.weeklyTrend.newOrdersChange >= 0 ? '+' : ''}{metrics.weeklyTrend.newOrdersChange}%
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Entregas
                    {getTrendIcon(metrics.weeklyTrend.deliveredChange)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.weeklyTrend.deliveredThisWeek}</div>
                  <p className="text-xs text-muted-foreground">
                    vs {metrics.weeklyTrend.deliveredLastWeek} semana anterior
                  </p>
                  <Badge 
                    variant={metrics.weeklyTrend.deliveredChange >= 0 ? 'secondary' : 'destructive'}
                    className="mt-2"
                  >
                    {metrics.weeklyTrend.deliveredChange >= 0 ? '+' : ''}{metrics.weeklyTrend.deliveredChange}%
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Valor em Carteira
                    {getTrendIcon(metrics.weeklyTrend.valueChange)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(metrics.weeklyTrend.valueThisWeek)}</div>
                  <p className="text-xs text-muted-foreground">
                    vs {formatCurrency(metrics.weeklyTrend.valueLastWeek)} semana anterior
                  </p>
                  <Badge 
                    variant={metrics.weeklyTrend.valueChange >= 0 ? 'secondary' : 'destructive'}
                    className="mt-2"
                  >
                    {metrics.weeklyTrend.valueChange >= 0 ? '+' : ''}{metrics.weeklyTrend.valueChange}%
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ALERTAS */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Sistema de Alertas Inteligentes
                </CardTitle>
                <CardDescription>
                  Alertas são enviados automaticamente para gestores via WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.criticalAlerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>Nenhum alerta ativo no momento!</p>
                    <p className="text-sm">Todos os indicadores estão normais.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {metrics.criticalAlerts.map((alert, idx) => (
                        <div 
                          key={idx} 
                          className={`p-4 rounded-lg border ${
                            alert.severity === 'critical' ? 'border-red-500 bg-red-500/10' :
                            alert.severity === 'warning' ? 'border-yellow-500 bg-yellow-500/10' :
                            'border-blue-500 bg-blue-500/10'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant={
                              alert.severity === 'critical' ? 'destructive' : 
                              alert.severity === 'warning' ? 'secondary' : 'outline'
                            }>
                              {alert.type.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <span className="text-sm font-medium">
                              {alert.count} {alert.count === 1 ? 'item' : 'itens'}
                            </span>
                          </div>
                          <p className="text-sm">{alert.details}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                <div className="mt-4 pt-4 border-t">
                  <Button onClick={sendSmartAlerts} disabled={sendingAlerts} className="w-full">
                    <Send className={`h-4 w-4 mr-2 ${sendingAlerts ? 'animate-pulse' : ''}`} />
                    {sendingAlerts ? 'Enviando...' : 'Enviar Alertas Agora'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TOP PEDIDOS */}
          <TabsContent value="top-orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Top 10 Pedidos por Valor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {metrics.topOrders.map((order, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-medium">#{order.orderNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.customerName.substring(0, 30)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(order.value)}</p>
                          <div className="flex items-center gap-1">
                            {order.daysUntilDelivery < 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                {Math.abs(order.daysUntilDelivery)}d atraso
                              </Badge>
                            ) : order.daysUntilDelivery <= 2 ? (
                              <Badge variant="secondary" className="text-xs">
                                {order.daysUntilDelivery}d
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {order.daysUntilDelivery}d
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Footer com última atualização */}
      {metrics?.calculatedAt && (
        <p className="text-xs text-muted-foreground text-center">
          Última atualização: {new Date(metrics.calculatedAt).toLocaleString('pt-BR')}
        </p>
      )}
    </div>
  );
}
