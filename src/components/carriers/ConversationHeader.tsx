import { Carrier } from '@/types/carriers';
import { Truck } from 'lucide-react';

interface ConversationHeaderProps {
  carrier?: Carrier;
  orderId?: string;
}

export function ConversationHeader({ carrier, orderId }: ConversationHeaderProps) {
  return (
    <div className="border-b bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Truck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{carrier?.name || 'Transportadora'}</h3>
          {orderId && (
            <p className="text-sm text-muted-foreground">Pedido: {orderId}</p>
          )}
        </div>
      </div>
    </div>
  );
}
