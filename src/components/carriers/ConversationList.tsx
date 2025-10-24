import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { CarrierConversation } from '@/types/carriers';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversationListProps {
  conversations: CarrierConversation[];
  selectedConversationId?: string;
  onSelectConversation: (conversation: CarrierConversation) => void;
}

export function ConversationList({ 
  conversations, 
  selectedConversationId, 
  onSelectConversation 
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Agrupar conversas por order_id + carrier_id
  const groupedConversations = conversations.reduce((acc, conv) => {
    const key = `${conv.order_id}-${conv.carrier_id}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(conv);
    return acc;
  }, {} as Record<string, CarrierConversation[]>);

  // Criar lista de conversas únicas com última mensagem
  const conversationsList = Object.entries(groupedConversations).map(([key, convs]) => {
    const sortedConvs = convs.sort((a, b) => 
      new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
    const lastMessage = sortedConvs[0];
    const unreadCount = sortedConvs.filter(c => 
      c.message_direction === 'inbound' && !c.read_at
    ).length;

    return {
      key,
      lastMessage,
      unreadCount,
      carrier: lastMessage.carrier,
      order_id: lastMessage.order_id
    };
  }).sort((a, b) => 
    new Date(b.lastMessage.sent_at).getTime() - new Date(a.lastMessage.sent_at).getTime()
  );

  const filteredConversations = conversationsList.filter(conv => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      conv.carrier?.name.toLowerCase().includes(search) ||
      conv.lastMessage.message_content.toLowerCase().includes(search)
    );
  });

  return (
    <div className="w-80 border-r bg-background flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3">Conversas</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            Nenhuma conversa encontrada
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <button
              key={conv.key}
              onClick={() => onSelectConversation(conv.lastMessage)}
              className={`w-full p-4 border-b text-left hover:bg-accent transition-colors ${
                selectedConversationId === conv.key ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-semibold text-sm truncate flex-1">
                  {conv.carrier?.name || 'Transportadora'}
                </span>
                <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                  {formatDistanceToNow(new Date(conv.lastMessage.sent_at), {
                    addSuffix: true,
                    locale: ptBR
                  })}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground truncate flex-1">
                  {conv.lastMessage.message_direction === 'outbound' ? '📤 ' : '📥 '}
                  {conv.lastMessage.message_content.substring(0, 50)}
                  {conv.lastMessage.message_content.length > 50 ? '...' : ''}
                </p>
                {conv.unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center">
                    {conv.unreadCount}
                  </Badge>
                )}
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
