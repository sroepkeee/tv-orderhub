import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { WhatsAppContactList } from '@/components/carriers/WhatsAppContactList';
import { OrderQuotesList } from '@/components/carriers/OrderQuotesList';
import { ConversationThread } from '@/components/carriers/ConversationThread';
import { useCarrierConversations } from '@/hooks/useCarrierConversations';
import { useToast } from '@/hooks/use-toast';

export default function CarriersChat() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    conversations, 
    loading, 
    sendMessage, 
    loadConversations, 
    subscribeToNewMessages 
  } = useCarrierConversations();
  const [selectedWhatsApp, setSelectedWhatsApp] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadConversations();
    const unsubscribe = subscribeToNewMessages();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleSelectContact = (contact: { whatsapp: string; carrierId: string }) => {
    setSelectedWhatsApp(contact.whatsapp);
    setSelectedOrderId(null);
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedOrderId || !selectedWhatsApp) return;

    const conv = conversations.find(c => 
      c.order_id === selectedOrderId && c.carrier?.whatsapp === selectedWhatsApp
    );
    
    if (!conv) return;

    setSending(true);
    try {
      await sendMessage({
        carrierId: conv.carrier_id,
        orderId: selectedOrderId,
        message,
        conversationType: 'follow_up'
      });
      
      toast({
        title: 'Mensagem enviada',
        description: 'Sua mensagem foi enviada para a transportadora'
      });
      
      await loadConversations();
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

  const contactConversations = selectedWhatsApp
    ? conversations.filter(c => c.carrier?.whatsapp === selectedWhatsApp)
    : [];

  const threadConversations = selectedOrderId
    ? contactConversations.filter(c => c.order_id === selectedOrderId)
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Chat com Transportadoras</h1>
          {selectedWhatsApp && contactConversations.length > 0 && (
            <span className="text-sm text-muted-foreground">
              • {contactConversations[0]?.carrier?.name}
            </span>
          )}
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {loading ? (
          <div className="flex items-center justify-center h-full border-r w-80">
            <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
          </div>
        ) : (
          <WhatsAppContactList
            conversations={conversations}
            selectedWhatsApp={selectedWhatsApp || undefined}
            onSelectContact={handleSelectContact}
          />
        )}

        {selectedWhatsApp && (
          <OrderQuotesList
            conversations={contactConversations}
            selectedOrderId={selectedOrderId || undefined}
            onSelectOrder={handleSelectOrder}
          />
        )}

        <div className="flex-1">
          {selectedOrderId ? (
            <ConversationThread
              conversations={threadConversations}
              onSendMessage={handleSendMessage}
              loading={sending}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-muted/20">
              <div className="text-center text-muted-foreground">
                <p className="text-lg mb-2">Selecione um pedido</p>
                <p className="text-sm">Escolha um pedido para ver a conversa</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
