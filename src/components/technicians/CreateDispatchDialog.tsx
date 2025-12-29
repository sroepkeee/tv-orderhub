import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useTechnicians } from '@/hooks/useTechnicians';
import { useTechnicianDispatches } from '@/hooks/useTechnicianDispatches';
import { WAREHOUSE_DESTINATIONS } from '@/types/technicians';

interface CreateDispatchDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateDispatchDialog({ open, onClose, onSuccess }: CreateDispatchDialogProps) {
  const { technicians } = useTechnicians();
  const { createDispatch } = useTechnicianDispatches();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    orderId: '',
    technicianId: '',
    originWarehouse: '',
    expectedReturnDate: '',
  });

  const handleSubmit = async () => {
    if (!formData.orderId || !formData.technicianId || !formData.originWarehouse) return;
    
    setLoading(true);
    try {
      await createDispatch(
        formData.orderId,
        formData.technicianId,
        formData.originWarehouse,
        formData.expectedReturnDate || null,
        [] // items - empty for now, can be populated from order
      );
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Remessa para Técnico</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>ID do Pedido *</Label>
            <Input
              value={formData.orderId}
              onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
              placeholder="UUID do pedido"
            />
          </div>

          <div className="space-y-2">
            <Label>Técnico *</Label>
            <Select value={formData.technicianId} onValueChange={(v) => setFormData({ ...formData, technicianId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.name} - {tech.city}/{tech.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Armazém de Origem *</Label>
            <Select value={formData.originWarehouse} onValueChange={(v) => setFormData({ ...formData, originWarehouse: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {WAREHOUSE_DESTINATIONS.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data Prevista de Retorno</Label>
            <Input
              type="date"
              value={formData.expectedReturnDate}
              onChange={(e) => setFormData({ ...formData, expectedReturnDate: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.orderId || !formData.technicianId}>
            Criar Remessa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
