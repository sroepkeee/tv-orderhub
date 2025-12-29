import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DispatchRecipient {
  customer_name: string;
  customer_document: string | null;
  nf_count: number;
  order_ids: string[];
  has_registered: boolean;
  registered_user_id?: string;
  invite_status?: 'pending' | 'registered' | 'expired' | null;
  invite_email?: string;
}

export function useDispatchRecipients() {
  const [recipients, setRecipients] = useState<DispatchRecipient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecipients = useCallback(async () => {
    try {
      setLoading(true);

      // Buscar ordens de remessa ativas
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, customer_name, customer_document')
        .in('order_type', ['remessa_conserto', 'remessa_garantia'])
        .not('status', 'in', '("completed","cancelled","delivered")');

      if (ordersError) throw ordersError;

      // Agrupar por customer_name
      const recipientMap = new Map<string, DispatchRecipient>();

      orders?.forEach((order) => {
        const key = order.customer_name?.trim().toUpperCase() || '';
        if (!key) return;

        if (recipientMap.has(key)) {
          const existing = recipientMap.get(key)!;
          existing.nf_count++;
          existing.order_ids.push(order.id);
          if (order.customer_document && !existing.customer_document) {
            existing.customer_document = order.customer_document;
          }
        } else {
          recipientMap.set(key, {
            customer_name: order.customer_name || '',
            customer_document: order.customer_document,
            nf_count: 1,
            order_ids: [order.id],
            has_registered: false,
          });
        }
      });

      // Verificar quais já têm cadastro
      const customerNames = Array.from(recipientMap.keys());
      
      if (customerNames.length > 0) {
        // Buscar profiles de técnicos
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, document, user_type')
          .eq('user_type', 'technician');

        profiles?.forEach((profile) => {
          const normalizedName = profile.full_name?.trim().toUpperCase() || '';
          if (recipientMap.has(normalizedName)) {
            const recipient = recipientMap.get(normalizedName)!;
            recipient.has_registered = true;
            recipient.registered_user_id = profile.id;
          }
        });

        // Buscar convites pendentes
        const { data: invites } = await supabase
          .from('technician_invites')
          .select('customer_name, email, status')
          .in('status', ['pending', 'registered']);

        invites?.forEach((invite) => {
          const normalizedName = invite.customer_name?.trim().toUpperCase() || '';
          if (recipientMap.has(normalizedName)) {
            const recipient = recipientMap.get(normalizedName)!;
            recipient.invite_status = invite.status as 'pending' | 'registered';
            recipient.invite_email = invite.email;
          }
        });
      }

      const recipientsList = Array.from(recipientMap.values())
        .sort((a, b) => b.nf_count - a.nf_count);

      setRecipients(recipientsList);
    } catch (error) {
      console.error('Error fetching dispatch recipients:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  return { recipients, loading, refetch: fetchRecipients };
}
