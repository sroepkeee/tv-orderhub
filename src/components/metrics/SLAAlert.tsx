import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import type { Order } from "@/components/Dashboard";

interface SLAAlertProps {
  orders: Order[];
  threshold?: number; // dias antes do prazo para alerta
}

export const SLAAlert = ({ orders, threshold = 2 }: SLAAlertProps) => {
  const criticalOrders = orders.filter(o => {
    if (o.status === 'completed' || o.status === 'delivered' || o.status === 'cancelled') {
      return false;
    }
    
    try {
      const deadline = parseISO(o.deliveryDeadline);
      const days = differenceInDays(deadline, new Date());
      return days <= threshold && days >= 0;
    } catch {
      return false;
    }
  });
  
  if (criticalOrders.length === 0) return null;
  
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="font-bold">
        ⚠️ {criticalOrders.length} {criticalOrders.length === 1 ? 'Pedido Crítico' : 'Pedidos Críticos'}
      </AlertTitle>
      <AlertDescription>
        {criticalOrders.length === 1 
          ? 'Há um pedido com prazo vencendo em menos de 2 dias!'
          : `Há ${criticalOrders.length} pedidos com prazo vencendo em menos de 2 dias!`
        }
      </AlertDescription>
      <div className="mt-3 space-y-1">
        {criticalOrders.slice(0, 5).map(order => (
          <div key={order.id} className="text-sm flex justify-between">
            <span className="font-medium">{order.orderNumber}</span>
            <span>{order.client}</span>
          </div>
        ))}
        {criticalOrders.length > 5 && (
          <div className="text-xs text-muted-foreground mt-2">
            + {criticalOrders.length - 5} outros pedidos
          </div>
        )}
      </div>
    </Alert>
  );
};
