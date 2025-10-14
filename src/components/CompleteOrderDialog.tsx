import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface OrderItem {
  id?: string;
  itemCode: string;
  itemDescription: string;
  requestedQuantity: number;
  deliveredQuantity: number;
  received_status?: 'pending' | 'partial' | 'completed';
}

interface CompleteOrderDialogProps {
  pendingItems: OrderItem[];
  open: boolean;
  onConfirm: (note?: string) => void;
  onCancel: () => void;
}

export const CompleteOrderDialog = ({ 
  pendingItems, 
  open, 
  onConfirm, 
  onCancel 
}: CompleteOrderDialogProps) => {
  const [note, setNote] = useState("");
  const hasPendingItems = pendingItems.length > 0;
  
  const handleConfirm = () => {
    onConfirm(note);
    setNote("");
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasPendingItems ? (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                Concluir com Pendências?
              </>
            ) : (
              <>✓ Confirmar Conclusão</>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {hasPendingItems && (
            <>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Este pedido possui {pendingItems.length} item(ns) com recebimento pendente ou parcial.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label className="font-semibold">Itens Pendentes:</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto bg-muted/30">
                  <ul className="space-y-2">
                    {pendingItems.map(item => (
                      <li key={item.id} className="text-sm flex justify-between items-center py-1">
                        <span>
                          <span className="font-medium">{item.itemCode}</span>
                          <span className="text-muted-foreground ml-2">- {item.itemDescription}</span>
                        </span>
                        <span className="text-destructive font-medium">
                          Recebido: {item.deliveredQuantity}/{item.requestedQuantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="completion-note" className="text-destructive font-semibold">
                  * Justificativa Obrigatória:
                </Label>
                <Textarea
                  id="completion-note"
                  placeholder="Explique o motivo da conclusão com pendências (ex: itens cancelados pelo cliente, recebimento parcial acordado, etc)..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="border-destructive/50 focus:border-destructive"
                />
                {note.trim() && (
                  <p className="text-xs text-muted-foreground">
                    {note.length} caracteres
                  </p>
                )}
              </div>
            </>
          )}
          
          {!hasPendingItems && (
            <p className="text-sm text-muted-foreground">
              Todos os itens foram recebidos completamente. Deseja marcar o pedido como concluído?
            </p>
          )}
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={hasPendingItems && !note.trim()}
            variant={hasPendingItems ? "destructive" : "default"}
          >
            {hasPendingItems ? 'Concluir Mesmo Assim' : 'Concluir Pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
