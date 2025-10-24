import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, MapPin, Calendar, DollarSign } from 'lucide-react';
import { CarrierConversation } from '@/types/carriers';
import { format } from 'date-fns';
import { formatCarrierMessage } from '@/lib/utils';

interface OrderQuote {
  orderId: string;
  orderNumber: string;
  conversations: CarrierConversation[];
  lastMessage: CarrierConversation;
  unreadCount: number;
}

interface OrderQuotesListProps {
  conversations: CarrierConversation[];
  selectedOrderId?: string;
  onSelectOrder: (orderId: string) => void;
}

export function OrderQuotesList({ 
  conversations, 
  selectedOrderId, 
  onSelectOrder 
}: OrderQuotesListProps) {
  // Funções auxiliares
  const extractOrderNumber = (message: string): string | null => {
    const { data } = formatCarrierMessage(message);
    if (data?.observations) {
      return data.observations;
    }
    
    const match = message.match(/#?(\d{6,})/);
    return match ? match[1] : null;
  };

  const extractQuoteData = (message: string) => {
    const { data } = formatCarrierMessage(message);
    if (data) {
      return {
        city: data.recipient_city,
        state: data.recipient_state,
        value: data.total_value,
        volumes: data.volumes
      };
    }
    return null;
  };

  const getQuoteStatus = (convs: CarrierConversation[]) => {
    const hasResponse = convs.some(c => c.message_direction === 'inbound');
    const lastOutbound = convs.find(c => c.message_direction === 'outbound');
    
    if (hasResponse) {
      return { label: 'Respondida', variant: 'default' as const, color: 'text-green-600' };
    } else if (lastOutbound) {
      return { label: 'Aguardando', variant: 'secondary' as const, color: 'text-yellow-600' };
    }
    return { label: 'Pendente', variant: 'outline' as const, color: 'text-muted-foreground' };
  };

  // Agrupar por order_id
  const groupedByOrder = conversations.reduce((acc, conv) => {
    const orderId = conv.order_id;
    if (!acc[orderId]) {
      acc[orderId] = [];
    }
    acc[orderId].push(conv);
    return acc;
  }, {} as Record<string, CarrierConversation[]>);

  // Criar lista de pedidos
  const orders: OrderQuote[] = Object.entries(groupedByOrder).map(([orderId, convs]) => {
    const sortedConvs = convs.sort((a, b) => 
      new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
    
    const lastMessage = sortedConvs[0];
    const unreadCount = sortedConvs.filter(c => 
      c.message_direction === 'inbound' && !c.read_at
    ).length;

    // Tentar extrair número do pedido da mensagem
    const orderNumber = extractOrderNumber(lastMessage.message_content) || orderId.substring(0, 8);

    return {
      orderId,
      orderNumber,
      conversations: sortedConvs,
      lastMessage,
      unreadCount
    };
  }).sort((a, b) => 
    new Date(b.lastMessage.sent_at).getTime() - new Date(a.lastMessage.sent_at).getTime()
  );

  if (orders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
        <p className="text-sm">Selecione um contato para ver os pedidos</p>
      </div>
    );
  }

  return (
    <div className="w-96 border-r bg-background flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Package className="h-4 w-4" />
          Pedidos e Cotações
          <Badge variant="secondary" className="ml-auto">
            {orders.length}
          </Badge>
        </h3>
      </div>

      <ScrollArea className="flex-1">
        {orders.map((order) => {
          const status = getQuoteStatus(order.conversations);
          const quoteData = extractQuoteData(order.lastMessage.message_content);
          const isSelected = selectedOrderId === order.orderId;

          return (
            <button
              key={order.orderId}
              onClick={() => onSelectOrder(order.orderId)}
              className={`w-full text-left transition-colors ${
                isSelected ? 'bg-accent' : 'hover:bg-accent/50'
              }`}
            >
              <Card className={`m-2 border ${isSelected ? 'border-primary shadow-md' : ''}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">
                        Pedido #{order.orderNumber}
                      </span>
                    </div>
                    <Badge variant={status.variant} className="text-xs">
                      {status.label}
                    </Badge>
                  </div>

                  {quoteData && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {quoteData.city && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{quoteData.city}/{quoteData.state}</span>
                        </div>
                      )}
                      {quoteData.value && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span>Valor: R$ {quoteData.value.toLocaleString('pt-BR')}</span>
                        </div>
                      )}
                      {quoteData.volumes && (
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          <span>{quoteData.volumes} volume{quoteData.volumes > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(order.lastMessage.sent_at), 'dd/MM HH:mm')}</span>
                    </div>
                    {order.unreadCount > 0 && (
                      <Badge variant="destructive" className="h-5 px-2 animate-pulse">
                        {order.unreadCount}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </ScrollArea>
    </div>
  );
}
