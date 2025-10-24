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
          carriers (
            id,
            name,
            email,
            phone,
            whatsapp
          )
        `)
        .eq('order_id', orderId)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setQuotes((data || []) as unknown as FreightQuote[]);
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

      toast({
        title: 'Cotação selecionada',
        description: 'Cotação marcada como aceita.',
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

  return {
    quotes,
    responses,
    loading,
    loadQuotesByOrder,
    loadQuoteResponses,
    sendQuoteRequest,
    selectQuote,
  };
};
