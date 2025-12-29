import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useReturnRequests } from '@/hooks/useReturnRequests';
import { useTechnicianPortal } from '@/hooks/useTechnicianPortal';
import { WAREHOUSE_DESTINATIONS, PACKAGING_TYPES, ITEM_CONDITIONS } from '@/types/technicians';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TechnicianReturnFormProps {
  dispatchId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ItemSelection {
  id: string;
  dispatch_item_id: string;
  item_code: string;
  item_description: string;
  max_quantity: number;
  quantity_returning: number;
  condition: string;
  notes: string;
  selected: boolean;
}

export function TechnicianReturnForm({ dispatchId, open, onClose, onSuccess }: TechnicianReturnFormProps) {
  const { createReturnRequest } = useReturnRequests();
  const { technicianInfo, pendingItems } = useTechnicianPortal();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const dispatch = pendingItems.find(d => d.id === dispatchId);
  
  // Initialize item selections from dispatch items
  const [itemSelections, setItemSelections] = useState<ItemSelection[]>(() => 
    (dispatch?.items || []).map(item => ({
      id: item.id,
      dispatch_item_id: item.id,
      item_code: item.item_code,
      item_description: item.item_description || '',
      max_quantity: item.quantity_sent - item.quantity_returned,
      quantity_returning: item.quantity_sent - item.quantity_returned,
      condition: 'good',
      notes: '',
      selected: true,
    }))
  );
  
  const [formData, setFormData] = useState({
    destinationWarehouse: 'imply_rs',
    totalWeightKg: '',
    totalVolumes: '1',
    packagingType: 'cardboard_box',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    notes: '',
  });
  
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const handleItemToggle = (itemId: string, checked: boolean) => {
    setItemSelections(prev => prev.map(item => 
      item.id === itemId ? { ...item, selected: checked } : item
    ));
  };

  const handleItemChange = (itemId: string, field: keyof ItemSelection, value: string | number) => {
    setItemSelections(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      
      if (field === 'quantity_returning') {
        const qty = Math.min(Math.max(1, Number(value)), item.max_quantity);
        return { ...item, quantity_returning: qty };
      }
      
      return { ...item, [field]: value };
    }));
  };

  const handlePhotoUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} não é uma imagem válida`);
          continue;
        }
        
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} excede o limite de 5MB`);
          continue;
        }
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `returns/${dispatchId}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('technician-returns')
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('technician-returns')
          .getPublicUrl(filePath);
        
        uploadedUrls.push(publicUrl);
      }
      
      setPhotoUrls(prev => [...prev, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} foto(s) enviada(s)`);
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Erro ao enviar fotos');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }, [dispatchId]);

  const removePhoto = (url: string) => {
    setPhotoUrls(prev => prev.filter(u => u !== url));
  };

  const handleSubmit = async () => {
    if (!dispatch || !technicianInfo) return;
    
    const selectedItems = itemSelections.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error('Selecione pelo menos um item para retorno');
      return;
    }
    
    setLoading(true);
    try {
      await createReturnRequest({
        dispatchId: dispatch.id,
        technicianId: technicianInfo.id,
        destinationWarehouse: formData.destinationWarehouse,
        destinationType: 'warehouse',
        items: selectedItems.map(item => ({
          dispatch_item_id: item.dispatch_item_id,
          quantity_returning: item.quantity_returning,
          condition: item.condition,
          notes: item.notes || undefined,
        })),
        pickupCity: technicianInfo.city,
        pickupState: technicianInfo.state,
        pickupAddress: technicianInfo.address,
        totalWeightKg: parseFloat(formData.totalWeightKg) || undefined,
        totalVolumes: parseInt(formData.totalVolumes) || 1,
        volumeDetails: formData.lengthCm && formData.widthCm && formData.heightCm ? [{
          quantity: parseInt(formData.totalVolumes) || 1,
          weight_kg: parseFloat(formData.totalWeightKg) || 0,
          length_cm: parseFloat(formData.lengthCm),
          width_cm: parseFloat(formData.widthCm),
          height_cm: parseFloat(formData.heightCm),
          packaging_type: formData.packagingType,
        }] : undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
        notes: formData.notes,
      });
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = itemSelections.filter(i => i.selected).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Solicitar Retorno - {dispatch?.order?.order_number}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Items Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Itens para Retorno</Label>
                <Badge variant="secondary">{selectedCount} selecionado(s)</Badge>
              </div>
              
              <div className="border rounded-lg divide-y">
                {itemSelections.map((item) => (
                  <div key={item.id} className={`p-3 space-y-2 ${!item.selected ? 'opacity-50' : ''}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={(checked) => handleItemToggle(item.id, !!checked)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{item.item_code}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.item_description}</p>
                      </div>
                    </div>
                    
                    {item.selected && (
                      <div className="grid grid-cols-3 gap-2 ml-7">
                        <div>
                          <Label className="text-xs">Quantidade</Label>
                          <Input
                            type="number"
                            min={1}
                            max={item.max_quantity}
                            value={item.quantity_returning}
                            onChange={(e) => handleItemChange(item.id, 'quantity_returning', e.target.value)}
                            className="h-8 text-sm"
                          />
                          <span className="text-[10px] text-muted-foreground">Máx: {item.max_quantity}</span>
                        </div>
                        <div>
                          <Label className="text-xs">Condição</Label>
                          <Select
                            value={item.condition}
                            onValueChange={(v) => handleItemChange(item.id, 'condition', v)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ITEM_CONDITIONS.map(c => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Obs. Item</Label>
                          <Input
                            value={item.notes}
                            onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                            placeholder="Opcional"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Destination */}
            <div className="space-y-2">
              <Label>Destino *</Label>
              <Select value={formData.destinationWarehouse} onValueChange={(v) => setFormData({ ...formData, destinationWarehouse: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_DESTINATIONS.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name} - {w.city}/{w.state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Weight and Volumes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Peso Total (kg)</Label>
                <Input 
                  type="number" 
                  step="0.1" 
                  value={formData.totalWeightKg} 
                  onChange={(e) => setFormData({ ...formData, totalWeightKg: e.target.value })} 
                  placeholder="Ex: 5.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Nº de Volumes</Label>
                <Input 
                  type="number" 
                  value={formData.totalVolumes} 
                  onChange={(e) => setFormData({ ...formData, totalVolumes: e.target.value })} 
                />
              </div>
            </div>

            {/* Volume Dimensions */}
            <div className="space-y-2">
              <Label>Dimensões do Volume (cm)</Label>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Input 
                    type="number" 
                    placeholder="C" 
                    value={formData.lengthCm}
                    onChange={(e) => setFormData({ ...formData, lengthCm: e.target.value })}
                  />
                  <span className="text-[10px] text-muted-foreground">Comprimento</span>
                </div>
                <div>
                  <Input 
                    type="number" 
                    placeholder="L" 
                    value={formData.widthCm}
                    onChange={(e) => setFormData({ ...formData, widthCm: e.target.value })}
                  />
                  <span className="text-[10px] text-muted-foreground">Largura</span>
                </div>
                <div>
                  <Input 
                    type="number" 
                    placeholder="A" 
                    value={formData.heightCm}
                    onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
                  />
                  <span className="text-[10px] text-muted-foreground">Altura</span>
                </div>
                <div>
                  <Select value={formData.packagingType} onValueChange={(v) => setFormData({ ...formData, packagingType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PACKAGING_TYPES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-muted-foreground">Embalagem</span>
                </div>
              </div>
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Fotos do Volume</Label>
              <div className="flex flex-wrap gap-2">
                {photoUrls.map((url, idx) => (
                  <div key={idx} className="relative w-20 h-20 border rounded-lg overflow-hidden group">
                    <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(url)}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                
                <label className="w-20 h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground mt-1">Adicionar</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">Fotos do volume embalado para coleta</p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={formData.notes} 
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                placeholder="Informações adicionais sobre o retorno..." 
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || selectedCount === 0}>
            {loading ? 'Enviando...' : 'Solicitar Retorno'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
