import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Order } from "@/components/Dashboard";
import { calculateAverageProductionTime, calculateOnTimeRate } from "@/lib/metrics";

interface ProductionMetricsProps {
  orders: Order[];
}

export const ProductionMetrics = ({ orders }: ProductionMetricsProps) => {
  const productionOrders = orders.filter(o => 
    ['in_production', 'separation_started', 'production_completed'].includes(o.status)
  );
  
  const avgProductionTime = calculateAverageProductionTime(orders);
  const onTimeRate = calculateOnTimeRate(orders, 10);
  
  const getTimeStatus = (days: number) => {
    if (days <= 10) return { color: 'hsl(var(--progress-good))', label: '✓ Dentro da Meta' };
    if (days <= 12) return { color: 'hsl(var(--progress-warning))', label: '⚠ Atenção' };
    return { color: 'hsl(var(--progress-critical))', label: '✗ Fora da Meta' };
  };
  
  const timeStatus = getTimeStatus(avgProductionTime);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🏭 Indicadores de Produção
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Tempo Médio SSM */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Tempo Médio Fábrica → SSM</span>
              <span className="text-sm font-bold" style={{ color: timeStatus.color }}>
                {avgProductionTime} dias
              </span>
            </div>
            <Progress 
              value={Math.min(100, (10 / avgProductionTime) * 100)} 
              className="h-2"
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-muted-foreground">Meta: 10 dias</p>
              <p className="text-xs font-medium" style={{ color: timeStatus.color }}>
                {timeStatus.label}
              </p>
            </div>
          </div>
          
          {/* Taxa de Cumprimento */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Taxa de Cumprimento de Prazo</span>
              <span className="text-sm font-bold">{onTimeRate}%</span>
            </div>
            <Progress 
              value={onTimeRate} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Pedidos entregues no prazo
            </p>
          </div>
          
          {/* Pedidos em Produção */}
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Pedidos em Produção</span>
              <span className="text-2xl font-bold text-primary">{productionOrders.length}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
