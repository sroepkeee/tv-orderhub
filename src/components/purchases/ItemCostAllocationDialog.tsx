import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ItemCostAllocation, PurchaseRequestItem } from "@/types/purchases";
import { BUSINESS_UNITS, COST_CENTERS } from "@/lib/senderOptions";

interface ItemCostAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PurchaseRequestItem;
  initialAllocations?: ItemCostAllocation[];
  onSave: (allocations: Omit<ItemCostAllocation, 'id' | 'created_at'>[]) => Promise<void>;
}

interface AllocationForm extends Omit<ItemCostAllocation, 'id' | 'created_at' | 'purchase_request_item_id'> {}

export function ItemCostAllocationDialog({
  open,
  onOpenChange,
  item,
  initialAllocations = [],
  onSave
}: ItemCostAllocationDialogProps) {
  const [allocations, setAllocations] = useState<AllocationForm[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialAllocations.length > 0) {
        setAllocations(initialAllocations.map(a => ({
          business_unit: a.business_unit,
          accounting_item: a.accounting_item,
          project: a.project,
          cost_center: a.cost_center,
          warehouse: a.warehouse,
          allocation_percentage: a.allocation_percentage,
          allocated_quantity: a.allocated_quantity,
          allocated_value: a.allocated_value,
          notes: a.notes
        })));
      } else {
        setAllocations([createEmptyAllocation()]);
      }
    }
  }, [open, initialAllocations]);

  const createEmptyAllocation = (): AllocationForm => ({
    business_unit: 'Autoatendimento',
    accounting_item: '',
    project: '',
    cost_center: '',
    warehouse: '',
    allocation_percentage: 100,
    allocated_quantity: item.requested_quantity,
    allocated_value: item.total_price || 0,
    notes: ''
  });

  const addAllocation = () => {
    const remaining = 100 - getTotalPercentage();
    setAllocations([...allocations, {
      ...createEmptyAllocation(),
      allocation_percentage: Math.max(0, remaining)
    }]);
  };

  const removeAllocation = (index: number) => {
    if (allocations.length > 1) {
      setAllocations(allocations.filter((_, i) => i !== index));
    }
  };

  const updateAllocation = (index: number, field: keyof AllocationForm, value: any) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalcular quantidades e valores alocados
    if (field === 'allocation_percentage') {
      const percentage = value as number;
      updated[index].allocated_quantity = (item.requested_quantity * percentage) / 100;
      updated[index].allocated_value = ((item.total_price || 0) * percentage) / 100;
    }
    
    setAllocations(updated);
  };

  const getTotalPercentage = () => {
    return allocations.reduce((sum, a) => sum + (a.allocation_percentage || 0), 0);
  };

  const getTotalQuantity = () => {
    return allocations.reduce((sum, a) => sum + (a.allocated_quantity || 0), 0);
  };

  const getTotalValue = () => {
    return allocations.reduce((sum, a) => sum + (a.allocated_value || 0), 0);
  };

  const handleSave = async () => {
    // Validações
    if (getTotalPercentage() !== 100) {
      toast.error('A soma dos percentuais deve ser 100%');
      return;
    }

    const hasEmptyFields = allocations.some(a => 
      !a.business_unit || !a.cost_center || !a.warehouse
    );

    if (hasEmptyFields) {
      toast.error('Preencha todos os campos obrigatórios (B.U, Centro de Custo, Armazém)');
      return;
    }

    setSaving(true);
    try {
      await onSave(allocations.map(a => ({
        ...a,
        purchase_request_item_id: item.id
      })));
      toast.success('Rateios salvos com sucesso!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao salvar rateios');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const totalPercentage = getTotalPercentage();
  const isValid = totalPercentage === 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            📊 Rateio - Item: {item.item_code} ({item.item_description})
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Quantidade Total: {item.requested_quantity} {item.unit} | 
            Valor Total: R$ {(item.total_price || 0).toFixed(2)}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <Button onClick={addAllocation} variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Rateio
          </Button>

          {allocations.map((allocation, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Rateio #{index + 1}</h4>
                {allocations.length > 1 && (
                  <Button
                    onClick={() => removeAllocation(index)}
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>B.U (Business Unit) *</Label>
                  <Select
                    value={allocation.business_unit}
                    onValueChange={(value) => updateAllocation(index, 'business_unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_UNITS.map(bu => (
                        <SelectItem key={bu} value={bu}>{bu}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Item Contábil</Label>
                  <Input
                    value={allocation.accounting_item || ''}
                    onChange={(e) => updateAllocation(index, 'accounting_item', e.target.value)}
                    placeholder="Ex: 1.1.01.001"
                  />
                </div>

                <div>
                  <Label>Projeto</Label>
                  <Input
                    value={allocation.project || ''}
                    onChange={(e) => updateAllocation(index, 'project', e.target.value)}
                    placeholder="Ex: Migração Cloud 2024"
                  />
                </div>

                <div>
                  <Label>Centro de Custo *</Label>
                  <Select
                    value={allocation.cost_center}
                    onValueChange={(value) => updateAllocation(index, 'cost_center', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COST_CENTERS.map(cc => (
                        <SelectItem key={cc.code} value={cc.name}>{cc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Armazém *</Label>
                  <Input
                    value={allocation.warehouse}
                    onChange={(e) => updateAllocation(index, 'warehouse', e.target.value)}
                    placeholder="Ex: ARMAZÉM SSM"
                  />
                </div>

                <div>
                  <Label>% de Alocação * ({allocation.allocation_percentage}%)</Label>
                  <Slider
                    value={[allocation.allocation_percentage]}
                    onValueChange={(value) => updateAllocation(index, 'allocation_percentage', value[0])}
                    max={100}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  Qtd. Alocada: {allocation.allocated_quantity?.toFixed(2)} {item.unit} 
                  ({allocation.allocation_percentage}% de {item.requested_quantity})
                </div>
                <div>
                  Valor Alocado: R$ {(allocation.allocated_value || 0).toFixed(2)}
                  ({allocation.allocation_percentage}% de R$ {(item.total_price || 0).toFixed(2)})
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={allocation.notes || ''}
                  onChange={(e) => updateAllocation(index, 'notes', e.target.value)}
                  rows={2}
                  placeholder="Observações adicionais sobre este rateio..."
                />
              </div>
            </div>
          ))}

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between items-center font-semibold">
              <span>Total Alocado:</span>
              <span className={isValid ? 'text-green-600' : 'text-destructive'}>
                {totalPercentage}% {isValid ? '✅' : '❌'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>Qtd. Total:</span>
              <span>{getTotalQuantity().toFixed(2)} {item.unit}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>Valor Total:</span>
              <span>R$ {getTotalValue().toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? 'Salvando...' : 'Salvar Rateios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
