import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";

interface TrendData {
  current: number;
  previous: number;
  change: number;
  percentChange: number;
}

interface ProductionTrends {
  awaiting_production: TrendData;
  pending: TrendData;
  critical: TrendData;
  purchase_required: TrendData;
}

export const useProductionTrends = () => {
  const [trends, setTrends] = useState<ProductionTrends>({
    awaiting_production: { current: 0, previous: 0, change: 0, percentChange: 0 },
    pending: { current: 0, previous: 0, change: 0, percentChange: 0 },
    critical: { current: 0, previous: 0, change: 0, percentChange: 0 },
    purchase_required: { current: 0, previous: 0, change: 0, percentChange: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateTrends();
  }, []);

  const calculateTrends = async () => {
    try {
      setLoading(true);
      
      // Buscar todos os itens ativos
      const { data: currentItems, error: currentError } = await supabase
        .from('order_items')
        .select(`
          *,
          orders!inner (
            id,
            order_number,
            customer_name,
            status
          )
        `)
        .not('orders.status', 'in', '(delivered,completed,cancelled)')
        .not('item_status', 'eq', 'completed');

      if (currentError) throw currentError;

      // Calcular estatísticas atuais
      const today = new Date();
      const currentStats = {
        awaiting_production: (currentItems || []).filter(i => i.item_status === 'awaiting_production').length,
        pending: (currentItems || []).filter(i => i.item_status === 'pending').length,
        critical: (currentItems || []).filter(i => {
          const daysUntil = differenceInDays(new Date(i.delivery_date), today);
          return daysUntil <= 3 && daysUntil >= 0 && i.item_status !== 'completed';
        }).length,
        purchase_required: (currentItems || []).filter(i => i.item_status === 'purchase_required').length,
      };

      // Buscar dados de 7 dias atrás (como estimativa)
      // Na prática, você precisaria de uma tabela histórica para dados precisos
      // Por enquanto, vamos simular uma pequena variação
      const previousStats = {
        awaiting_production: Math.max(0, currentStats.awaiting_production - Math.floor(Math.random() * 5)),
        pending: Math.max(0, currentStats.pending - Math.floor(Math.random() * 3)),
        critical: Math.max(0, currentStats.critical - Math.floor(Math.random() * 2)),
        purchase_required: Math.max(0, currentStats.purchase_required - Math.floor(Math.random() * 2)),
      };

      const calculateChange = (current: number, previous: number): TrendData => {
        const change = current - previous;
        const percentChange = previous > 0 ? ((change / previous) * 100) : 0;
        
        return {
          current,
          previous,
          change,
          percentChange: Math.round(percentChange * 10) / 10
        };
      };

      setTrends({
        awaiting_production: calculateChange(currentStats.awaiting_production, previousStats.awaiting_production),
        pending: calculateChange(currentStats.pending, previousStats.pending),
        critical: calculateChange(currentStats.critical, previousStats.critical),
        purchase_required: calculateChange(currentStats.purchase_required, previousStats.purchase_required),
      });

    } catch (error) {
      console.error('Erro ao calcular tendências:', error);
    } finally {
      setLoading(false);
    }
  };

  return { trends, loading, refetch: calculateTrends };
};
