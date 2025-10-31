import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, CheckCircle, Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import type { FreightQuote, FreightQuoteResponse } from '@/types/carriers';
import { format } from 'date-fns';
import { CarrierConversationDialog } from './CarrierConversationDialog';
import { supabase } from '@/integrations/supabase/client';

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
  const [messageStatus, setMessageStatus] = useState<{
    sent_at?: string;
    delivered_at?: string;
    read_at?: string;
  }>({});
  
  // Carregar status da mensagem
  useEffect(() => {
    const loadMessageStatus = async () => {
      if (quote.id) {
        const { data } = await supabase
          .from('carrier_conversations')
          .select('sent_at, delivered_at, read_at')
          .eq('quote_id', quote.id)
          .eq('message_direction', 'outbound')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (data) {
          setMessageStatus(data);
        }
      }
    };
    
    loadMessageStatus();
    
    // Subscrever a mudanças em tempo real
    const channel = supabase
      .channel(`quote-${quote.id}-status`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'carrier_conversations',
          filter: `quote_id=eq.${quote.id}`
        },
        (payload) => {
          if (payload.new) {
            setMessageStatus({
              sent_at: payload.new.sent_at,
              delivered_at: payload.new.delivered_at,
              read_at: payload.new.read_at
            });
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [quote.id]);
  
  const getStatusBadge = () => {
    if (selectedResponse) {
      return <Badge className="bg-green-600 hover:bg-green-700 animate-pulse">✓ Selecionada</Badge>;
    }
    
    if (quote.status === 'responded' || responses.length > 0) {
      return <Badge className="bg-blue-600 hover:bg-blue-700">✅ Respondida</Badge>;
    }

    return null;
  };

  const getDeliveryStatusBadge = () => {
    // Verificar status de entrega da mensagem
    if (messageStatus.read_at) {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 flex items-center gap-1">
          <CheckCheck className="h-3 w-3" />
          Lido
        </Badge>
      );
    }
    
    if (messageStatus.delivered_at) {
      return (
        <Badge className="bg-gray-600 hover:bg-gray-700 flex items-center gap-1">
          <CheckCheck className="h-3 w-3" />
          Entregue
        </Badge>
      );
    }
    
    if (messageStatus.sent_at || quote.sent_at) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Check className="h-3 w-3" />
          Enviado
        </Badge>
      );
    }
    
    // Status pendente
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Pendente
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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">
                {quote.carrier?.name || 'Transportadora'}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {getDeliveryStatusBadge()}
                {getStatusBadge()}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              📅 {format(new Date(quote.requested_at), 'dd/MM HH:mm')}
            </span>
            {(messageStatus.sent_at || quote.sent_at) && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Enviado {format(new Date(messageStatus.sent_at || quote.sent_at), 'dd/MM HH:mm')}
                </span>
              </>
            )}
            {messageStatus.delivered_at && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" />
                  Entregue {format(new Date(messageStatus.delivered_at), 'dd/MM HH:mm')}
                </span>
              </>
            )}
            {messageStatus.read_at && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-blue-600">
                  <CheckCheck className="h-3 w-3" />
                  Lido {format(new Date(messageStatus.read_at), 'dd/MM HH:mm')}
                </span>
              </>
            )}
            {quote.response_received_at && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-green-600 font-semibold">
                  <CheckCircle className="h-3 w-3" />
                  Respondido {format(new Date(quote.response_received_at), 'dd/MM HH:mm')}
                </span>
              </>
            )}
            {quote.quote_request_data?.recipient?.city && (
              <>
                <span>•</span>
                <span>
                  Destino: {quote.quote_request_data.recipient.city}
                  {quote.quote_request_data.recipient.state && `/${quote.quote_request_data.recipient.state}`}
                </span>
              </>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-2">
          {bestResponse && (
            <div className="border-t pt-2 bg-primary/5 -mx-6 px-6 pb-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {bestResponse.freight_value && (
                  <span className="font-bold text-base flex items-center gap-1">
                    💰 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bestResponse.freight_value)}
                  </span>
                )}
                {bestResponse.delivery_time_days && (
                  <span className="flex items-center gap-1 font-semibold">
                    ⏱️ {bestResponse.delivery_time_days} dias úteis
                  </span>
                )}
                {selectedResponse && (
                  <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                    ✓ Selecionada
                  </Badge>
                )}
              </div>
              {bestResponse.response_text && (
                <p className="text-xs text-muted-foreground mt-1">📝 {bestResponse.response_text}</p>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowConversation(true)}
              className="flex-1"
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Chat
            </Button>
            {bestResponse && !selectedResponse && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => onSelectQuote(quote.id, bestResponse.id)}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
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
        carrierName={quote.carrier?.name}
      />
    </>
  );
};
