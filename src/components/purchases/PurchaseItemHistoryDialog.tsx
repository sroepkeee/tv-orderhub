import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ItemPurchaseHistory } from "@/types/purchases";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface PurchaseItemHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCode: string;
  itemDescription: string;
}

export const PurchaseItemHistoryDialog = ({
  open,
  onOpenChange,
  itemCode,
  itemDescription,
}: PurchaseItemHistoryDialogProps) => {
  const [history, setHistory] = useState<ItemPurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && itemCode) {
      loadHistory();
    }
  }, [open, itemCode]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('item_purchase_history')
        .select('*')
        .eq('item_code', itemCode)
        .order('purchase_date', { ascending: false })
        .limit(3);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading purchase history:', error);
    } finally {
      setLoading(false);
    }
  };

  const avgPrice = history.length > 0
    ? history.reduce((sum, h) => sum + (h.unit_price || 0), 0) / history.length
    : 0;

  const avgQuantity = history.length > 0
    ? history.reduce((sum, h) => sum + h.quantity, 0) / history.length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>📦 Histórico de Compras</DialogTitle>
          <DialogDescription>
            Item: {itemCode} - {itemDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : history.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhum histórico de compras encontrado
            </div>
          ) : (
            <>
              {history.map((item, index) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {index + 1}. {format(new Date(item.purchase_date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.quantity} unid. • {item.unit_price ? new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(item.unit_price) : 'N/A'}
                        {item.supplier && ` • ${item.supplier}`}
                      </div>
                      {item.purchase_order_number && (
                        <div className="text-xs text-muted-foreground">
                          OC: {item.purchase_order_number}
                        </div>
                      )}
                    </div>
                  </div>
                  {item.notes && (
                    <div className="text-sm text-muted-foreground border-t pt-2">
                      {item.notes}
                    </div>
                  )}
                </div>
              ))}

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">📊 Preço Médio:</span>
                  <span>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(avgPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">📦 Qtd. Média:</span>
                  <span>{avgQuantity.toFixed(2)} unid.</span>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
