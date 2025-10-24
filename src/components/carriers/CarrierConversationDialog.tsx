import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConversationThread } from './ConversationThread';
import { QuoteResponsesTable } from './QuoteResponsesTable';
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
      <DialogContent className="max-w-5xl h-[700px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>
            {carrierName || 'Transportadora'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="quotes" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 w-fit">
            <TabsTrigger value="quotes">Cotações Recebidas</TabsTrigger>
            <TabsTrigger value="conversation">Conversa</TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="flex-1 overflow-auto px-6 pb-6">
            <QuoteResponsesTable orderId={orderId} />
          </TabsContent>

          <TabsContent value="conversation" className="flex-1 overflow-hidden">
            <ConversationThread
              conversations={filteredConversations}
              onSendMessage={handleSendMessage}
              loading={loading || sending}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
