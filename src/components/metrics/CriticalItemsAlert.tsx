import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { Order } from "@/components/Dashboard";

interface CriticalItemsAlertProps {
  orders: Order[];
}

export const CriticalItemsAlert = ({ orders }: CriticalItemsAlertProps) => {
  const criticalItems = orders.flatMap(order => 
    (order.items || [])
      .filter(item => item.item_source_type === 'out_of_stock')
      .map(item => ({ 
        ...item, 
        orderNumber: order.orderNumber, 
        client: order.client 
      }))
  );
  
  if (criticalItems.length === 0) return null;
  
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>⚠️ {criticalItems.length} Itens Sem Estoque</AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-1 text-sm">
          {criticalItems.slice(0, 5).map((item, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <span className="font-medium">{item.itemCode} - {item.itemDescription}</span>
              <span className="font-mono text-xs opacity-75">
                Pedido #{item.orderNumber} ({item.client})
              </span>
            </div>
          ))}
          {criticalItems.length > 5 && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              + {criticalItems.length - 5} itens adicionais sem estoque
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
