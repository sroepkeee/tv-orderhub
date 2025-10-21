import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, TrendingUp, Truck, Package, Edit, FileText, Calendar } from "lucide-react";
import { getStatusLabel } from "@/lib/statusLabels";

interface TimelineEvent {
  id: string;
  timestamp: string;
  user: {
    name: string;
    id: string;
  };
  category: 'order_creation' | 'status_change' | 'shipping_info' | 'dimensions' | 'item_change' | 'field_update';
  title: string;
  description?: string;
  changes?: {
    from: string;
    to: string;
  };
  metadata?: {
    itemCode?: string;
    itemDescription?: string;
    notes?: string;
    fieldName?: string;
  };
}

interface EnhancedOrderTimelineProps {
  orderId: string;
}

const fieldLabels: Record<string, string> = {
  status: 'Status',
  priority: 'Prioridade',
  delivery_date: 'Data de Entrega',
  customer_name: 'Cliente',
  delivery_address: 'Endereço de Entrega',
  notes: 'Observações',
  carrier_name: 'Transportadora',
  tracking_code: 'Código de Rastreio',
  freight_type: 'Tipo de Frete',
  freight_value: 'Valor do Frete',
  vehicle_plate: 'Placa do Veículo',
  driver_name: 'Nome do Motorista',
  package_weight_kg: 'Peso do Pacote',
  package_volumes: 'Volumes',
  package_length_m: 'Comprimento',
  package_width_m: 'Largura',
  package_height_m: 'Altura',
  totvs_order_number: 'Pedido TOTVS',
  created: 'Criação',
  order_type: 'Tipo de Pedido',
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'order_creation':
      return <Plus className="h-4 w-4 text-white" />;
    case 'status_change':
      return <TrendingUp className="h-4 w-4 text-white" />;
    case 'shipping_info':
      return <Truck className="h-4 w-4 text-white" />;
    case 'dimensions':
      return <Package className="h-4 w-4 text-white" />;
    case 'item_change':
      return <FileText className="h-4 w-4 text-white" />;
    default:
      return <Edit className="h-4 w-4 text-white" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'order_creation':
      return 'bg-emerald-500';
    case 'status_change':
      return 'bg-blue-500';
    case 'shipping_info':
      return 'bg-green-500';
    case 'dimensions':
      return 'bg-purple-500';
    case 'item_change':
      return 'bg-orange-500';
    default:
      return 'bg-gray-500';
  }
};

const getCategoryBadge = (category: string) => {
  const labels = {
    'order_creation': '🎉 Criação',
    'status_change': '📊 Status',
    'shipping_info': '🚚 Frete',
    'dimensions': '📦 Dimensões',
    'item_change': '📝 Item',
    'field_update': '✏️ Edição',
  };

  return labels[category as keyof typeof labels] || category;
};

