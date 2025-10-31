import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, CheckCircle, Clock, Calendar, MapPin } from 'lucide-react';
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

  const selectedResponse = responses.find(r => r.is_selected);
  const bestResponse = responses.sort((a, b) => {
    if (!a.freight_value) return 1;
    if (!b.freight_value) return -1;
    return a.freight_value - b.freight_value;
  })[0];

  const hasResponse = !!bestResponse?.freight_value;
  const cardBorderClass = selectedResponse 
    ? 'border-green-500 bg-green-50/30' 
    : hasResponse 
    ? 'border-green-200' 
    : 'border-yellow-200';

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <>
      <Card className={`hover:shadow-md transition-all hover:scale-105 ${cardBorderClass}`}>
        <CardHeader className="p-3 pb-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-bold truncate" title={quote.carrier?.name}>
              {quote.carrier?.name || 'Transportadora'}
            </h3>
            <div className="flex items-center gap-1">
              {selectedResponse ? (
                <Badge className="bg-green-600 text-white text-xs px-2 py-0.5">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Selecionada
                </Badge>
              ) : hasResponse ? (
                <Badge className="bg-green-100 text-green-700 text-xs px-2 py-0.5">
                  Respondida
                </Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500 text-yellow-700 text-xs px-2 py-0.5">
                  <Clock className="h-3 w-3 mr-1" />
                  Aguardando
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-3 pt-0 space-y-2">
          {/* Informações Principais */}
          <div className="space-y-1 text-xs">
            {hasResponse && bestResponse?.freight_value ? (
              <div className="font-bold text-sm text-green-700">
                💰 {formatCurrency(bestResponse.freight_value)}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                💰 Aguardando...
              </div>
            )}
            
            {hasResponse && bestResponse?.delivery_time_days ? (
              <div className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {bestResponse.delivery_time_days} dias
              </div>
            ) : (
              <div className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ---
              </div>
            )}
            
            <div className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(quote.requested_at), 'dd/MM HH:mm')}
            </div>
            
            {quote.quote_request_data?.recipient?.city && (
              <div className="text-muted-foreground truncate flex items-center gap-1" title={`${quote.quote_request_data.recipient.city}/${quote.quote_request_data.recipient.state}`}>
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {quote.quote_request_data.recipient.city}/{quote.quote_request_data.recipient.state}
              </div>
            )}
          </div>

          {/* Botões Compactos */}
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowConversation(true)}
              className="flex-1 h-7 text-xs px-2"
            >
              <MessageSquare className="h-3 w-3" />
            </Button>
            {bestResponse && !selectedResponse && (
              <Button 
                size="sm" 
                onClick={() => onSelectQuote(quote.id, bestResponse.id)}
                className="flex-1 h-7 text-xs px-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-3 w-3" />
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
