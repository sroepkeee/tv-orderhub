import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Phone, MessageCircle, MessageCircleOff } from 'lucide-react';
import { CarrierConversation } from '@/types/carriers';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCarrierMessage } from '@/lib/utils';
import { ContactAvatar } from './ContactAvatar';

interface WhatsAppContact {
  whatsapp: string | null;
  carrierName: string;
  carrier_id: string;
  orderCount: number;
  unreadCount: number;
  lastMessage: string;
  lastMessageDate: string;
}

interface WhatsAppContactListProps {
  conversations: CarrierConversation[];
  selectedWhatsApp?: string;
  onSelectContact: (contact: WhatsAppContact) => void;
}

export function WhatsAppContactList({ 
  conversations, 
  selectedWhatsApp, 
  onSelectContact 
}: WhatsAppContactListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Agrupar conversas por carrier_id
  const groupedConversations = conversations.reduce((acc, conv) => {
    const key = conv.carrier_id;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(conv);
    return acc;
  }, {} as Record<string, CarrierConversation[]>);

  // Criar lista de contatos a partir das conversas agrupadas
  const contacts: WhatsAppContact[] = Object.entries(groupedConversations).map(([carrierId, convs]) => {
    const lastMessage = convs[0]; // Primeira mensagem (mais recente)
    const unreadCount = convs.filter(
      c => c.message_direction === 'inbound' && !c.read_at
    ).length;
    
    // Contar pedidos únicos
    const uniqueOrders = new Set(convs.map(c => c.order_id));
    
    // Usar dados reais do carrier
    const carrier = lastMessage.carrier;
    
    return {
      whatsapp: carrier?.whatsapp || null,
      carrierName: carrier?.name || 'Transportadora',
      carrier_id: carrierId,
      lastMessage: lastMessage.message_content,
      lastMessageDate: lastMessage.sent_at || lastMessage.created_at,
      unreadCount,
      orderCount: uniqueOrders.size,
    };
  }).sort((a, b) => {
    const dateA = new Date(a.lastMessageDate || 0).getTime();
    const dateB = new Date(b.lastMessageDate || 0).getTime();
    return dateB - dateA;
  });

  const filteredContacts = contacts.filter(contact => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      contact.carrierName.toLowerCase().includes(search) ||
      (contact.whatsapp && contact.whatsapp.includes(search)) ||
      contact.lastMessage.toLowerCase().includes(search)
    );
  });

  const formatWhatsApp = (whatsapp: string | null) => {
    if (!whatsapp) return 'Sem WhatsApp cadastrado';
    
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

  return (
    <div className="w-96 border-r bg-background flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Conversas
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
              key={contact.carrier_id}
              onClick={() => onSelectContact(contact)}
              className={`w-full p-3 border-b text-left hover:bg-accent/50 transition-colors ${
                selectedWhatsApp === contact.carrier_id ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <ContactAvatar name={contact.carrierName} />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">
                        {contact.carrierName}
                      </h4>
                      {contact.whatsapp ? (
                        <MessageCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      ) : (
                        <MessageCircleOff className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {formatDistanceToNow(new Date(contact.lastMessageDate), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Phone className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate flex-1">
                      {formatWhatsApp(contact.whatsapp)}
                    </span>
                  </div>
                  
                  <p className="text-xs text-muted-foreground truncate">
                    {formatCarrierMessage(contact.lastMessage).formatted.substring(0, 60)}...
                  </p>
                  
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {contact.orderCount} {contact.orderCount === 1 ? 'pedido' : 'pedidos'}
                    </Badge>
                    {contact.unreadCount > 0 && (
                      <Badge className="bg-green-500 text-white text-xs">
                        {contact.unreadCount} nova{contact.unreadCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
