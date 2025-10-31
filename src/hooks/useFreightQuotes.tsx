import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { FreightQuote, FreightQuoteResponse } from '@/types/carriers';

export const useFreightQuotes = () => {
  const [quotes, setQuotes] = useState<FreightQuote[]>([]);
  const [responses, setResponses] = useState<FreightQuoteResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadQuotesByOrder = async (orderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('freight_quotes')
        .select(`
          *,
          carrier:carriers (
            id,
            name,
            email,
            phone,
            whatsapp
          ),
          responses:freight_quote_responses (*)
        `)
        .eq('order_id', orderId)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      
      console.log('Quotes carregadas:', data);
      setQuotes((data || []) as unknown as FreightQuote[]);
      
      // Extract all responses and set them
      const allResponses = data?.flatMap(quote => quote.responses || []) || [];
      setResponses(allResponses as unknown as FreightQuoteResponse[]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar cotações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadQuoteResponses = async (quoteId: string) => {
    try {
      const { data, error } = await supabase
        .from('freight_quote_responses')
        .select('*')
        .eq('quote_id', quoteId)
        .order('received_at', { ascending: false });

      if (error) throw error;
      setResponses((data || []) as unknown as FreightQuoteResponse[]);
      return (data || []) as unknown as FreightQuoteResponse[];
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar respostas',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    }
  };

  const sendQuoteRequest = async (orderId: string, carrierIds: string[], quoteData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.functions.invoke('send-freight-quote', {
        body: {
          orderId,
          carrierIds,
          quoteData,
        },
      });

      if (error) throw error;

      toast({
        title: 'Cotações enviadas',
        description: `Solicitação enviada para ${carrierIds.length} transportadora(s).`,
      });

      await loadQuotesByOrder(orderId);
      return data;
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar cotações',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const selectQuote = async (quoteId: string, responseId: string) => {
    try {
      // Update all responses to not selected
      await supabase
        .from('freight_quote_responses')
        .update({ is_selected: false })
        .eq('quote_id', quoteId);

      // Mark selected response
      const { error } = await supabase
        .from('freight_quote_responses')
        .update({ is_selected: true })
        .eq('id', responseId);

      if (error) throw error;

      // Update quote status to accepted
      await supabase
        .from('freight_quotes')
        .update({ status: 'accepted' })
        .eq('id', quoteId);

      toast({
        title: 'Cotação aprovada',
        description: 'Cotação aprovada com sucesso e marcada como aceita.',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao selecionar cotação',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const rejectQuote = async (quoteId: string, responseId: string) => {
    try {
      // Mark response as not selected
      const { error } = await supabase
        .from('freight_quote_responses')
        .update({ is_selected: false })
        .eq('id', responseId);

      if (error) throw error;

      // Update quote status to rejected
      await supabase
        .from('freight_quotes')
        .update({ status: 'rejected' })
        .eq('id', quoteId);

      toast({
        title: 'Cotação reprovada',
        description: 'Cotação marcada como reprovada.',
        variant: 'destructive',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao reprovar cotação',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const loadQuoteResponsesForOrder = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('freight_quote_responses')
        .select(`
          *,
          freight_quotes!inner (
            id,
            quote_id:id,
            quote_request_data,
            created_by,
            carrier:carriers (
              id,
              name
            ),
            order_id
          )
        `)
        .eq('freight_quotes.order_id', orderId)
        .order('received_at', { ascending: false });

      if (error) throw error;

      // Buscar nomes dos solicitantes
      const userIds = [...new Set(data?.map(r => r.freight_quotes?.created_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      // Transformar dados para formato da tabela
      const formattedData = data?.map(response => ({
        id: response.id,
        quote_id: response.quote_id,
        freight_value: response.freight_value,
        delivery_time_days: response.delivery_time_days,
        response_text: response.response_text,
        received_at: response.received_at,
        is_selected: response.is_selected,
        carrier_name: response.freight_quotes?.carrier?.name,
        requester_name: profilesMap.get(response.freight_quotes?.created_by || '') || 'Desconhecido',
        quote_request_data: response.freight_quotes?.quote_request_data,
      })) || [];

      return formattedData;
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar respostas',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    }
  };

  return {
    quotes,
    responses,
    loading,
    loadQuotesByOrder,
    loadQuoteResponses,
    sendQuoteRequest,
    selectQuote,
    rejectQuote,
    loadQuoteResponsesForOrder,
  };
};
