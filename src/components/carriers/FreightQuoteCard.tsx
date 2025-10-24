import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, CheckCircle, RefreshCw, Mail } from 'lucide-react';
import type { FreightQuote } from '@/types/carriers';
import { format } from 'date-fns';

interface FreightQuoteCardProps {
  quote: FreightQuote;
  onViewConversation?: () => void;
  onSelect?: () => void;
  onResend?: () => void;
}

export const FreightQuoteCard = ({
  quote,
  onViewConversation,
  onSelect,
  onResend,
}: FreightQuoteCardProps) => {
  const getStatusBadge = () => {
    const variants = {
      pending: 'secondary',
      sent: 'default',
      responded: 'default',
      accepted: 'default',
      rejected: 'destructive',
      expired: 'secondary',
    };

    return (
      <Badge variant={variants[quote.status] as any}>
        {quote.status === 'pending' && '⏳ Pendente'}
        {quote.status === 'sent' && '📤 Enviado'}
        {quote.status === 'responded' && '✅ Respondido'}
        {quote.status === 'accepted' && '✓ Aceito'}
        {quote.status === 'rejected' && '✗ Rejeitado'}
        {quote.status === 'expired' && '⏰ Expirado'}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{(quote as any).carriers?.name || 'Transportadora'}</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm space-y-1">
          <p>Solicitado: {format(new Date(quote.requested_at), 'dd/MM/yyyy HH:mm')}</p>
          {quote.sent_at && (
            <p>Enviado: {format(new Date(quote.sent_at), 'dd/MM/yyyy HH:mm')}</p>
          )}
        </div>

        <div className="flex gap-2">
          {onViewConversation && (
            <Button variant="outline" size="sm" onClick={onViewConversation}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Ver Conversa
            </Button>
          )}
          {onSelect && quote.status === 'responded' && (
            <Button variant="default" size="sm" onClick={onSelect}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Selecionar
            </Button>
          )}
          {onResend && (
            <Button variant="outline" size="sm" onClick={onResend}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reenviar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
