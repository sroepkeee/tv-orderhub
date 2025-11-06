import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import type { Order } from "@/components/Dashboard";

interface PhasePerformanceMetricsProps {
  orders: Order[];
}

interface PhaseMetric {
  phaseName: string;
  avgDays: number;
  orderCount: number;
  throughput: number;
  isBottleneck: boolean;
}

export function PhasePerformanceMetrics({ orders }: PhasePerformanceMetricsProps) {
  const phaseConfig = [
    { key: 'almox_ssm', name: 'Almox SSM', statuses: ['almox_ssm_received', 'almox_ssm_in_review', 'almox_ssm_approved'] },
    { key: 'order_generation', name: 'Gerar Ordem', statuses: ['order_generation_pending', 'order_in_creation', 'order_generated'] },
    { key: 'almox_general', name: 'Almox Geral', statuses: ['almox_general_received', 'almox_general_separating', 'almox_general_ready'] },
    { key: 'production', name: 'Produção', statuses: ['separation_started', 'in_production', 'awaiting_material', 'separation_completed', 'production_completed'] },
    { key: 'balance_generation', name: 'Gerar Saldo', statuses: ['balance_calculation', 'balance_review', 'balance_approved'] },
    { key: 'laboratory', name: 'Laboratório', statuses: ['awaiting_lab', 'in_lab_analysis', 'lab_completed'] },
    { key: 'packaging', name: 'Embalagem', statuses: ['in_quality_check', 'in_packaging', 'ready_for_shipping'] },
    { key: 'freight_quote', name: 'Cotação Frete', statuses: ['freight_quote_requested', 'freight_quote_received', 'freight_approved'] },
    { key: 'ready_to_invoice', name: 'À Faturar', statuses: ['ready_to_invoice', 'pending_invoice_request'] },
    { key: 'invoicing', name: 'Solicitado Faturamento', statuses: ['invoice_requested', 'awaiting_invoice', 'invoice_issued', 'invoice_sent'] },
    { key: 'logistics', name: 'Expedição', statuses: ['released_for_shipping', 'in_expedition', 'in_transit', 'pickup_scheduled', 'awaiting_pickup', 'collected'] },
  ];

  const calculatePhaseMetrics = (): PhaseMetric[] => {
    const metrics: PhaseMetric[] = [];

    phaseConfig.forEach(phase => {
      const ordersInPhase = orders.filter(o => phase.statuses.includes(o.status));
      const orderCount = ordersInPhase.length;

      // Calcular tempo médio (simulado com base em daysOpen)
      const avgDays = orderCount > 0 
        ? Math.round(ordersInPhase.reduce((sum, o) => sum + (o.daysOpen || 0), 0) / orderCount / 5) 
        : 0;

      // Throughput: pedidos por dia (últimos 30 dias)
      const throughput = orderCount > 0 ? Number((orderCount / 30).toFixed(1)) : 0;

      metrics.push({
        phaseName: phase.name,
        avgDays,
        orderCount,
        throughput,
        isBottleneck: avgDays > 3 && orderCount > 5,
      });
    });

    return metrics.sort((a, b) => b.avgDays - a.avgDays);
  };

  const metrics = calculatePhaseMetrics();
  const maxAvgDays = Math.max(...metrics.map(m => m.avgDays), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Desempenho por Fase
        </CardTitle>
        <CardDescription>
          Tempo médio, volume e throughput de cada fase do processo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div key={metric.phaseName} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{metric.phaseName}</span>
                  {metric.isBottleneck && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Gargalo
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{metric.orderCount} pedidos</span>
                  <span>{metric.avgDays} dias médio</span>
                  <span>{metric.throughput} ped/dia</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    metric.isBottleneck ? 'bg-destructive' : 'bg-primary'
                  }`}
                  style={{ width: `${(metric.avgDays / maxAvgDays) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
