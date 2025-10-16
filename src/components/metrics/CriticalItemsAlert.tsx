import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, X } from "lucide-react";
import type { Order } from "@/components/Dashboard";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CriticalItemsAlertProps {
  orders: Order[];
}

export const CriticalItemsAlert = ({ orders }: CriticalItemsAlertProps) => {
  const [isVisible, setIsVisible] = useState(true);
  
  const criticalItems = orders.flatMap(order =>
    (order.items || [])
      .filter(item => item.item_source_type === 'out_of_stock')
      .map(item => ({ 
        ...item, 
        orderNumber: order.orderNumber, 
        client: order.client 
      }))
  );
  
  if (criticalItems.length === 0 || !isVisible) return null;
  
  return (
    <Alert variant="destructive" className="mb-6 relative">
      <AlertTriangle className="h-4 w-4" />
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 hover:bg-destructive/20"
        onClick={() => setIsVisible(false)}
      >
        <X className="h-4 w-4" />
      </Button>
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
