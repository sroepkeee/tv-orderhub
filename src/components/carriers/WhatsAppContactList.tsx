import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, MessageCircle, Trash2 } from 'lucide-react';
import { CarrierConversation } from '@/types/carriers';
import { ContactAvatar } from './ContactAvatar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  onDeleteContact: (carrierId: string) => void;
}

export function WhatsAppContactList({ 
  conversations, 
  selectedWhatsApp, 
  onSelectContact,
  onDeleteContact
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
            <div
              key={contact.carrier_id}
              className={`
                flex items-center gap-3 p-3 transition-colors group border-b
                ${selectedWhatsApp === contact.carrier_id
                  ? 'bg-accent' 
                  : 'hover:bg-muted/50'
                }
              `}
            >
              <div onClick={() => onSelectContact(contact)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                <ContactAvatar name={contact.carrierName} size="md" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm truncate flex-1">
                      {contact.carrierName}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(contact.lastMessageDate), { 
                        addSuffix: true,
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground truncate flex-1">
                      {contact.lastMessage}
                    </p>
                    {contact.unreadCount > 0 && (
                      <Badge variant="default" className="h-5 px-1.5 text-xs bg-green-600">
                        {contact.unreadCount}
                      </Badge>
                    )}
                  </div>
                  {contact.orderCount > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {contact.orderCount} pedido{contact.orderCount > 1 ? 's' : ''}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir todas as mensagens?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá excluir todas as mensagens com "{contact.carrierName}". 
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => onDeleteContact(contact.carrier_id)} 
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Excluir Tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
