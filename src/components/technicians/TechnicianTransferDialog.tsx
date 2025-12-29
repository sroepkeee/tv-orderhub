import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTechnicians } from '@/hooks/useTechnicians';
import { useReturnRequests } from '@/hooks/useReturnRequests';
import { useTechnicianPortal } from '@/hooks/useTechnicianPortal';

interface TechnicianTransferDialogProps {
  dispatchId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TechnicianTransferDialog({ dispatchId, open, onClose, onSuccess }: TechnicianTransferDialogProps) {
  const { technicians } = useTechnicians();
  const { createReturnRequest } = useReturnRequests();
  const { technicianInfo, pendingItems } = useTechnicianPortal();
  const [loading, setLoading] = useState(false);
  const dispatch = pendingItems.find(d => d.id === dispatchId);
  
  const [formData, setFormData] = useState({ destinationTechnicianId: '', notes: '' });

  const otherTechnicians = technicians.filter(t => t.id !== technicianInfo?.id);

  const handleSubmit = async () => {
    if (!dispatch || !technicianInfo || !formData.destinationTechnicianId) return;
    setLoading(true);
    try {
      await createReturnRequest({
        dispatchId: dispatch.id,
        technicianId: technicianInfo.id,
        destinationWarehouse: dispatch.origin_warehouse,
        destinationType: 'technician',
        destinationTechnicianId: formData.destinationTechnicianId,
        items: dispatch.items?.map(item => ({
          dispatch_item_id: item.id,
          quantity_returning: item.quantity_sent - item.quantity_returned,
          condition: 'good',
        })) || [],
        notes: formData.notes,
      });
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir para Outro Técnico</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Técnico Destino *</Label>
            <Select value={formData.destinationTechnicianId} onValueChange={(v) => setFormData({ ...formData, destinationTechnicianId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {otherTechnicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>{tech.name} - {tech.city}/{tech.state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Motivo da Transferência</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Informe o motivo..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.destinationTechnicianId}>Solicitar Transferência</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
