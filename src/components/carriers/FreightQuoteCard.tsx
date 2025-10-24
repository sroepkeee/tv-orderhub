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
  
  // Debug: verificar dados da transportadora
  console.log('FreightQuoteCard - quote completo:', quote);
  console.log('FreightQuoteCard - carrier:', quote.carrier);
  
  const getStatusBadge = () => {
    if (selectedResponse) {
      return <Badge className="bg-green-600 hover:bg-green-700 animate-pulse">✓ Selecionada</Badge>;
    }
    
    if (quote.status === 'responded' || responses.length > 0) {
      return <Badge className="bg-blue-600 hover:bg-blue-700">✅ Respondida</Badge>;
    }

    const variants = {
      pending: 'secondary',
      sent: 'secondary',
      accepted: 'default',
      rejected: 'destructive',
      expired: 'secondary',
    };

    return (
      <Badge variant={variants[quote.status] as any}>
        {quote.status === 'pending' && '⏳ Pendente'}
        {quote.status === 'sent' && '⏳ Aguardando'}
        {quote.status === 'accepted' && '✓ Aceito'}
        {quote.status === 'rejected' && '✗ Rejeitado'}
        {quote.status === 'expired' && '⏰ Expirado'}
      </Badge>
    );
  };

  const selectedResponse = responses.find(r => r.is_selected);
  const bestResponse = responses.sort((a, b) => {
    if (!a.freight_value) return 1;
    if (!b.freight_value) return -1;
    return a.freight_value - b.freight_value;
  })[0];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">
                {quote.carrier?.name || 'Transportadora'}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Solicitação de Cotação de Frete • 
                {quote.quote_request_data?.recipient?.city && ` ${quote.quote_request_data.recipient.city}`}
                {quote.quote_request_data?.recipient?.state && `/${quote.quote_request_data.recipient.state}`}
              </p>
            </div>
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
            <div className="border-t pt-3 space-y-2 bg-primary/5 -mx-6 px-6 pb-3">
              <p className="text-xs font-semibold text-primary uppercase">Resposta Recebida</p>
              {bestResponse.freight_value && (
                <p className="font-bold text-lg flex items-center gap-2">
                  💰 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bestResponse.freight_value)}
                  {selectedResponse && (
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                      ✓ Selecionada
                    </Badge>
                  )}
                </p>
              )}
              {bestResponse.delivery_time_days && (
                <p className="flex items-center gap-2">
                  ⏱️ <span className="font-semibold">{bestResponse.delivery_time_days} dias úteis</span>
                </p>
              )}
              {bestResponse.response_text && (
                <p className="text-sm text-muted-foreground">📝 {bestResponse.response_text}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Recebido: {format(new Date(bestResponse.received_at), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowConversation(true)}
              className="flex-1"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              💬 Abrir Chat
            </Button>
            {bestResponse && !selectedResponse && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => onSelectQuote(quote.id, bestResponse.id)}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Selecionar Cotação
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
        carrierName={quote.carrier?.name}
      />
    </>
  );
};
