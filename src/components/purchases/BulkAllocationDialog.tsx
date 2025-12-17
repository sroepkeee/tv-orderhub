import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, AlertCircle, XCircle, Settings } from "lucide-react";
import { EnrichedPurchaseItem, ItemCostAllocation } from "@/types/purchases";
import { BUSINESS_UNITS, COST_CENTERS } from "@/lib/senderOptions";

interface DefaultRateio {
  business_unit?: string;
  cost_center?: string;
  account_item?: string;
  warehouse?: string;
}

interface BulkAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: EnrichedPurchaseItem[];
  currentAllocations: { [itemId: string]: ItemCostAllocation[] };
  onSave: (allocations: { [itemId: string]: ItemCostAllocation[] }) => void;
  defaultRateio?: DefaultRateio;
}

interface AllocationForm extends Omit<ItemCostAllocation, 'id' | 'created_at' | 'purchase_request_item_id'> {}

export function BulkAllocationDialog({
  open,
  onOpenChange,
  items,
  currentAllocations,
  onSave,
  defaultRateio
}: BulkAllocationDialogProps) {
  const [allocations, setAllocations] = useState<{ [itemId: string]: AllocationForm[] }>({});
  const [templateAllocation, setTemplateAllocation] = useState<AllocationForm[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Carregar alocações atuais
      const initialAllocations: { [itemId: string]: AllocationForm[] } = {};
      items.forEach(item => {
        const existing = currentAllocations[item.id] || item.cost_allocations || [];
        if (existing.length > 0) {
          initialAllocations[item.id] = existing.map(a => ({
            business_unit: a.business_unit,
            accounting_item: a.accounting_item,
            project: a.project,
            cost_center: a.cost_center,
            warehouse: a.warehouse,
            allocation_percentage: a.allocation_percentage,
            allocated_quantity: a.allocated_quantity,
            allocated_value: a.allocated_value,
            notes: a.notes
          }));
        } else {
          initialAllocations[item.id] = [];
        }
      });
      setAllocations(initialAllocations);

      // Template padrão usando RATEIO do pedido se disponível
      setTemplateAllocation([{
        business_unit: defaultRateio?.business_unit || 'Autoatendimento',
        accounting_item: defaultRateio?.account_item || '',
        project: '',
        cost_center: defaultRateio?.cost_center || '',
        warehouse: defaultRateio?.warehouse || '',
        allocation_percentage: 100,
        allocated_quantity: 0,
        allocated_value: 0,
        notes: ''
      }]);
    }
  }, [open, items, currentAllocations, defaultRateio]);

  const createEmptyAllocation = (item: EnrichedPurchaseItem): AllocationForm => ({
    business_unit: defaultRateio?.business_unit || 'Autoatendimento',
    accounting_item: defaultRateio?.account_item || '',
    project: '',
    cost_center: defaultRateio?.cost_center || '',
    warehouse: defaultRateio?.warehouse || item.warehouse || '',
    allocation_percentage: 100,
    allocated_quantity: item.requested_quantity,
    allocated_value: item.total_price || 0,
    notes: ''
  });

  const addItemAllocation = (itemId: string, item: EnrichedPurchaseItem) => {
    const current = allocations[itemId] || [];
    const remaining = 100 - getTotalPercentage(itemId);
    const newAllocation = {
      ...createEmptyAllocation(item),
      allocation_percentage: Math.max(0, remaining)
    };
    setAllocations({
      ...allocations,
      [itemId]: [...current, newAllocation]
    });
  };

  const removeItemAllocation = (itemId: string, index: number) => {
    const current = allocations[itemId] || [];
    if (current.length > 1) {
      setAllocations({
        ...allocations,
        [itemId]: current.filter((_, i) => i !== index)
      });
    }
  };

  const updateItemAllocation = (itemId: string, index: number, field: keyof AllocationForm, value: any, item: EnrichedPurchaseItem) => {
    const current = allocations[itemId] || [];
    const updated = [...current];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalcular quantidades e valores alocados
    if (field === 'allocation_percentage') {
      const percentage = value as number;
      updated[index].allocated_quantity = (item.requested_quantity * percentage) / 100;
      updated[index].allocated_value = ((item.total_price || 0) * percentage) / 100;
    }
    
    setAllocations({
      ...allocations,
      [itemId]: updated
    });
  };

  const getTotalPercentage = (itemId: string) => {
    const itemAllocations = allocations[itemId] || [];
    return itemAllocations.reduce((sum, a) => sum + (a.allocation_percentage || 0), 0);
  };

  const getAllocationStatus = (itemId: string) => {
    const itemAllocations = allocations[itemId] || [];
    if (!itemAllocations || itemAllocations.length === 0) {
      return { 
        status: 'none', 
        percentage: 0, 
        icon: XCircle, 
        color: 'text-destructive',
        badge: 'destructive' as const,
        label: 'Não configurado'
      };
    }
    const total = getTotalPercentage(itemId);
    if (total === 100) {
      return { 
        status: 'complete', 
        percentage: 100, 
        icon: CheckCircle2, 
        color: 'text-green-600',
        badge: 'default' as const,
        label: 'Completo'
      };
    }
    return { 
      status: 'incomplete', 
      percentage: total, 
      icon: AlertCircle, 
      color: 'text-yellow-600',
      badge: 'secondary' as const,
      label: `Incompleto (${total}%)`
    };
  };

  const addTemplateAllocation = () => {
    setTemplateAllocation([...templateAllocation, {
      business_unit: defaultRateio?.business_unit || 'Autoatendimento',
      accounting_item: defaultRateio?.account_item || '',
      project: '',
      cost_center: defaultRateio?.cost_center || '',
      warehouse: defaultRateio?.warehouse || '',
      allocation_percentage: 0,
      allocated_quantity: 0,
      allocated_value: 0,
      notes: ''
    }]);
  };

  const removeTemplateAllocation = (index: number) => {
    if (templateAllocation.length > 1) {
      setTemplateAllocation(templateAllocation.filter((_, i) => i !== index));
    }
  };

  const updateTemplateAllocation = (index: number, field: keyof AllocationForm, value: any) => {
    const updated = [...templateAllocation];
    updated[index] = { ...updated[index], [field]: value };
    setTemplateAllocation(updated);
  };

  const getTemplateTotal = () => {
    return templateAllocation.reduce((sum, a) => sum + (a.allocation_percentage || 0), 0);
  };

  const applyTemplateToItems = (mode: 'all' | 'unconfigured') => {
    if (getTemplateTotal() !== 100) {
      toast.error('O template deve somar 100% antes de aplicar');
      return;
    }

    const hasEmptyFields = templateAllocation.some(a => 
      !a.business_unit || !a.cost_center || !a.warehouse
    );

    if (hasEmptyFields) {
      toast.error('Preencha todos os campos obrigatórios do template (B.U, Centro de Custo, Armazém)');
      return;
    }

    const newAllocations = { ...allocations };
    let count = 0;

    items.forEach(item => {
      const shouldApply = mode === 'all' || getTotalPercentage(item.id) !== 100;
      
      if (shouldApply) {
        newAllocations[item.id] = templateAllocation.map(alloc => ({
          ...alloc,
          allocated_quantity: (item.requested_quantity * alloc.allocation_percentage) / 100,
          allocated_value: ((item.total_price || 0) * alloc.allocation_percentage) / 100
        }));
        count++;
      }
    });

    setAllocations(newAllocations);
    toast.success(`Template aplicado a ${count} item(ns)`);
  };

  const getStatusSummary = () => {
    let complete = 0;
    let incomplete = 0;
    let none = 0;

    items.forEach(item => {
      const status = getAllocationStatus(item.id);
      if (status.status === 'complete') complete++;
      else if (status.status === 'incomplete') incomplete++;
      else none++;
    });

    return { complete, incomplete, none };
  };

  const validateAllAllocations = () => {
    const errors: string[] = [];
    
    items.forEach(item => {
      const total = getTotalPercentage(item.id);
      const itemAllocations = allocations[item.id] || [];
      
      if (total !== 100) {
        errors.push(`${item.item_code}: rateio soma ${total}% (esperado 100%)`);
      }

      const hasEmptyFields = itemAllocations.some(a => 
        !a.business_unit || !a.cost_center || !a.warehouse
      );

      if (hasEmptyFields) {
        errors.push(`${item.item_code}: campos obrigatórios não preenchidos`);
      }
    });
    
    return errors;
  };

  const handleSave = () => {
    const errors = validateAllAllocations();
    
    if (errors.length > 0) {
      toast.error(`Erros encontrados:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}`);
      return;
    }

    setSaving(true);
    try {
      // Converter para ItemCostAllocation com IDs temporários
      const finalAllocations: { [itemId: string]: ItemCostAllocation[] } = {};
      
      Object.entries(allocations).forEach(([itemId, itemAllocations]) => {
        finalAllocations[itemId] = itemAllocations.map((alloc, index) => ({
          ...alloc,
          id: `${itemId}-${index}`,
          purchase_request_item_id: itemId,
          created_at: new Date().toISOString()
        }));
      });

      onSave(finalAllocations);
      toast.success('Todos os rateios salvos com sucesso!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao salvar rateios');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const summary = getStatusSummary();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-[98vw] h-[98vh] max-h-[98vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            📊 Gerenciar Rateios em Massa ({items.length} itens)
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure os rateios de custo de todos os itens da solicitação
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Padrão */}
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                📋 Template Padrão
                <Badge variant={getTemplateTotal() === 100 ? 'default' : 'secondary'}>
                  {getTemplateTotal()}%
                </Badge>
              </h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => applyTemplateToItems('unconfigured')}
                  variant="outline"
                  size="sm"
                  disabled={getTemplateTotal() !== 100}
                >
                  Aplicar aos Não Configurados
                </Button>
                <Button
                  onClick={() => applyTemplateToItems('all')}
                  variant="default"
                  size="sm"
                  disabled={getTemplateTotal() !== 100}
                >
                  Aplicar a Todos
                </Button>
              </div>
            </div>

            {templateAllocation.map((alloc, index) => (
              <div key={index} className="bg-background border rounded p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Rateio #{index + 1}</span>
                  {templateAllocation.length > 1 && (
                    <Button
                      onClick={() => removeTemplateAllocation(index)}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-6 gap-3">
                  <div>
                    <Label className="text-xs">B.U *</Label>
                    <Select
                      value={alloc.business_unit}
                      onValueChange={(value) => updateTemplateAllocation(index, 'business_unit', value)}
                    >
                      <SelectTrigger className="h-9">
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
                    <Label className="text-xs">Item Contábil</Label>
                    <Input
                      value={alloc.accounting_item || ''}
                      onChange={(e) => updateTemplateAllocation(index, 'accounting_item', e.target.value)}
                      className="h-9"
                      placeholder="Ex: 1.1.01.001"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Projeto</Label>
                    <Input
                      value={alloc.project || ''}
                      onChange={(e) => updateTemplateAllocation(index, 'project', e.target.value)}
                      className="h-9"
                      placeholder="Ex: PRJ-001"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">C.C *</Label>
                    <Select
                      value={alloc.cost_center}
                      onValueChange={(value) => updateTemplateAllocation(index, 'cost_center', value)}
                    >
                      <SelectTrigger className="h-9">
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
                    <Label className="text-xs">Armazém *</Label>
                    <Input
                      value={alloc.warehouse}
                      onChange={(e) => updateTemplateAllocation(index, 'warehouse', e.target.value)}
                      className="h-9"
                      placeholder="Ex: ARMAZÉM SSM"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">% ({alloc.allocation_percentage}%)</Label>
                    <Slider
                      value={[alloc.allocation_percentage]}
                      onValueChange={(value) => updateTemplateAllocation(index, 'allocation_percentage', value[0])}
                      max={100}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button onClick={addTemplateAllocation} variant="outline" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Linha ao Template
            </Button>
          </div>

          {/* Lista de Itens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">📦 Itens da Solicitação</h3>
              <div className="text-sm text-muted-foreground">
                {summary.complete} completos • {summary.incomplete} incompletos • {summary.none} não configurados
              </div>
            </div>

            <Accordion type="multiple" className="space-y-2">
              {items.map((item) => {
                const status = getAllocationStatus(item.id);
                const StatusIcon = status.icon;
                const itemAllocations = allocations[item.id] || [];

                return (
                  <AccordionItem key={item.id} value={item.id} className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <StatusIcon className={`h-5 w-5 ${status.color}`} />
                          <div className="text-left">
                            <div className="font-semibold">
                              {item.item_code} - {item.item_description}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {item.requested_quantity} {item.unit}
                            </div>
                          </div>
                        </div>
                        <Badge variant={status.badge}>{status.label}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-3">
                      {itemAllocations.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          <p>Nenhum rateio configurado</p>
                        </div>
                      ) : (
                        itemAllocations.map((alloc, index) => (
                          <div key={index} className="bg-muted/30 border rounded p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Rateio #{index + 1}</span>
                              {itemAllocations.length > 1 && (
                                <Button
                                  onClick={() => removeItemAllocation(item.id, index)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>

                            <div className="grid grid-cols-6 gap-3">
                              <div>
                                <Label className="text-xs">B.U *</Label>
                                <Select
                                  value={alloc.business_unit}
                                  onValueChange={(value) => updateItemAllocation(item.id, index, 'business_unit', value, item)}
                                >
                                  <SelectTrigger className="h-9">
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
                                <Label className="text-xs">Item Contábil</Label>
                                <Input
                                  value={alloc.accounting_item || ''}
                                  onChange={(e) => updateItemAllocation(item.id, index, 'accounting_item', e.target.value, item)}
                                  className="h-9"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Projeto</Label>
                                <Input
                                  value={alloc.project || ''}
                                  onChange={(e) => updateItemAllocation(item.id, index, 'project', e.target.value, item)}
                                  className="h-9"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">C.C *</Label>
                                <Select
                                  value={alloc.cost_center}
                                  onValueChange={(value) => updateItemAllocation(item.id, index, 'cost_center', value, item)}
                                >
                                  <SelectTrigger className="h-9">
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
                                <Label className="text-xs">Armazém *</Label>
                                <Input
                                  value={alloc.warehouse}
                                  onChange={(e) => updateItemAllocation(item.id, index, 'warehouse', e.target.value, item)}
                                  className="h-9"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">% ({alloc.allocation_percentage}%)</Label>
                                <Slider
                                  value={[alloc.allocation_percentage]}
                                  onValueChange={(value) => updateItemAllocation(item.id, index, 'allocation_percentage', value[0], item)}
                                  max={100}
                                  step={1}
                                  className="mt-2"
                                />
                              </div>
                            </div>

                            <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
                              <div>Qtd: {alloc.allocated_quantity?.toFixed(2)} {item.unit}</div>
                              <div>Valor: R$ {(alloc.allocated_value || 0).toFixed(2)}</div>
                            </div>
                          </div>
                        ))
                      )}

                      <Button
                        onClick={() => addItemAllocation(item.id, item)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Rateio
                      </Button>

                      <div className={`text-sm font-medium text-right ${getTotalPercentage(item.id) === 100 ? 'text-green-600' : 'text-destructive'}`}>
                        Total: {getTotalPercentage(item.id)}%
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              Status: <Badge variant="default">{summary.complete} completos</Badge>{' '}
              <Badge variant="secondary">{summary.incomplete} incompletos</Badge>{' '}
              <Badge variant="destructive">{summary.none} não configurados</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Todos os Rateios'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
