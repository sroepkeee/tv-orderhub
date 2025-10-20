import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Clock, Package } from "lucide-react";
import type { Order } from "@/components/Dashboard";

interface BottleneckAnalysisProps {
  orders: Order[];
}

interface Bottleneck {
  phase: string;
  severity: 'critical' | 'high' | 'medium';
  orderCount: number;
  avgDays: number;
  suggestion: string;
}

export function BottleneckAnalysis({ orders }: BottleneckAnalysisProps) {
  const phaseConfig = [
    { key: 'almox_ssm', name: 'Almox SSM', statuses: ['almox_ssm_received', 'almox_ssm_in_review', 'almox_ssm_approved'], threshold: 2 },
    { key: 'order_generation', name: 'Gerar Ordem', statuses: ['order_generation_pending', 'order_in_creation', 'order_generated'], threshold: 1 },
    { key: 'almox_general', name: 'Almox Geral', statuses: ['almox_general_received', 'almox_general_separating', 'almox_general_ready'], threshold: 2 },
    { key: 'production', name: 'Produção', statuses: ['separation_started', 'in_production', 'awaiting_material', 'separation_completed', 'production_completed'], threshold: 5 },
    { key: 'balance_generation', name: 'Gerar Saldo', statuses: ['balance_calculation', 'balance_review', 'balance_approved'], threshold: 1 },
    { key: 'laboratory', name: 'Laboratório', statuses: ['awaiting_lab', 'in_lab_analysis', 'lab_completed'], threshold: 3 },
    { key: 'packaging', name: 'Embalagem', statuses: ['in_quality_check', 'in_packaging', 'ready_for_shipping'], threshold: 2 },
    { key: 'freight_quote', name: 'Cotação Frete', statuses: ['freight_quote_requested', 'freight_quote_received', 'freight_approved'], threshold: 2 },
    { key: 'invoicing', name: 'Faturamento', statuses: ['awaiting_invoice', 'invoice_issued', 'invoice_sent'], threshold: 2 },
    { key: 'logistics', name: 'Expedição', statuses: ['released_for_shipping', 'in_expedition', 'in_transit', 'pickup_scheduled', 'awaiting_pickup', 'collected'], threshold: 3 },
  ];

  const identifyBottlenecks = (): Bottleneck[] => {
    const bottlenecks: Bottleneck[] = [];

    phaseConfig.forEach(phase => {
      const ordersInPhase = orders.filter(o => phase.statuses.includes(o.status));
      const orderCount = ordersInPhase.length;

      if (orderCount === 0) return;

      const avgDays = Math.round(ordersInPhase.reduce((sum, o) => sum + (o.daysOpen || 0), 0) / orderCount / 5);

      // Determinar severidade baseada em threshold e volume
      let severity: 'critical' | 'high' | 'medium' = 'medium';
      let suggestion = '';

      if (avgDays > phase.threshold * 2 && orderCount > 10) {
        severity = 'critical';
        suggestion = `CRÍTICO: ${orderCount} pedidos acumulados com ${avgDays} dias médio. Considere aumentar recursos ou redistribuir tarefas.`;
      } else if (avgDays > phase.threshold * 1.5 || orderCount > 15) {
        severity = 'high';
        suggestion = `ALTO: Fase com sobrecarga. ${orderCount} pedidos aguardando processamento. Revisar alocação de equipe.`;
      } else if (avgDays > phase.threshold || orderCount > 8) {
        severity = 'medium';
        suggestion = `MÉDIO: Atenção necessária. Monitorar evolução para evitar gargalo maior.`;
      }

      if (avgDays > phase.threshold || orderCount > 8) {
        bottlenecks.push({
          phase: phase.name,
          severity,
          orderCount,
          avgDays,
          suggestion,
        });
      }
    });

    return bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 3, high: 2, medium: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  };

  const bottlenecks = identifyBottlenecks();

  const getSeverityVariant = (severity: string) => {
    if (severity === 'critical') return 'destructive';
    if (severity === 'high') return 'default';
    return 'secondary';
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'critical') return <AlertTriangle className="h-5 w-5" />;
    if (severity === 'high') return <TrendingDown className="h-5 w-5" />;
    return <Clock className="h-5 w-5" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Análise de Gargalos
        </CardTitle>
        <CardDescription>
          Identificação automática de fases críticas e sugestões de ação
        </CardDescription>
      </CardHeader>
      <CardContent>
        {bottlenecks.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sem gargalos críticos detectados</AlertTitle>
            <AlertDescription>
              O fluxo de pedidos está equilibrado. Continue monitorando para manter a eficiência.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {bottlenecks.map((bottleneck, idx) => (
              <Alert key={idx} variant={getSeverityVariant(bottleneck.severity) as any}>
                <div className="flex items-start gap-3">
                  {getSeverityIcon(bottleneck.severity)}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <AlertTitle className="text-base">{bottleneck.phase}</AlertTitle>
                      <Badge variant={getSeverityVariant(bottleneck.severity) as any}>
                        {bottleneck.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>{bottleneck.orderCount} pedidos acumulados</span>
                      <span>Tempo médio: {bottleneck.avgDays} dias</span>
                    </div>
                    <AlertDescription className="text-sm">
                      {bottleneck.suggestion}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
