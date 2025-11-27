import { Carrier } from '@/types/carriers';
import { Truck, Phone, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ConversationHeaderProps {
  carrier?: Carrier;
  orderId?: string;
  orderNumber?: string;
}

export function ConversationHeader({ carrier, orderId, orderNumber }: ConversationHeaderProps) {
  const formatWhatsApp = (whatsapp?: string) => {
    if (!whatsapp) return null;
    
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

  const formattedPhone = formatWhatsApp(carrier?.whatsapp);

  return (
    <div className="border-b bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Truck className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base">{carrier?.name || 'Transportadora'}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {formattedPhone && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{formattedPhone}</span>
              </div>
            )}
            {orderId && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Package className="h-3 w-3" />
                {orderNumber ? `#${orderNumber}` : 'Pedido'}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
