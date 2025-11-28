import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { ConversationHeader } from './ConversationHeader';
import { MessageInput } from './MessageInput';
import { CarrierConversation } from '@/types/carriers';
import { Loader2 } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversationThreadProps {
  conversations: CarrierConversation[];
  onSendMessage: (message: string) => void;
  onDeleteMessage?: (id: string) => void;
  loading?: boolean;
}

export function ConversationThread({ 
  conversations, 
  onSendMessage,
  onDeleteMessage,
  loading 
}: ConversationThreadProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para última mensagem quando novas mensagens chegam
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [conversations]);

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">Nenhuma mensagem ainda</p>
          <p className="text-sm">As conversas aparecerão aqui quando enviadas</p>
        </div>
      </div>
    );
  }

  const firstConv = conversations[0];
  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
  );

  // Tentar extrair número do pedido da mensagem
  const extractOrderNumber = (message: string): string | null => {
    const match = message.match(/#?(\d{6,})/);
    return match ? match[1] : null;
  };

  const orderNumber = extractOrderNumber(firstConv.message_content) || 
    (firstConv.order_id ? firstConv.order_id.substring(0, 8) : null);

  // Agrupar mensagens por data e pedido para separadores
  const messagesWithSeparators: Array<{ 
    type: 'date' | 'order' | 'message'; 
    date?: Date; 
    orderId?: string;
    orderNumber?: string;
    message?: CarrierConversation 
  }> = [];
  let lastDate: Date | null = null;
  let lastOrderId: string | null = null;

  sortedConversations.forEach((msg) => {
    const msgDate = new Date(msg.sent_at);
    
    // Adicionar separador de data
    if (!lastDate || !isSameDay(lastDate, msgDate)) {
      messagesWithSeparators.push({ type: 'date', date: msgDate });
      lastDate = msgDate;
    }
    
    // Adicionar separador de pedido (se houver mais de um pedido)
    const uniqueOrders = new Set(
      sortedConversations.map(c => c.order_id).filter(Boolean)
    );
    if (uniqueOrders.size > 1 && msg.order_id && msg.order_id !== lastOrderId) {
      const msgOrderNumber = extractOrderNumber(msg.message_content) || 
        (msg.order_id ? msg.order_id.substring(0, 8) : null);
      messagesWithSeparators.push({ 
        type: 'order', 
        orderId: msg.order_id,
        orderNumber: msgOrderNumber
      });
      lastOrderId = msg.order_id;
    }
    
    messagesWithSeparators.push({ type: 'message', message: msg });
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <ConversationHeader 
        carrier={firstConv.carrier} 
        orderId={firstConv.order_id}
        orderNumber={orderNumber}
      />

      <ScrollArea className="flex-1 p-4 bg-muted/10" ref={scrollAreaRef}>
        {messagesWithSeparators.map((item, index) => {
          if (item.type === 'date' && item.date) {
            return (
              <div key={`date-${index}`} className="flex justify-center my-4">
                <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground shadow-sm">
                  {format(item.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </div>
              </div>
            );
          }
          
          if (item.type === 'order' && item.orderNumber) {
            return (
              <div key={`order-${item.orderId}`} className="flex justify-center my-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-md text-xs font-medium text-blue-700 dark:text-blue-300 shadow-sm">
                  📦 Pedido #{item.orderNumber}
                </div>
              </div>
            );
          }
          
          if (item.type === 'message' && item.message) {
            return (
              <MessageBubble 
                key={item.message.id} 
                message={item.message}
                onDelete={onDeleteMessage}
              />
            );
          }
          
          return null;
        })}
        
        {loading && (
          <div className="flex justify-center py-2">
            <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Enviando mensagem...
            </div>
          </div>
        )}
      </ScrollArea>

      <MessageInput onSendMessage={onSendMessage} disabled={loading} />
    </div>
  );
}
