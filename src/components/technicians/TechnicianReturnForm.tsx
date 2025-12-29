import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReturnRequests } from '@/hooks/useReturnRequests';
import { useTechnicianPortal } from '@/hooks/useTechnicianPortal';
import { WAREHOUSE_DESTINATIONS, PACKAGING_TYPES } from '@/types/technicians';

interface TechnicianReturnFormProps {
  dispatchId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TechnicianReturnForm({ dispatchId, open, onClose, onSuccess }: TechnicianReturnFormProps) {
  const { createReturnRequest } = useReturnRequests();
  const { technicianInfo, pendingItems } = useTechnicianPortal();
  const [loading, setLoading] = useState(false);
  const dispatch = pendingItems.find(d => d.id === dispatchId);
  
  const [formData, setFormData] = useState({
    destinationWarehouse: 'imply_rs',
    totalWeightKg: '',
    totalVolumes: '1',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!dispatch || !technicianInfo) return;
    setLoading(true);
    try {
      await createReturnRequest({
        dispatchId: dispatch.id,
        technicianId: technicianInfo.id,
        destinationWarehouse: formData.destinationWarehouse,
        destinationType: 'warehouse',
        items: dispatch.items?.map(item => ({
          dispatch_item_id: item.id,
          quantity_returning: item.quantity_sent - item.quantity_returned,
          condition: 'good',
        })) || [],
        pickupCity: technicianInfo.city,
        pickupState: technicianInfo.state,
        pickupAddress: technicianInfo.address,
        totalWeightKg: parseFloat(formData.totalWeightKg) || undefined,
        totalVolumes: parseInt(formData.totalVolumes) || 1,
        notes: formData.notes,
      });
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar Retorno - {dispatch?.order?.order_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Peso Total (kg)</Label>
              <Input type="number" step="0.1" value={formData.totalWeightKg} onChange={(e) => setFormData({ ...formData, totalWeightKg: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nº de Volumes</Label>
              <Input type="number" value={formData.totalVolumes} onChange={(e) => setFormData({ ...formData, totalVolumes: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Informações adicionais..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>Solicitar Retorno</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
