import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { ConversationHeader } from './ConversationHeader';
import { MessageInput } from './MessageInput';
import { CarrierConversation } from '@/types/carriers';

interface ConversationThreadProps {
  conversations: CarrierConversation[];
  onSendMessage: (message: string) => void;
  loading?: boolean;
}

export function ConversationThread({ 
  conversations, 
  onSendMessage, 
  loading 
}: ConversationThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll para a última mensagem quando novas mensagens chegam
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversations]);

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">Nenhuma conversa selecionada</p>
          <p className="text-sm">Selecione uma conversa na lista lateral</p>
        </div>
      </div>
    );
  }

  const firstConv = conversations[0];
  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
  );

  return (
    <div className="flex-1 flex flex-col h-full">
      <ConversationHeader 
        carrier={firstConv.carrier} 
        orderId={firstConv.order_id}
      />

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {sortedConversations.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </ScrollArea>

      <MessageInput onSendMessage={onSendMessage} disabled={loading} />
    </div>
  );
}
