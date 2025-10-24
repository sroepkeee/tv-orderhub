import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, CheckCircle, RefreshCw, Mail } from 'lucide-react';
import type { FreightQuote, FreightQuoteResponse } from '@/types/carriers';
import { format } from 'date-fns';
import { CarrierConversationDialog } from './CarrierConversationDialog';

interface FreightQuoteCardProps {
  quote: FreightQuote;
  responses: FreightQuoteResponse[];
  onSelectQuote: (quoteId: string, responseId: string) => void;
  orderId: string;
}

export const FreightQuoteCard = ({
  quote,
  responses,
  onSelectQuote,
  orderId,
}: FreightQuoteCardProps) => {
  const [showConversation, setShowConversation] = useState(false);
  
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

  const selectedResponse = responses.find(r => r.is_selected);
  const bestResponse = responses.length > 0 ? responses[0] : null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">{(quote as any).carrier?.name || 'Transportadora'}</CardTitle>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-1">
            <p>Solicitado: {format(new Date(quote.requested_at), 'dd/MM/yyyy HH:mm')}</p>
            {quote.sent_at && (
              <p>Enviado: {format(new Date(quote.sent_at), 'dd/MM/yyyy HH:mm')}</p>
            )}
            {quote.response_received_at && (
              <p>Respondido: {format(new Date(quote.response_received_at), 'dd/MM/yyyy HH:mm')}</p>
            )}
          </div>

          {bestResponse && (
            <div className="border-t pt-3 space-y-2">
              {bestResponse.freight_value && (
                <p className="font-semibold">💰 Valor: R$ {bestResponse.freight_value.toFixed(2)}</p>
              )}
              {bestResponse.delivery_time_days && (
                <p>⏱️ Prazo: {bestResponse.delivery_time_days} dias úteis</p>
              )}
              {bestResponse.response_text && (
                <p className="text-sm text-muted-foreground">📝 {bestResponse.response_text}</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowConversation(true)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Ver Conversa
            </Button>
            {bestResponse && !selectedResponse && (
              <Button variant="default" size="sm" onClick={() => onSelectQuote(quote.id, bestResponse.id)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Selecionar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <CarrierConversationDialog
        open={showConversation}
        onOpenChange={setShowConversation}
        orderId={orderId}
        carrierId={quote.carrier_id}
        carrierName={(quote as any).carrier?.name}
      />
    </>
  );
};
