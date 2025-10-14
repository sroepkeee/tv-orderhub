import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/components/Dashboard";
import { FileText, CheckCircle, XCircle } from "lucide-react";

interface OrderTotvsMetricsProps {
  orders: Order[];
}

export const OrderTotvsMetrics = ({ orders }: OrderTotvsMetricsProps) => {
  const ordersWithTotvs = orders.filter(o => o.totvsOrderNumber);
  const ordersWithoutTotvs = orders.filter(o => !o.totvsOrderNumber);
  
  const percentageWithTotvs = orders.length > 0 
    ? Math.round((ordersWithTotvs.length / orders.length) * 100)
    : 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Integração TOTVS
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{orders.length}</div>
              <div className="text-xs text-muted-foreground">Total de Pedidos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[hsl(var(--progress-good))]">
                {ordersWithTotvs.length}
              </div>
              <div className="text-xs text-muted-foreground">Com Nº TOTVS</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[hsl(var(--progress-warning))]">
                {ordersWithoutTotvs.length}
              </div>
              <div className="text-xs text-muted-foreground">Sem Nº TOTVS</div>
            </div>
          </div>
          
          {/* Barra de Progresso Visual */}
          <div>
            <div className="flex justify-between mb-2 text-sm">
              <span className="font-medium">Taxa de Integração</span>
              <span className="font-bold">{percentageWithTotvs}%</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-500"
                style={{
                  width: `${percentageWithTotvs}%`,
                  background: percentageWithTotvs >= 80 
                    ? 'hsl(var(--progress-good))' 
                    : percentageWithTotvs >= 50 
                    ? 'hsl(var(--progress-warning))' 
                    : 'hsl(var(--progress-critical))'
                }}
              />
            </div>
          </div>
          
          {/* Lista de Pedidos Recentes sem TOTVS */}
          {ordersWithoutTotvs.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="h-4 w-4 text-[hsl(var(--destructive))]" />
                <span className="text-sm font-semibold">
                  Pedidos Pendentes de Integração ({ordersWithoutTotvs.length})
                </span>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {ordersWithoutTotvs.slice(0, 10).map(order => (
                  <div 
                    key={order.id} 
                    className="flex justify-between items-center text-sm py-2 px-3 bg-muted/50 rounded-md"
                  >
                    <span className="font-medium">{order.orderNumber}</span>
                    <Badge variant="outline" className="text-xs">
                      {order.client}
                    </Badge>
                  </div>
                ))}
                {ordersWithoutTotvs.length > 10 && (
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    + {ordersWithoutTotvs.length - 10} outros pedidos
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Mensagem de Sucesso se todos têm TOTVS */}
          {ordersWithoutTotvs.length === 0 && orders.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 text-[hsl(var(--progress-good))] text-sm">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">
                  Todos os pedidos estão integrados com TOTVS
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