export const EnhancedOrderTimeline: React.FC<EnhancedOrderTimelineProps> = ({ orderId }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    statusChanges: 0,
    itemChanges: 0,
    shippingUpdates: 0,
    totalEvents: 0,
  });

  useEffect(() => {
    if (orderId) {
      loadUnifiedTimeline();
    }
  }, [orderId]);

  const loadUnifiedTimeline = async () => {
    setLoading(true);
    try {
      // 1. Mudanças gerais do pedido (order_changes)
      const { data: orderChanges } = await supabase
        .from('order_changes')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: false });

      console.log('📊 Order Changes carregados:', orderChanges?.length || 0);

      // 2. Mudanças de status (order_history)
      const { data: statusHistory } = await supabase
        .from('order_history')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: false });

      console.log('📈 Status History carregados:', statusHistory?.length || 0);

      // 3. Mudanças nos itens (order_item_history)
      const { data: itemHistory } = await supabase
        .from('order_item_history')
        .select('*, order_items(item_code, item_description)')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: false });

      console.log('📦 Item History carregados:', itemHistory?.length || 0);

      // 4. Buscar perfis de usuários separadamente
      const allUserIds = new Set<string>();
      
      orderChanges?.forEach(c => c.changed_by && allUserIds.add(c.changed_by));
      statusHistory?.forEach(h => h.user_id && allUserIds.add(h.user_id));
      itemHistory?.forEach(i => i.user_id && allUserIds.add(i.user_id));

      const userIds = Array.from(allUserIds).filter(id => id !== '00000000-0000-0000-0000-000000000000');
      
      let profilesMap = new Map<string, string>();
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        profiles?.forEach(p => {
          profilesMap.set(p.id, p.full_name || p.email || 'Usuário');
        });
      }

      console.log('👤 Perfis carregados:', profilesMap.size);

      // Helper para obter nome do usuário
      const getUserName = (userId: string): string => {
        if (userId === '00000000-0000-0000-0000-000000000000') {
          return 'Sistema Laboratório';
        }
        return profilesMap.get(userId) || 'Usuário';
      };

      // Unificar e mapear para TimelineEvent[]
      const timelineEvents: TimelineEvent[] = [
        ...(orderChanges || []).map(c => mapOrderChangeToEvent(c, getUserName)),
        ...(statusHistory || []).map(h => mapStatusHistoryToEvent(h, getUserName)),
        ...(itemHistory || []).map(i => mapItemHistoryToEvent(i, getUserName)),
      ].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      console.log('✅ Total de eventos mapeados:', timelineEvents.length);

      // Calcular estatísticas
      const statusChanges = timelineEvents.filter(e => e.category === 'status_change').length;
      const itemChanges = timelineEvents.filter(e => e.category === 'item_change').length;
      const shippingUpdates = timelineEvents.filter(e => e.category === 'shipping_info').length;

      setStats({
        statusChanges,
        itemChanges,
        shippingUpdates,
        totalEvents: timelineEvents.length,
      });

      setEvents(timelineEvents);
    } catch (error) {
      console.error('Erro ao carregar timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const mapOrderChangeToEvent = (change: any, getUserName: (id: string) => string): TimelineEvent => {
    const isCreation = change.field_name === 'created';
    
    return {
      id: change.id,
      timestamp: change.changed_at,
      user: {
        name: getUserName(change.changed_by),
        id: change.changed_by,
      },
      category: (change.change_category as any) || 'field_update',
      title: isCreation 
        ? (change.new_value === 'imported' ? 'Importou este pedido do TOTVS' : 'Criou este pedido manualmente')
        : `Alterou ${fieldLabels[change.field_name] || change.field_name}`,
      changes: isCreation ? undefined : {
        from: change.field_name === 'status' 
          ? getStatusLabel(change.old_value) 
          : (change.old_value || '(vazio)'),
        to: change.field_name === 'status' 
          ? getStatusLabel(change.new_value) 
          : (change.new_value || '(vazio)'),
      },
      metadata: {
        fieldName: change.field_name,
      },
    };
  };

  const mapStatusHistoryToEvent = (history: any, getUserName: (id: string) => string): TimelineEvent => {
    return {
      id: history.id,
      timestamp: history.changed_at,
      user: {
        name: getUserName(history.user_id),
        id: history.user_id,
      },
      category: 'status_change',
      title: 'Alterou Status',
      changes: {
        from: getStatusLabel(history.old_status),
        to: getStatusLabel(history.new_status),
      },
    };
  };

  const mapItemHistoryToEvent = (item: any, getUserName: (id: string) => string): TimelineEvent => {
    return {
      id: item.id,
      timestamp: item.changed_at,
      user: {
        name: getUserName(item.user_id),
        id: item.user_id,
      },
      category: 'item_change',
      title: `Alterou ${fieldLabels[item.field_changed] || item.field_changed} do item`,
      description: item.order_items?.item_description,
      changes: {
        from: item.old_value || '(vazio)',
        to: item.new_value || '(vazio)',
      },
      metadata: {
        itemCode: item.order_items?.item_code,
        notes: item.notes,
      },
    };
  };

  // Agrupar eventos por data/hora (mesmo minuto) e usuário
  const groupEventsByTimestamp = (events: TimelineEvent[]) => {
    const groups: { [key: string]: TimelineEvent[] } = {};
    
    events.forEach(event => {
      const minuteKey = format(new Date(event.timestamp), 'yyyy-MM-dd HH:mm');
      const groupKey = `${event.user.id}_${minuteKey}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(event);
    });

    return Object.values(groups);
  };

  const eventGroups = groupEventsByTimestamp(events);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum evento no histórico</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mini Dashboard de Estatísticas */}
      <div className="grid grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg">
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.statusChanges}</p>
          <p className="text-xs text-muted-foreground">Mudanças de Status</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-orange-600">{stats.itemChanges}</p>
          <p className="text-xs text-muted-foreground">Alterações em Itens</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{stats.shippingUpdates}</p>
          <p className="text-xs text-muted-foreground">Atualizações de Frete</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{stats.totalEvents}</p>
          <p className="text-xs text-muted-foreground">Total de Eventos</p>
        </div>
      </div>

      {/* Timeline Vertical Compacta */}
      <div className="relative space-y-2 pb-4">
        {/* Linha vertical da timeline */}
        <div className="absolute left-[15px] top-3 bottom-0 w-[2px] bg-border" />

        {eventGroups.map((group, groupIndex) => {
          const firstEvent = group[0];
          
          return (
            <div key={groupIndex} className="relative pl-10">
              {/* Ícone da categoria */}
              <div className={`absolute left-0 top-1 w-8 h-8 rounded-full ${getCategoryColor(firstEvent.category)} flex items-center justify-center shadow-sm border-2 border-background z-10`}>
                {getCategoryIcon(firstEvent.category)}
              </div>

              {/* Conteúdo do grupo */}
              <div className="space-y-1 pb-2">
                {/* Cabeçalho do grupo (usuário + tempo) */}
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-xs">
                      {firstEvent.user.name[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{firstEvent.user.name}</span>
                  <Badge variant="outline" className="h-5 text-xs px-2">
                    {getCategoryBadge(firstEvent.category)}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(firstEvent.timestamp), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                </div>

                {/* Eventos do grupo */}
                <div className="space-y-1">
                  {group.map((event, eventIndex) => (
                    <div 
                      key={event.id} 
                      className="text-sm pl-7 border-l-2 border-muted/50 ml-2 py-1.5 space-y-1"
                    >
                      <p className="font-medium text-foreground">{event.title}</p>
                      
                      {event.description && (
                        <p className="text-xs text-muted-foreground">
                          {event.description.length > 80 
                            ? `${event.description.substring(0, 80)}...` 
                            : event.description}
                        </p>
                      )}
                      
                      {event.changes && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="line-through text-muted-foreground bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded">
                            {event.changes.from.length > 40 
                              ? `${event.changes.from.substring(0, 40)}...` 
                              : event.changes.from}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium bg-green-50 dark:bg-green-950/20 px-2 py-0.5 rounded">
                            {event.changes.to.length > 40 
                              ? `${event.changes.to.substring(0, 40)}...` 
                              : event.changes.to}
                          </span>
                        </div>
                      )}
                      
                      {event.metadata?.itemCode && (
                        <p className="text-xs text-muted-foreground">
                          📦 Código: <span className="font-mono">{event.metadata.itemCode}</span>
                        </p>
                      )}
                      
                      {event.metadata?.notes && (
                        <p className="text-xs italic text-muted-foreground">
                          💬 {event.metadata.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Data/hora completa (exibida apenas uma vez por grupo) */}
                <div className="text-xs text-muted-foreground pl-7 pt-0.5">
                  {format(new Date(firstEvent.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
