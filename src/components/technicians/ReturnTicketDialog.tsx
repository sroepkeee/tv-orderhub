import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Check, Copy, Printer, FileText, Package, MapPin, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ReturnTicket } from '@/types/technicians';
import { returnTicketStatusLabels, returnTicketStatusColors, WAREHOUSE_DESTINATIONS } from '@/types/technicians';

interface ReturnTicketDialogProps {
  open: boolean;
  onClose: () => void;
  ticket: ReturnTicket | null;
  onMarkProcessed?: (ticketId: string, totvsNumber: string) => void;
}

export function ReturnTicketDialog({ open, onClose, ticket, onMarkProcessed }: ReturnTicketDialogProps) {
  const [totvsReturnNumber, setTotvsReturnNumber] = useState('');
  const [processing, setProcessing] = useState(false);

  if (!ticket) return null;

  const warehouseName = WAREHOUSE_DESTINATIONS.find(w => w.id === ticket.destination_warehouse)?.name || ticket.destination_warehouse;

  const handleCopyToClipboard = () => {
    const ticketText = `
TICKET DE RETORNO TOTVS - ${ticket.ticket_number}
=====================================
Data: ${format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
Cliente: ${ticket.customer_name || '-'}
Pedido: ${ticket.order_number || '-'}
TOTVS Original: ${ticket.totvs_order_number || '-'}
Técnico: ${ticket.technician_name || '-'}
Destino: ${warehouseName}

ITENS:
${ticket.items.map(item => `- ${item.item_code} | ${item.item_description} | Qtd: ${item.quantity} ${item.unit}`).join('\n')}

Total: ${ticket.total_items} itens | ${ticket.total_quantity} unidades
${ticket.notes ? `\nObservações: ${ticket.notes}` : ''}
    `.trim();

    navigator.clipboard.writeText(ticketText);
    toast.success('Dados copiados para a área de transferência');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleMarkProcessed = async () => {
    if (!totvsReturnNumber.trim()) {
      toast.error('Informe o número da NF de retorno do TOTVS');
      return;
    }
    
    setProcessing(true);
    try {
      await onMarkProcessed?.(ticket.id, totvsReturnNumber);
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ticket de Retorno
            </DialogTitle>
            <Badge className={returnTicketStatusColors[ticket.status]}>
              {returnTicketStatusLabels[ticket.status]}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ticket Number */}
          <div className="bg-muted/50 p-4 rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">Número do Ticket</p>
            <p className="text-2xl font-bold font-mono">{ticket.ticket_number}</p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground">Data</p>
                <p className="font-medium">
                  {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground">Técnico</p>
                <p className="font-medium">{ticket.technician_name || '-'}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground">Pedido</p>
                <p className="font-medium">{ticket.order_number || '-'}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground">Destino</p>
                <p className="font-medium">{warehouseName}</p>
              </div>
            </div>
          </div>

          {ticket.totvs_order_number && (
            <div className="bg-blue-500/10 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">TOTVS Pedido Original</p>
              <p className="font-medium font-mono">{ticket.totvs_order_number}</p>
            </div>
          )}

          <Separator />

          {/* Items List */}
          <div>
            <p className="text-sm font-medium mb-2">Itens para Retorno</p>
            <div className="border rounded-lg divide-y max-h-40 overflow-auto">
              {ticket.items.map((item, index) => (
                <div key={index} className="p-2 text-sm flex justify-between items-center">
                  <div className="min-w-0">
                    <p className="font-medium">{item.item_code}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.item_description}</p>
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {item.quantity} {item.unit}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-2 text-sm text-muted-foreground text-right">
              Total: <strong>{ticket.total_items}</strong> itens | <strong>{ticket.total_quantity}</strong> unidades
            </div>
          </div>

          {ticket.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-1">Observações</p>
                <p className="text-sm text-muted-foreground">{ticket.notes}</p>
              </div>
            </>
          )}

          {/* Process TOTVS */}
          {ticket.status === 'pending' && onMarkProcessed && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label>Número da NF de Retorno (TOTVS)</Label>
                <Input
                  value={totvsReturnNumber}
                  onChange={(e) => setTotvsReturnNumber(e.target.value)}
                  placeholder="Ex: 123456"
                />
                <Button 
                  onClick={handleMarkProcessed} 
                  disabled={processing || !totvsReturnNumber.trim()}
                  className="w-full"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {processing ? 'Processando...' : 'Marcar como Processado no TOTVS'}
                </Button>
              </div>
            </>
          )}

          {ticket.status === 'processed' && ticket.totvs_return_number && (
            <div className="bg-emerald-500/10 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">NF Retorno TOTVS</p>
              <p className="font-medium font-mono">{ticket.totvs_return_number}</p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 gap-2">
          <Button variant="outline" onClick={handleCopyToClipboard}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
