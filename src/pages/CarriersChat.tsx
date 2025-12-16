import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Loader2, Settings, Package, Trash2 } from 'lucide-react';
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
    loadAllContacts,
    subscribeToNewMessages,
    unreadCount,
    deleteConversation,
    deleteAllCarrierConversations,
    deleteAllConversations
  } = useCarrierConversations();
  const [selectedWhatsApp, setSelectedWhatsApp] = useState<string | null>(null);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sourceOrder, setSourceOrder] = useState<NavigationState | null>(null);
  const [allContacts, setAllContacts] = useState<Array<{ id: string; name: string; whatsapp: string }>>([]);

  useEffect(() => {
    const loadData = async () => {
      await loadConversations();
      const contacts = await loadAllContacts();
      setAllContacts(contacts);
    };
    loadData();
    
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
      setSelectedWhatsApp(navigationState.carrierId);
      setSelectedCarrierId(navigationState.carrierId);
      setSourceOrder(navigationState);
      
      // Limpar o state para não re-selecionar em reloads
      window.history.replaceState({}, document.title);
    }
  }, [location.state, conversations]);

  const handleSelectContact = (contact: { 
    whatsapp: string | null; 
    carrier_id: string; 
    lastMessage?: string;
    lastMessageDate?: string;
  }) => {
    setSelectedWhatsApp(contact.carrier_id);
    setSelectedCarrierId(contact.carrier_id);
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedCarrierId) return;

    // Pegar a primeira conversa deste carrier_id para obter order_id (se existir)
    const contactConvs = conversations.filter(c => c.carrier_id === selectedCarrierId);
    const orderId = contactConvs.length > 0 ? contactConvs[0].order_id : null;

    setSending(true);
    try {
      await sendMessage({
        carrierId: selectedCarrierId,
        orderId: orderId || undefined,
        message,
        conversationType: 'general'
      });
      
      toast({
        title: 'Mensagem enviada',
        description: 'Sua mensagem foi enviada via WhatsApp'
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

  const threadConversations = selectedCarrierId
    ? conversations.filter(c => c.carrier_id === selectedCarrierId)
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
            {selectedCarrierId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/40"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir Conversa
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir todas as mensagens?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá excluir todas as mensagens com esta transportadora. 
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={async () => {
                        await deleteAllCarrierConversations(selectedCarrierId);
                        setSelectedCarrierId(null);
                        setSelectedWhatsApp(null);
                      }} 
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Excluir Tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {/* Botão para limpar todas as conversas de teste */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/40"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar Tudo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todas as conversas?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá excluir TODAS as conversas do sistema (útil para limpar testes).
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={async () => {
                      await deleteAllConversations();
                      setSelectedCarrierId(null);
                      setSelectedWhatsApp(null);
                    }} 
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Limpar Tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
            allContacts={allContacts}
            selectedWhatsApp={selectedWhatsApp || undefined}
            onSelectContact={handleSelectContact}
            onDeleteContact={async (carrierId) => {
              await deleteAllCarrierConversations(carrierId);
              if (selectedCarrierId === carrierId) {
                setSelectedCarrierId(null);
                setSelectedWhatsApp(null);
              }
            }}
          />
        )}

        <div className="flex-1">
          {selectedWhatsApp ? (
            <ConversationThread
              conversations={threadConversations}
              onSendMessage={handleSendMessage}
              onDeleteMessage={deleteConversation}
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
