import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConversationThread } from './ConversationThread';
import { useCarrierConversations } from '@/hooks/useCarrierConversations';
import { useToast } from '@/hooks/use-toast';

interface CarrierConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  carrierId: string;
  carrierName?: string;
}

export function CarrierConversationDialog({
  open,
  onOpenChange,
  orderId,
  carrierId,
  carrierName
}: CarrierConversationDialogProps) {
  const { toast } = useToast();
  const { conversations, sendMessage, loadConversationsByOrder, loading } = useCarrierConversations();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      (async () => {
        await loadConversationsByOrder(orderId);
      })();
    }
  }, [open, orderId]);

  const filteredConversations = conversations.filter(
    c => c.carrier_id === carrierId && c.order_id === orderId
  );

  const handleSendMessage = async (message: string) => {
    setSending(true);
    try {
      await sendMessage({
        carrierId,
        orderId,
        message,
        conversationType: 'follow_up'
      });
      
      toast({
        title: 'Mensagem enviada',
        description: 'Sua mensagem foi enviada para a transportadora'
      });
      
      // Recarregar conversas
      await loadConversationsByOrder(orderId);
    } catch (error) {
      toast({
        title: 'Erro ao enviar mensagem',
        description: 'Não foi possível enviar a mensagem. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>
            Conversa - {carrierName || 'Transportadora'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ConversationThread
            conversations={filteredConversations}
            onSendMessage={handleSendMessage}
            loading={loading || sending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
