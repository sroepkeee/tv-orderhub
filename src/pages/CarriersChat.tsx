import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Settings, Package } from 'lucide-react';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { WhatsAppContactList } from '@/components/carriers/WhatsAppContactList';
import { ConversationThread } from '@/components/carriers/ConversationThread';
import { WhatsAppConnectionStatus } from '@/components/carriers/WhatsAppConnectionStatus';
import { useCarrierConversations } from '@/hooks/useCarrierConversations';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface NavigationState {
  carrierId?: string;
  carrierWhatsapp?: string;
  carrierName?: string;
  orderId?: string;
  orderNumber?: string;
  returnTo?: string;
}

export default function CarriersChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isAuthorized } = useWhatsAppStatus();
  const { 
    conversations, 
    loading, 
    sendMessage, 
    loadConversations, 
    subscribeToNewMessages,
    unreadCount 
  } = useCarrierConversations();
  const [selectedWhatsApp, setSelectedWhatsApp] = useState<string | null>(null);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sourceOrder, setSourceOrder] = useState<NavigationState | null>(null);

  useEffect(() => {
    loadConversations();
    const unsubscribe = subscribeToNewMessages(() => {
      setSyncing(true);
      setTimeout(() => setSyncing(false), 1000);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Auto-selecionar contato quando vier de navegação
  useEffect(() => {
    const navigationState = location.state as NavigationState | null;
    if (navigationState?.carrierId && conversations.length > 0) {
      const carrierWhatsapp = navigationState.carrierWhatsapp || `sem-whatsapp:${navigationState.carrierId}`;
      setSelectedWhatsApp(carrierWhatsapp);
      setSelectedCarrierId(navigationState.carrierId);
      setSourceOrder(navigationState);
      
      // Limpar o state para não re-selecionar em reloads
      window.history.replaceState({}, document.title);
    }
  }, [location.state, conversations]);

  const handleSelectContact = (contact: { whatsapp: string; carrierId: string; conversations: any[] }) => {
    setSelectedWhatsApp(contact.whatsapp);
    setSelectedCarrierId(contact.carrierId);
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedWhatsApp || !selectedCarrierId) return;

    // Pegar a primeira conversa deste contato para obter order_id
    const keyFor = (c: any) => c.carrier?.whatsapp || `sem-whatsapp:${c.carrier_id}`;
    const contactConvs = conversations.filter(c => keyFor(c) === selectedWhatsApp);
    
    if (contactConvs.length === 0) return;
    
    const firstConv = contactConvs[0];

    setSending(true);
    try {
      await sendMessage({
        carrierId: selectedCarrierId,
        orderId: firstConv.order_id,
        message,
        conversationType: 'follow_up'
      });
      
      toast({
        title: 'Mensagem enviada',
        description: 'Sua mensagem foi enviada via WhatsApp para a transportadora'
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

  const keyFor = (c: any) => c.carrier?.whatsapp || `sem-whatsapp:${c.carrier_id}`;
  const threadConversations = selectedWhatsApp
    ? conversations.filter(c => keyFor(c) === selectedWhatsApp)
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">WhatsApp - Chat com Transportadoras</h1>
            {syncing && (
              <Badge variant="secondary" className="gap-1 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                Sincronizando...
              </Badge>
            )}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sourceOrder?.orderNumber && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  navigate('/', { 
                    state: { 
                      openOrderId: sourceOrder.orderId,
                      openOrderNumber: sourceOrder.orderNumber 
                    }
                  });
                }}
                className="gap-2"
              >
                <Package className="h-4 w-4" />
                Voltar ao Pedido #{sourceOrder.orderNumber}
              </Button>
            )}
            {isAuthorized && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/whatsapp-settings')}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Configurações WhatsApp
              </Button>
            )}
            <WhatsAppConnectionStatus />
          </div>
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

        <div className="flex-1">
          {selectedWhatsApp ? (
            <ConversationThread
              conversations={threadConversations}
              onSendMessage={handleSendMessage}
              loading={sending}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-muted/20">
              <div className="text-center text-muted-foreground">
                <p className="text-lg mb-2">Selecione um contato</p>
                <p className="text-sm">Escolha um contato para ver a conversa</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
