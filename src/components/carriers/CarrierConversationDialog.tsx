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
import { formatCarrierMessage } from '@/lib/utils';

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
            <TabsTrigger value="quotes">📊 Cotações Recebidas</TabsTrigger>
            <TabsTrigger value="conversation">💬 Conversa</TabsTrigger>
            <TabsTrigger value="history">📜 Histórico</TabsTrigger>
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

          <TabsContent value="history" className="flex-1 overflow-auto px-6 pb-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-muted-foreground">
                Histórico de Cotações
              </h4>
              <div className="text-sm text-muted-foreground">
                {filteredConversations.length > 0 ? (
                  <div className="space-y-2">
                    {filteredConversations.map((conv) => {
                      const { formatted, isQuote } = formatCarrierMessage(conv.message_content);
                      
                      return (
                        <div 
                          key={conv.id} 
                          className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium">
                              {conv.message_direction === 'outbound' ? '📤 Enviado' : '📥 Recebido'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(conv.sent_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          {isQuote ? (
                            <div className="text-sm whitespace-pre-wrap">
                              {formatted.split('\n').map((line, idx) => (
                                <div key={idx} className={line.startsWith('  ') ? 'ml-2 text-xs opacity-80' : ''}>
                                  {line}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <pre className="text-sm whitespace-pre-wrap font-sans">{formatted}</pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p>Nenhum histórico disponível para esta transportadora neste pedido.</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
