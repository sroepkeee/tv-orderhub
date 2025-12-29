import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface LinkExistingDispatchesDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LinkExistingDispatchesDialog({ open, onClose, onSuccess }: LinkExistingDispatchesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular Remessas Existentes</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground py-4">
          Funcionalidade para vincular pedidos do tipo "remessa_conserto" e "remessa_garantia" existentes a técnicos cadastrados.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
