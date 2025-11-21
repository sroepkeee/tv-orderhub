import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EnrichedPurchaseItem, ItemPurchaseHistory, ItemConsumptionMetrics } from "@/types/purchases";
import { format } from "date-fns";

interface ItemMetricsEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EnrichedPurchaseItem;
  onSave: (
    itemId: string,
    purchaseHistory: ItemPurchaseHistory[],
    consumptionMetrics: ItemConsumptionMetrics
  ) => void;
}

export function ItemMetricsEditDialog({
  open,
  onOpenChange,
  item,
  onSave
}: ItemMetricsEditDialogProps) {
  const [purchaseHistory, setPurchaseHistory] = useState<ItemPurchaseHistory[]>([]);
  const [consumptionMetrics, setConsumptionMetrics] = useState<ItemConsumptionMetrics>({
    id: '',
    item_code: item.item_code,
    consumption_30_days: 0,
    consumption_60_days: 0,
    consumption_90_days: 0,
    average_daily_consumption: 0,
    last_calculated_at: new Date().toISOString()
  });

  useEffect(() => {
    if (open) {
      setPurchaseHistory(item.purchase_history || []);
      setConsumptionMetrics(item.consumption_metrics || {
        id: '',
        item_code: item.item_code,
        consumption_30_days: 0,
        consumption_60_days: 0,
        consumption_90_days: 0,
        average_daily_consumption: 0,
        last_calculated_at: new Date().toISOString()
      });
    }
  }, [open, item]);

  const handleAddPurchase = () => {
    const newPurchase: ItemPurchaseHistory = {
      id: `temp-${Date.now()}`,
      item_code: item.item_code,
      purchase_date: format(new Date(), 'yyyy-MM-dd'),
      quantity: 0,
      unit_price: 0,
      supplier: '',
      purchase_order_number: '',
      notes: '',
      created_at: new Date().toISOString()
    };
    setPurchaseHistory([newPurchase, ...purchaseHistory]);
  };

  const handleRemovePurchase = (id: string) => {
    setPurchaseHistory(purchaseHistory.filter(p => p.id !== id));
  };

  const handleUpdatePurchase = (id: string, field: keyof ItemPurchaseHistory, value: any) => {
    setPurchaseHistory(purchaseHistory.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleUpdateConsumption = (field: keyof ItemConsumptionMetrics, value: number) => {
    setConsumptionMetrics(prev => {
      const updated = { ...prev, [field]: value };
      // Recalcular média diária baseado no consumo de 90 dias
      if (field === 'consumption_90_days') {
        updated.average_daily_consumption = value / 90;
      }
      return updated;
    });
  };

  const handleSave = () => {
    // Validação básica
    const invalidPurchases = purchaseHistory.filter(p => p.quantity <= 0);
    if (invalidPurchases.length > 0) {
      toast.error('Todas as compras devem ter quantidade maior que 0');
      return;
    }

    onSave(item.id, purchaseHistory, consumptionMetrics);
    toast.success('Métricas atualizadas com sucesso');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            📊 Editar Métricas - {item.item_code}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{item.item_description}</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Histórico de Compras */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">🛒 Histórico de Compras</h3>
              <Button onClick={handleAddPurchase} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Compra
              </Button>
            </div>

            {purchaseHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma compra registrada
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Preço Unit.</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseHistory.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell>
                          <Input
                            type="date"
                            value={purchase.purchase_date}
                            onChange={(e) => handleUpdatePurchase(purchase.id, 'purchase_date', e.target.value)}
                            className="w-36"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={purchase.quantity}
                            onChange={(e) => handleUpdatePurchase(purchase.id, 'quantity', Number(e.target.value))}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={purchase.supplier || ''}
                            onChange={(e) => handleUpdatePurchase(purchase.id, 'supplier', e.target.value)}
                            placeholder="Nome do fornecedor"
                            className="w-48"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={purchase.unit_price || 0}
                            onChange={(e) => handleUpdatePurchase(purchase.id, 'unit_price', Number(e.target.value))}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => handleRemovePurchase(purchase.id)}
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Métricas de Consumo */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">📉 Métricas de Consumo</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Consumo 30 dias (unidades)</Label>
                <Input
                  type="number"
                  min="0"
                  value={consumptionMetrics.consumption_30_days || 0}
                  onChange={(e) => handleUpdateConsumption('consumption_30_days', Number(e.target.value))}
                />
              </div>

              <div>
                <Label>Consumo 60 dias (unidades)</Label>
                <Input
                  type="number"
                  min="0"
                  value={consumptionMetrics.consumption_60_days || 0}
                  onChange={(e) => handleUpdateConsumption('consumption_60_days', Number(e.target.value))}
                />
              </div>

              <div>
                <Label>Consumo 90 dias (unidades)</Label>
                <Input
                  type="number"
                  min="0"
                  value={consumptionMetrics.consumption_90_days || 0}
                  onChange={(e) => handleUpdateConsumption('consumption_90_days', Number(e.target.value))}
                />
              </div>

              <div>
                <Label>Média diária (calculado)</Label>
                <Input
                  type="number"
                  value={consumptionMetrics.average_daily_consumption?.toFixed(2) || 0}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">💡 Dica:</p>
              <p className="text-blue-800 dark:text-blue-200">
                O consumo estimado no quadrimestre (120 dias) será calculado automaticamente: {Math.round((consumptionMetrics.consumption_90_days || 0) * 1.33)} unidades
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            💾 Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
