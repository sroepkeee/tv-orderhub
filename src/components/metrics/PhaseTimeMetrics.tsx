import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Order } from "@/components/Dashboard";
import { getOrderCountByPhase, calculateAverageTimeInPhase } from "@/lib/metrics";
import { ClipboardList, Boxes, FlaskConical, Package, Truck } from "lucide-react";

interface PhaseTimeMetricsProps {
  orders: Order[];
}

export const PhaseTimeMetrics = ({ orders }: PhaseTimeMetricsProps) => {
  const phases = [
    { 
      id: 'preparation', 
      label: 'Preparação', 
      icon: ClipboardList,
      color: 'hsl(var(--status-analysis))'
    },
    { 
      id: 'production', 
      label: 'Produção', 
      icon: Boxes,
      color: 'hsl(var(--status-production))'
    },
    { 
      id: 'lab', 
      label: 'Laboratório', 
      icon: FlaskConical,
      color: 'hsl(var(--status-analysis))'
    },
    { 
      id: 'packaging', 
      label: 'Embalagem', 
      icon: Package,
      color: 'hsl(var(--status-packaging))'
    },
    { 
      id: 'logistics', 
      label: 'Logística', 
      icon: Truck,
      color: 'hsl(var(--status-transit))'
    }
  ];
  
  const totalOrders = orders.length || 1;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ⏱️ Tempo Médio por Fase
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {phases.map(phase => {
            const Icon = phase.icon;
            const avgTime = calculateAverageTimeInPhase(orders, phase.id);
            const orderCount = getOrderCountByPhase(orders, phase.id);
            const percentage = (orderCount / totalOrders) * 100;
            
            return (
              <div key={phase.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: phase.color }} />
                    <span className="text-sm font-medium">{phase.label}</span>
                  </div>
                  <div className="text-sm text-right">
                    <span className="font-bold">{avgTime}d</span>
                    <span className="text-muted-foreground ml-2">
                      ({orderCount} {orderCount === 1 ? 'pedido' : 'pedidos'})
                    </span>
                  </div>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-2"
                  style={{ 
                    // @ts-ignore
                    '--progress-background': phase.color 
                  }}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
