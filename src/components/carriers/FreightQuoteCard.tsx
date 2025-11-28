import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, CheckCircle, Clock, Calendar, MapPin, CheckCheck, MessageCircleOff } from 'lucide-react';
import type { FreightQuote, FreightQuoteResponse } from '@/types/carriers';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface FreightQuoteCardProps {
  quote: FreightQuote;
  responses: FreightQuoteResponse[];
  onSelectQuote: (quoteId: string, responseId: string) => void;
  orderId: string;
  orderNumber: string;
}

export const FreightQuoteCard = ({
  quote,
  responses,
  onSelectQuote,
  orderId,
  orderNumber,
}: FreightQuoteCardProps) => {
  const navigate = useNavigate();
  const [messageStatus, setMessageStatus] = useState<{
    sent_at?: string;
    delivered_at?: string;
    read_at?: string;
    sent_via?: string;
    has_whatsapp?: boolean;
  }>({});
  
  // Carregar status da mensagem
  useEffect(() => {
    const loadMessageStatus = async () => {
      if (quote.id) {
        const { data } = await supabase
          .from('carrier_conversations')
          .select('sent_at, delivered_at, read_at, message_metadata')
          .eq('quote_id', quote.id)
          .eq('message_direction', 'outbound')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          const metadata = data.message_metadata as any;
          setMessageStatus({
            sent_at: data.sent_at,
            delivered_at: data.delivered_at,
            read_at: data.read_at,
            sent_via: metadata?.sent_via || 'none',
            has_whatsapp: metadata?.has_whatsapp || false,
          });
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
          event: '*',
          schema: 'public',
          table: 'carrier_conversations',
          filter: `quote_id=eq.${quote.id}`
        },
        (payload) => {
          if (payload.new) {
            const metadata = (payload.new as any).message_metadata || {};
            setMessageStatus({
              sent_at: (payload.new as any).sent_at,
              delivered_at: (payload.new as any).delivered_at,
              read_at: (payload.new as any).read_at,
              sent_via: metadata.sent_via || 'none',
              has_whatsapp: metadata.has_whatsapp || false,
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
  const hasWhatsApp = quote.carrier?.whatsapp;
  const isSent = !!messageStatus.sent_at;
  const isDelivered = !!messageStatus.delivered_at;
  const isRead = !!messageStatus.read_at;

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
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold truncate flex-1" title={quote.carrier?.name}>
                {quote.carrier?.name || 'Transportadora'}
              </h3>
              {/* Status de envio WhatsApp */}
              {!hasWhatsApp ? (
                <Badge variant="outline" className="text-xs border-gray-400 text-gray-600 px-2 py-0">
                  <MessageCircleOff className="h-3 w-3 mr-1" />
                  Sem WhatsApp
                </Badge>
              ) : isSent && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {isRead ? (
                    <Badge variant="outline" className="text-xs border-blue-400 text-blue-600 px-2 py-0">
                      <CheckCheck className="h-3 w-3 text-blue-600" />
                    </Badge>
                  ) : isDelivered ? (
                    <Badge variant="outline" className="text-xs border-gray-400 text-gray-600 px-2 py-0">
                      <CheckCheck className="h-3 w-3" />
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs border-gray-400 text-gray-600 px-2 py-0">
                      <CheckCircle className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
              )}
            </div>
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
              onClick={() => {
                navigate('/carriers-chat', {
                  state: {
                    carrierId: quote.carrier_id,
                    carrierWhatsapp: quote.carrier?.whatsapp,
                    carrierName: quote.carrier?.name,
                    orderId: orderId,
                    orderNumber: orderNumber,
                    returnTo: '/'
                  }
                });
              }}
              className="flex-1 h-7 text-xs px-2"
              disabled={!hasWhatsApp}
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
    </>
  );
};
