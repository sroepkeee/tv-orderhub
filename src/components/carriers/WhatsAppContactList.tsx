import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Phone, Trash2 } from 'lucide-react';
import { CarrierConversation } from '@/types/carriers';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCarrierMessage } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface WhatsAppContact {
  whatsapp: string;
  carrierName: string;
  carrierId: string;
  orderCount: number;
  unreadCount: number;
  lastMessage: CarrierConversation;
  conversations: CarrierConversation[];
}

interface WhatsAppContactListProps {
  conversations: CarrierConversation[];
  selectedWhatsApp?: string;
  onSelectContact: (contact: WhatsAppContact) => void;
  onConversationsUpdate?: () => void;
}

export function WhatsAppContactList({ 
  conversations, 
  selectedWhatsApp, 
  onSelectContact,
  onConversationsUpdate
}: WhatsAppContactListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<WhatsAppContact | null>(null);
  const { toast } = useToast();

  // Agrupar por chave única (WhatsApp ou carrier_id para casos sem WhatsApp)
  const groupedByWhatsApp = conversations.reduce((acc, conv) => {
    const key = conv.carrier?.whatsapp || `sem-whatsapp:${conv.carrier_id}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(conv);
    return acc;
  }, {} as Record<string, CarrierConversation[]>);

  // Criar lista de contatos
  const contacts: WhatsAppContact[] = Object.entries(groupedByWhatsApp).map(([key, convs]) => {
    const sortedConvs = convs.sort((a, b) => 
      new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
    
    const lastMessage = sortedConvs[0];
    const unreadCount = sortedConvs.filter(c => 
      c.message_direction === 'inbound' && !c.read_at
    ).length;

    // Contar pedidos únicos
    const uniqueOrders = new Set(convs.map(c => c.order_id));

    return {
      whatsapp: key,
      carrierName: lastMessage.carrier?.name || 'Transportadora',
      carrierId: lastMessage.carrier_id,
      orderCount: uniqueOrders.size,
      unreadCount,
      lastMessage,
      conversations: sortedConvs
    };
  }).sort((a, b) => 
    new Date(b.lastMessage.sent_at).getTime() - new Date(a.lastMessage.sent_at).getTime()
  );

  const filteredContacts = contacts.filter(contact => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      contact.carrierName.toLowerCase().includes(search) ||
      contact.whatsapp.includes(search) ||
      contact.lastMessage.message_content.toLowerCase().includes(search)
    );
  });

  const formatWhatsApp = (whatsapp: string) => {
    if (!whatsapp || whatsapp.startsWith('sem-whatsapp')) return 'Sem WhatsApp';
    
    const cleaned = whatsapp.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
      // Celular: (XX) XXXXX-XXXX
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      // Fixo: (XX) XXXX-XXXX
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    
    return whatsapp;
  };

  const handleDeleteClick = (e: React.MouseEvent, contact: WhatsAppContact) => {
    e.stopPropagation();
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;

    try {
      // Excluir todas as conversas deste contato
      const conversationIds = contactToDelete.conversations.map(c => c.id);
      
      const { error } = await supabase
        .from('carrier_conversations')
        .delete()
        .in('id', conversationIds);

      if (error) throw error;

      toast({
        title: '✅ Conversas excluídas',
        description: `Todas as mensagens com ${contactToDelete.carrierName} foram removidas.`,
      });

      // Atualizar lista
      onConversationsUpdate?.();
    } catch (error) {
      console.error('Erro ao excluir conversas:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir as conversas.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    }
  };

  return (
    <div className="w-80 border-r bg-background flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Contatos WhatsApp
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar contato..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredContacts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">Nenhum contato encontrado</p>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <button
              key={contact.whatsapp}
              onClick={() => onSelectContact(contact)}
              className={`w-full p-4 border-b text-left hover:bg-accent transition-colors relative group ${
                selectedWhatsApp === contact.whatsapp ? 'bg-accent border-l-4 border-l-primary' : ''
              }`}
            >
              {/* Botão de exclusão (aparece no hover) */}
              <button
                onClick={(e) => handleDeleteClick(e, contact)}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Excluir todas as conversas"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <span className="font-semibold text-sm block mb-1">
                    {contact.carrierName}
                  </span>
               <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {formatWhatsApp(contact.whatsapp)}
                {contact.whatsapp.startsWith('sem-whatsapp') && (
                  <Badge variant="outline" className="text-xs ml-1">⚠️ Sem contato</Badge>
                )}
              </span>
                </div>
                <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                  {formatDistanceToNow(new Date(contact.lastMessage.sent_at), {
                    addSuffix: true,
                    locale: ptBR
                  })}
                </span>
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">
                  {contact.orderCount} {contact.orderCount === 1 ? 'pedido' : 'pedidos'}
                </Badge>
                {contact.unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    {contact.unreadCount} não lida{contact.unreadCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground truncate">
                {contact.lastMessage.message_direction === 'outbound' ? '📤 ' : '📥 '}
                {formatCarrierMessage(contact.lastMessage.message_content).formatted.split('\n')[0]}
              </p>
            </button>
          ))
        )}
      </ScrollArea>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todas as conversas?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as mensagens com <strong>{contactToDelete?.carrierName}</strong> ({contactToDelete?.orderCount} {contactToDelete?.orderCount === 1 ? 'pedido' : 'pedidos'}) serão permanentemente excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
