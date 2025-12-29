import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  item_code: string;
  item_description: string;
  quantity: number;
  serial_number?: string;
  status?: string;
}

interface TechnicianOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_document?: string;
  order_type: string;
  status: string;
  created_at: string;
  notes?: string;
  items: OrderItem[];
  items_count: number;
}

interface UserProfile {
  id: string;
  full_name: string;
  user_type: string;
  document?: string;
}

export function useTechnicianPortal() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<TechnicianOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Buscar perfil do usuário
  const fetchUserProfile = useCallback(async () => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, document')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      setUserProfile(data as UserProfile);
      return data as UserProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }, [user?.id]);

  // Buscar ordens de remessa vinculadas ao técnico
  const fetchOrders = useCallback(async () => {
    if (!userProfile) return;

    setLoading(true);
    try {
      // Buscar ordens de remessa_conserto e remessa_garantia
      // Matching por customer_name ou customer_document
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_name,
          customer_document,
          order_type,
          status,
          created_at,
          notes,
          order_items(id, item_code, item_description, requested_quantity)
        `)
        .in('order_type', ['remessa_conserto', 'remessa_garantia'])
        .not('status', 'in', '("completed","cancelled")');

      // Construir filtro de match
      const filters = [];
      
      // Match por nome completo (case insensitive)
      if (userProfile.full_name) {
        filters.push(`customer_name.ilike.%${userProfile.full_name}%`);
      }
      
      // Match por documento
      if (userProfile.document) {
        // Remover formatação do documento para comparação
        const cleanDoc = userProfile.document.replace(/[^\d]/g, '');
        filters.push(`customer_document.ilike.%${cleanDoc}%`);
      }

      if (filters.length > 0) {
        query = query.or(filters.join(','));
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Formatar dados
      const formattedOrders: TechnicianOrder[] = (data || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_document: order.customer_document,
        order_type: order.order_type,
        status: order.status,
        created_at: order.created_at,
        notes: order.notes,
        items: (order.order_items || []).map((item: any) => ({
          id: item.id,
          item_code: item.item_code,
          item_description: item.item_description || '',
          quantity: item.requested_quantity || 0,
        })),
        items_count: order.order_items?.length || 0,
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Erro ao carregar remessas');
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  // Carregar dados iniciais
  useEffect(() => {
    fetchUserProfile().then((profile) => {
      if (profile) {
        // Profile carregado, orders serão buscadas pelo próximo useEffect
      } else {
        setLoading(false);
      }
    });
  }, [fetchUserProfile]);

  // Buscar orders quando profile estiver disponível
  useEffect(() => {
    if (userProfile) {
      fetchOrders();
    }
  }, [userProfile, fetchOrders]);

  // Calcular totais
  const totalItems = orders.reduce((acc, order) => 
    acc + order.items.reduce((sum, item) => sum + item.quantity, 0), 0
  );

  return {
    userProfile,
    orders,
    loading,
    totalItems,
    fetchOrders,
    // Compatibilidade com interface antiga (para TechnicianReturnForm e TechnicianTransferDialog)
    technicianInfo: userProfile ? {
      id: userProfile.id,
      name: userProfile.full_name,
      city: '',
      state: '',
      address: '',
    } : null,
    pendingItems: orders.map(order => ({
      id: order.id,
      origin_warehouse: 'imply_rs',
      items_pending: order.items.reduce((sum, item) => sum + item.quantity, 0),
      order: { order_number: order.order_number },
      items: order.items.map(item => ({
        id: item.id,
        item_code: item.item_code,
        item_description: item.item_description,
        quantity_sent: item.quantity,
        quantity_returned: 0,
        return_status: 'pending',
      })),
    })),
    fetchPendingItems: fetchOrders,
  };
}