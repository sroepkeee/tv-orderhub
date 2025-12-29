import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { TechnicianOrder, OrderItem } from '@/hooks/useTechnicianPortal';
import { WAREHOUSE_DESTINATIONS, ITEM_CONDITIONS, PACKAGING_TYPES } from '@/types/technicians';
import { Package, FileText, Upload, Loader2 } from 'lucide-react';

interface GroupedReturnFormProps {
  orders: TechnicianOrder[];
  requesterProfileId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface OrderItemSource {
  order_item_id: string;
  order_id: string;
  order_number: string;
  quantity: number;
}

interface GroupedItem {
  item_code: string;
  item_description: string;
  total_quantity: number;
  sources: OrderItemSource[];
  // Input fields
  selected: boolean;
  quantity_returning: number;
  condition: string;
  notes: string;
}

export function GroupedReturnForm({
  orders,
  requesterProfileId,
  open,
  onClose,
  onSuccess,
}: GroupedReturnFormProps) {
  const { organizationId } = useOrganizationId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [destinationWarehouse, setDestinationWarehouse] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [volumeCount, setVolumeCount] = useState('1');
  const [dimensions, setDimensions] = useState({ length: '', width: '', height: '' });
  const [packagingType, setPackagingType] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);

  // Group items by item_code across all orders
  const initialGroupedItems = useMemo(() => {
    const itemMap = new Map<string, GroupedItem>();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const existing = itemMap.get(item.item_code);
        const source: OrderItemSource = {
          order_item_id: item.id,
          order_id: order.id,
          order_number: order.order_number,
          quantity: item.quantity,
        };

        if (existing) {
          existing.total_quantity += item.quantity;
          existing.sources.push(source);
        } else {
          itemMap.set(item.item_code, {
            item_code: item.item_code,
            item_description: item.item_description || item.item_code,
            total_quantity: item.quantity,
            sources: [source],
            selected: false,
            quantity_returning: item.quantity,
            condition: 'bom',
            notes: '',
          });
        }
      });
    });

    return Array.from(itemMap.values()).sort((a, b) => 
      a.item_code.localeCompare(b.item_code)
    );
  }, [orders]);

  const [groupedItems, setGroupedItems] = useState<GroupedItem[]>(initialGroupedItems);

  const selectedItems = groupedItems.filter((item) => item.selected);
  const totalItemsToReturn = selectedItems.reduce((sum, item) => sum + item.quantity_returning, 0);

  const handleItemChange = (itemCode: string, field: keyof GroupedItem, value: any) => {
    setGroupedItems((prev) =>
      prev.map((item) =>
        item.item_code === itemCode ? { ...item, [field]: value } : item
      )
    );
  };

  const handleQuantityChange = (itemCode: string, value: string) => {
    const item = groupedItems.find((i) => i.item_code === itemCode);
    if (!item) return;
    
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.max(1, Math.min(numValue, item.total_quantity));
    handleItemChange(itemCode, 'quantity_returning', clampedValue);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Distribute quantity among order items using FIFO
  const distributeQuantity = (groupedItem: GroupedItem): Array<{
    order_item_id: string;
    order_id: string;
    quantity_returning: number;
    condition: string;
    notes: string;
  }> => {
    const result = [];
    let remaining = groupedItem.quantity_returning;

    for (const source of groupedItem.sources) {
      if (remaining <= 0) break;

      const qtyFromThis = Math.min(remaining, source.quantity);
      result.push({
        order_item_id: source.order_item_id,
        order_id: source.order_id,
        quantity_returning: qtyFromThis,
        condition: groupedItem.condition,
        notes: groupedItem.notes,
      });
      remaining -= qtyFromThis;
    }

    return result;
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast.error('Selecione pelo menos um item para retorno');
      return;
    }

    if (!destinationWarehouse) {
      toast.error('Selecione o destino do retorno');
      return;
    }

    setIsSubmitting(true);

    try {
      // Distribute all selected items
      const allItemsToReturn = selectedItems.flatMap(distributeQuantity);
      
      // Get unique order IDs
      const uniqueOrderIds = [...new Set(allItemsToReturn.map((item) => item.order_id))];
      
      // Get customer info from first order
      const firstOrder = orders.find((o) => o.id === uniqueOrderIds[0]);

      // Create return request
      const { data: returnRequest, error: requestError } = await supabase
        .from('return_requests')
        .insert({
          organization_id: organizationId,
          requester_profile_id: requesterProfileId,
          order_id: uniqueOrderIds[0], // Primary order
          order_ids: uniqueOrderIds,
          customer_name: firstOrder?.customer_name || '',
          customer_document: firstOrder?.customer_document || '',
          destination_warehouse: destinationWarehouse,
          total_weight_kg: totalWeight ? parseFloat(totalWeight) : null,
          volume_count: parseInt(volumeCount) || 1,
          dimensions: dimensions.length && dimensions.width && dimensions.height
            ? `${dimensions.length}x${dimensions.width}x${dimensions.height}`
            : null,
          packaging_type: packagingType || null,
          notes: generalNotes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Insert return request items
      const itemsToInsert = allItemsToReturn.map((item) => ({
        return_request_id: returnRequest.id,
        order_item_id: item.order_item_id,
        quantity_returning: item.quantity_returning,
        condition: item.condition,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('return_request_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Upload photos if any
      if (photos.length > 0) {
        for (const photo of photos) {
          const fileName = `${returnRequest.id}/${Date.now()}_${photo.name}`;
          await supabase.storage
            .from('return-photos')
            .upload(fileName, photo);
        }
      }

      toast.success('Solicitação de retorno enviada com sucesso!');
      onSuccess();
    } catch (error) {
      console.error('Error creating return request:', error);
      toast.error('Erro ao criar solicitação de retorno');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Solicitar Retorno
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Items Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-medium">Itens Disponíveis para Retorno</Label>
                {selectedItems.length > 0 && (
                  <Badge variant="secondary">
                    {selectedItems.length} selecionado{selectedItems.length > 1 ? 's' : ''} ({totalItemsToReturn} un.)
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                {groupedItems.map((item) => (
                  <div
                    key={item.item_code}
                    className={`p-4 border rounded-lg transition-colors ${
                      item.selected ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    {/* Item Header */}
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={(checked) =>
                          handleItemChange(item.item_code, 'selected', checked)
                        }
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {item.item_code} - {item.item_description}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Package className="h-3 w-3" />
                          <span>
                            {item.total_quantity} unidade{item.total_quantity > 1 ? 's' : ''} em{' '}
                            {item.sources.length} NF{item.sources.length > 1 ? 's' : ''}:{' '}
                            {item.sources.map((s) => s.order_number).join(', ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Item Details (when selected) */}
                    {item.selected && (
                      <div className="mt-4 ml-7 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Quantidade a retornar</Label>
                          <Input
                            type="number"
                            min={1}
                            max={item.total_quantity}
                            value={item.quantity_returning}
                            onChange={(e) => handleQuantityChange(item.item_code, e.target.value)}
                            className="h-8 mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Condição</Label>
                          <Select
                            value={item.condition}
                            onValueChange={(value) =>
                              handleItemChange(item.item_code, 'condition', value)
                            }
                          >
                            <SelectTrigger className="h-8 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ITEM_CONDITIONS.map((cond) => (
                                <SelectItem key={cond.value} value={cond.value}>
                                  {cond.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Observação do item</Label>
                          <Input
                            placeholder="Observação opcional..."
                            value={item.notes}
                            onChange={(e) =>
                              handleItemChange(item.item_code, 'notes', e.target.value)
                            }
                            className="h-8 mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {groupedItems.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum item disponível para retorno
                  </div>
                )}
              </div>
            </div>

            {/* Destination */}
            <div>
              <Label className="text-base font-medium">Destino</Label>
              <Select value={destinationWarehouse} onValueChange={setDestinationWarehouse}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione o destino..." />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_DESTINATIONS.map((dest) => (
                    <SelectItem key={dest.id} value={dest.id}>
                      {dest.name} - {dest.city}/{dest.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Volume Info */}
            <div>
              <Label className="text-base font-medium">Dados do Volume</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                <div>
                  <Label className="text-xs">Peso (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={totalWeight}
                    onChange={(e) => setTotalWeight(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Nº Volumes</Label>
                  <Input
                    type="number"
                    min={1}
                    value={volumeCount}
                    onChange={(e) => setVolumeCount(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Dimensões (cm)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="C"
                      value={dimensions.length}
                      onChange={(e) => setDimensions((d) => ({ ...d, length: e.target.value }))}
                    />
                    <span className="flex items-center text-muted-foreground">×</span>
                    <Input
                      placeholder="L"
                      value={dimensions.width}
                      onChange={(e) => setDimensions((d) => ({ ...d, width: e.target.value }))}
                    />
                    <span className="flex items-center text-muted-foreground">×</span>
                    <Input
                      placeholder="A"
                      value={dimensions.height}
                      onChange={(e) => setDimensions((d) => ({ ...d, height: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Tipo de Embalagem</Label>
                <Select value={packagingType} onValueChange={setPackagingType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGING_TYPES.map((pkg) => (
                      <SelectItem key={pkg.value} value={pkg.value}>
                        {pkg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Photos */}
            <div>
              <Label className="text-base font-medium">Fotos (opcional)</Label>
              <div className="mt-2">
                <label className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">Adicionar fotos</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {photos.map((photo, idx) => (
                      <div
                        key={idx}
                        className="relative group"
                      >
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Foto ${idx + 1}`}
                          className="h-16 w-16 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* General Notes */}
            <div>
              <Label className="text-base font-medium">Observações Gerais</Label>
              <Textarea
                placeholder="Informações adicionais sobre o retorno..."
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedItems.length === 0 || !destinationWarehouse}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Solicitar Retorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
