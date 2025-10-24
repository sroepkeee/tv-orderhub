import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useOrderTotalValue = (orderId: string) => {
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTotalValue = async () => {
      if (!orderId) {
        setTotalValue(0);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('order_items')
          .select('total_value')
          .eq('order_id', orderId);

        if (error) throw error;

        const sum = data?.reduce((acc, item) => {
          return acc + (Number(item.total_value) || 0);
        }, 0) || 0;

        setTotalValue(sum);
      } catch (error) {
        console.error('Error fetching order total value:', error);
        setTotalValue(0);
      } finally {
        setLoading(false);
      }
    };

    fetchTotalValue();
  }, [orderId]);

  return { totalValue, loading };
};
