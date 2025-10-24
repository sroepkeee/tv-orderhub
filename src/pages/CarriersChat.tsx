import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCarrierConversations } from '@/hooks/useCarrierConversations';
import { ConversationList } from '@/components/carriers/ConversationList';
import { ConversationThread } from '@/components/carriers/ConversationThread';
import { CarrierConversation } from '@/types/carriers';
import { useToast } from '@/hooks/use-toast';

export default function CarriersChat() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    conversations, 
    sendMessage, 
    loadConversations,
    subscribeToNewMessages,
    loading 
  } = useCarrierConversations();
  
  const [selectedConversation, setSelectedConversation] = useState<CarrierConversation | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadConversations();
    const unsubscribe = subscribeToNewMessages();
    return unsubscribe;
  }, []);

  const handleSelectConversation = (conversation: CarrierConversation) => {
    setSelectedConversation(conversation);
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedConversation) return;

    setSending(true);
    try {
      await sendMessage({
        carrierId: selectedConversation.carrier_id,
        orderId: selectedConversation.order_id,
        message,
        conversationType: 'follow_up'
      });
      
      toast({
        title: 'Mensagem enviada',
        description: 'Sua mensagem foi enviada para a transportadora'
      });
      
      // Recarregar conversas
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

  // Filtrar conversas da conversa selecionada
  const selectedThreadConversations = selectedConversation
    ? conversations.filter(
        c => c.carrier_id === selectedConversation.carrier_id && 
             c.order_id === selectedConversation.order_id
      )
    : [];

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b p-4 flex-shrink-0">
        <div className="container mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Conversas com Transportadoras</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <ConversationList
          conversations={conversations}
          selectedConversationId={
            selectedConversation 
              ? `${selectedConversation.order_id}-${selectedConversation.carrier_id}`
              : undefined
          }
          onSelectConversation={handleSelectConversation}
        />

        <ConversationThread
          conversations={selectedThreadConversations}
          onSendMessage={handleSendMessage}
          loading={loading || sending}
        />
      </div>
    </div>
  );
}
