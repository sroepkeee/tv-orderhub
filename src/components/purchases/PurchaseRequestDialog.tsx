import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, PieChart, Edit } from "lucide-react";
import { PurchaseRequest, EnrichedPurchaseItem, ItemCostAllocation } from "@/types/purchases";
import { ItemCostAllocationDialog } from "./ItemCostAllocationDialog";
import { ItemAllocationBadge } from "./ItemAllocationBadge";
import { AddItemDialog } from "./AddItemDialog";
import { ItemMetricsBadges } from "./ItemMetricsBadges";
import { ItemMetricsEditDialog } from "./ItemMetricsEditDialog";
import { BulkAllocationDialog } from "./BulkAllocationDialog";
import { ItemPurchaseHistory, ItemConsumptionMetrics } from "@/types/purchases";
import { supabase } from "@/integrations/supabase/client";

interface PurchaseRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request?: PurchaseRequest;
  items?: EnrichedPurchaseItem[];
  onSave: (request: Partial<PurchaseRequest>, items: any[]) => Promise<void>;
}

interface OrderRateio {
  business_unit?: string;
  cost_center?: string;
  account_item?: string;
  warehouse?: string;
}

export function PurchaseRequestDialog({
  open,
  onOpenChange,
  request,
  items: initialItems = [],
  onSave
}: PurchaseRequestDialogProps) {
  const [formData, setFormData] = useState<Partial<PurchaseRequest>>({
    company: undefined,
    request_type: 'normal',
    notes: '',
    expected_delivery_date: ''
  });
  
  const [items, setItems] = useState<EnrichedPurchaseItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<EnrichedPurchaseItem | null>(null);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [bulkAllocationOpen, setBulkAllocationOpen] = useState(false);
  const [costAllocations, setCostAllocations] = useState<{ [itemId: string]: ItemCostAllocation[] }>({});
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [metricsEditDialogOpen, setMetricsEditDialogOpen] = useState(false);
  const [selectedItemForMetrics, setSelectedItemForMetrics] = useState<EnrichedPurchaseItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [orderRateio, setOrderRateio] = useState<OrderRateio | null>(null);

  // Buscar RATEIO do pedido original
  useEffect(() => {
    const fetchOrderRateio = async () => {
      if (!open || initialItems.length === 0) {
        setOrderRateio(null);
        return;
      }

      // Buscar RATEIO do primeiro item que tenha order_item_id
      const itemWithOrderId = initialItems.find(item => item.order_item_id);
      if (itemWithOrderId?.order_item_id) {
        const { data } = await supabase
          .from('order_items')
          .select('order_id, warehouse, orders(business_unit, cost_center, account_item)')
          .eq('id', itemWithOrderId.order_item_id)
          .single();

        if (data?.orders) {
          const orders = data.orders as any;
          setOrderRateio({
            business_unit: orders.business_unit,
            cost_center: orders.cost_center,
            account_item: orders.account_item,
            warehouse: data.warehouse,
          });
        }
      }
    };

    fetchOrderRateio();
  }, [open, initialItems]);

  useEffect(() => {
    if (open) {
      if (request) {
        setFormData({
          company: request.company,
          request_type: request.request_type,
          notes: request.notes,
          expected_delivery_date: request.expected_delivery_date
        });
      } else {
        setFormData({
          company: undefined,
          request_type: 'normal',
          notes: '',
          expected_delivery_date: ''
        });
      }
      setItems(initialItems);
      
      // Carregar alocações existentes
      const existingAllocations: { [itemId: string]: ItemCostAllocation[] } = {};
      initialItems.forEach(item => {
        if (item.cost_allocations && item.cost_allocations.length > 0) {
          existingAllocations[item.id] = item.cost_allocations;
        }
      });
      setCostAllocations(existingAllocations);
    }
  }, [open, request, initialItems]);

  const handleOpenAllocationDialog = (item: EnrichedPurchaseItem) => {
    setSelectedItem(item);
    setAllocationDialogOpen(true);
  };

  const handleSaveAllocations = async (allocations: Omit<ItemCostAllocation, 'id' | 'created_at'>[]) => {
    if (!selectedItem) return;
    
    // Atualizar o item com as novas alocações
    setItems(items.map(item => 
      item.id === selectedItem.id
        ? { ...item, cost_allocations: allocations as ItemCostAllocation[] }
        : item
    ));
    
    // Atualizar também no state de costAllocations
    setCostAllocations({
      ...costAllocations,
      [selectedItem.id]: allocations as ItemCostAllocation[]
    });
  };

  const handleSaveBulkAllocations = (allocations: { [itemId: string]: ItemCostAllocation[] }) => {
    // Atualizar items com as novas alocações
    setItems(items.map(item => ({
      ...item,
      cost_allocations: allocations[item.id] || item.cost_allocations || []
    })));
    
    // Atualizar state de alocações
    setCostAllocations(allocations);
    setBulkAllocationOpen(false);
  };

  const handleAddItem = (newItem: any) => {
    const item: EnrichedPurchaseItem = {
      id: `temp-${Date.now()}`,
      purchase_request_id: request?.id || '',
      ...newItem,
      total_price: (newItem.unit_price || 0) * newItem.requested_quantity,
      item_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setItems([...items, item]);
    toast.success('Item adicionado');
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
    toast.success('Item removido');
  };

  const handleUpdateItemPrice = (itemId: string, unitPrice: number) => {
    setItems(items.map(item =>
      item.id === itemId
        ? {
            ...item,
            unit_price: unitPrice,
            total_price: unitPrice * item.requested_quantity
          }
        : item
    ));
  };

  const handleOpenMetricsDialog = (item: EnrichedPurchaseItem) => {
    setSelectedItemForMetrics(item);
    setMetricsEditDialogOpen(true);
  };

  const handleSaveMetrics = (
    itemId: string,
    purchaseHistory: ItemPurchaseHistory[],
    consumptionMetrics: ItemConsumptionMetrics
  ) => {
    setItems(items.map(item =>
      item.id === itemId
        ? {
            ...item,
            purchase_history: purchaseHistory,
            consumption_metrics: consumptionMetrics
          }
        : item
    ));
  };

  const getTotalValue = () => {
    return items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  };

  const validateBeforeSend = () => {
    if (!formData.company) {
      toast.error('Selecione a empresa antes de enviar');
      return false;
    }

    if (items.length === 0) {
      toast.error('Adicione pelo menos um item à solicitação');
      return false;
    }

    const itemsWithoutPrice = items.filter(item => !item.unit_price || item.unit_price === 0);
    if (itemsWithoutPrice.length > 0) {
      toast.error(`${itemsWithoutPrice.length} item(ns) sem preço unitário`);
      return false;
    }

    const itemsWithoutAllocation = items.filter(item => {
      const totalPercentage = (item.cost_allocations || []).reduce(
        (sum, a) => sum + a.allocation_percentage, 0
      );
      return totalPercentage !== 100;
    });

    if (itemsWithoutAllocation.length > 0) {
      toast.error(`${itemsWithoutAllocation.length} item(ns) sem rateio completo (100%)`);
      return false;
    }

    return true;
  };

  const handleSave = async (sendForApproval: boolean = false) => {
    if (sendForApproval && !validateBeforeSend()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          ...formData,
          status: sendForApproval ? 'pending' : 'draft',
          total_estimated_value: getTotalValue()
        },
        items
      );
      toast.success(sendForApproval ? 'Solicitação enviada para aprovação!' : 'Rascunho salvo!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao salvar solicitação');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[98vw] max-w-[98vw] h-[98vh] max-h-[98vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>
              🛒 {request ? 'Editar' : 'Nova'} Solicitação de Compra
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Dados Gerais */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">📋 Dados Gerais</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Empresa *</Label>
                  <Select
                    value={formData.company}
                    onValueChange={(value) => setFormData({ ...formData, company: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IMPLY TEC">IMPLY TEC</SelectItem>
                      <SelectItem value="IMPLY RENTAL">IMPLY RENTAL</SelectItem>
                      <SelectItem value="IMPLY FILIAL">IMPLY FILIAL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={formData.request_type}
                    onValueChange={(value) => setFormData({ ...formData, request_type: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                      <SelectItem value="auto_generated">Gerada Automaticamente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Data Prevista de Entrega</Label>
                  <Input
                    type="date"
                    value={formData.expected_delivery_date}
                    onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Observações Destacadas */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4">
                <Label className="text-base font-semibold flex items-center gap-2 mb-2">
                  📝 Observações Importantes
                </Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Adicione observações importantes para a equipe de Compras e SSM...&#10;&#10;Ex: Urgência, fornecedor preferido, condições especiais..."
                  className="bg-white dark:bg-background"
                />
              </div>
            </div>

            {/* Itens */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">📦 Itens da Solicitação</h3>
                <Button onClick={() => setAddItemDialogOpen(true)} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Item Manualmente
                </Button>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum item adicionado ainda
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Últ. Compras / Consumo 4m</TableHead>
                      <TableHead>Preço Unit.</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Rateio</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.item_code}</TableCell>
                        <TableCell>{item.item_description}</TableCell>
                        <TableCell>{item.requested_quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>
                          <ItemMetricsBadges
                            purchaseHistory={item.purchase_history}
                            consumptionMetrics={item.consumption_metrics}
                            editable={true}
                            onEdit={() => handleOpenMetricsDialog(item)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price || 0}
                            onChange={(e) => handleUpdateItemPrice(item.id, Number(e.target.value))}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>R$ {(item.total_price || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <ItemAllocationBadge allocations={item.cost_allocations} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              onClick={() => handleOpenAllocationDialog(item)}
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                            >
                              <PieChart className="h-4 w-4" />
                              Rateio
                            </Button>
                            <Button
                              onClick={() => handleRemoveItem(item.id)}
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="border-t pt-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="font-semibold">💰 Valor Total Estimado:</span>
                  <span className="text-xl font-bold">R$ {getTotalValue().toFixed(2)}</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setBulkAllocationOpen(true)}
                  disabled={items.length === 0}
                  className="gap-2"
                >
                  <PieChart className="h-4 w-4" />
                  Gerenciar Todos os Rateios ({items.length} itens)
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
              💾 Salvar Rascunho
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              📤 Enviar para Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedItem && (
        <ItemCostAllocationDialog
          open={allocationDialogOpen}
          onOpenChange={setAllocationDialogOpen}
          item={selectedItem}
          initialAllocations={selectedItem.cost_allocations}
          onSave={handleSaveAllocations}
          defaultRateio={orderRateio || undefined}
        />
      )}

      <AddItemDialog
        open={addItemDialogOpen}
        onOpenChange={setAddItemDialogOpen}
        onAdd={handleAddItem}
      />

      {selectedItemForMetrics && (
        <ItemMetricsEditDialog
          open={metricsEditDialogOpen}
          onOpenChange={setMetricsEditDialogOpen}
          item={selectedItemForMetrics}
          onSave={handleSaveMetrics}
        />
      )}

      <BulkAllocationDialog
        open={bulkAllocationOpen}
        onOpenChange={setBulkAllocationOpen}
        items={items}
        currentAllocations={costAllocations}
        onSave={handleSaveBulkAllocations}
        defaultRateio={orderRateio || undefined}
      />
    </>
  );
}
