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
}

export function WhatsAppContactList({ 
  conversations, 
  selectedWhatsApp, 
  onSelectContact 
}: WhatsAppContactListProps) {
  const [searchQuery, setSearchQuery] = useState('');

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
              key={contact.whatsapp}
              onClick={() => onSelectContact(contact)}
              className={`w-full p-3 border-b text-left hover:bg-accent/50 transition-colors flex items-start gap-3 ${
                selectedWhatsApp === contact.whatsapp ? 'bg-accent' : ''
              }`}
            >
              <ContactAvatar name={contact.carrierName} size="md" />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm truncate">
                    {contact.carrierName}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {formatDistanceToNow(new Date(contact.lastMessage.sent_at), {
                      addSuffix: true,
                      locale: ptBR
                    })}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  {contact.whatsapp.startsWith('sem-whatsapp') ? (
                    <MessageCircleOff className="h-3 w-3 text-gray-400" />
                  ) : (
                    <Phone className="h-3 w-3" />
                  )}
                  <span className="truncate">{formatWhatsApp(contact.whatsapp)}</span>
                </div>

                <div className="flex items-start gap-2 mb-2">
                  <p className="text-sm text-muted-foreground truncate flex-1">
                    {contact.lastMessage.message_direction === 'outbound' ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">Você: </span>
                    ) : (
                      <span className="text-blue-600 dark:text-blue-400 font-medium">📱 </span>
                    )}
                    {formatCarrierMessage(contact.lastMessage.message_content).formatted.split('\n')[0]}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {contact.orderCount} {contact.orderCount === 1 ? 'pedido' : 'pedidos'}
                  </Badge>
                  {contact.unreadCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {contact.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
