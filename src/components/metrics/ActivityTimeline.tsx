import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActivityEvent {
  id: string;
  type: 'status_change' | 'date_change' | 'order_created';
  order_number: string;
  description: string;
  timestamp: string;
}

export function ActivityTimeline() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      // Carregar mudanças de status recentes
      const { data: statusChanges } = await supabase
        .from('order_history')
        .select('*, orders!inner(order_number)')
        .order('changed_at', { ascending: false })
        .limit(5);

      // Carregar mudanças de data recentes
      const { data: dateChanges } = await supabase
        .from('delivery_date_changes')
        .select('*, orders!inner(order_number)')
        .order('changed_at', { ascending: false })
        .limit(5);

      // Carregar pedidos criados recentemente
      const { data: newOrders } = await supabase
        .from('orders')
        .select('id, order_number, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const events: ActivityEvent[] = [];

      // Adicionar mudanças de status
      statusChanges?.forEach(change => {
        events.push({
          id: change.id,
          type: 'status_change',
          order_number: change.orders.order_number,
          description: `Status alterado de "${change.old_status}" para "${change.new_status}"`,
          timestamp: change.changed_at
        });
      });

      // Adicionar mudanças de data
      dateChanges?.forEach(change => {
        events.push({
          id: change.id,
          type: 'date_change',
          order_number: change.orders.order_number,
          description: `Data de entrega alterada de ${change.old_date} para ${change.new_date}`,
          timestamp: change.changed_at
        });
      });

      // Adicionar pedidos novos
      newOrders?.forEach(order => {
        events.push({
          id: order.id,
          type: 'order_created',
          order_number: order.order_number,
          description: 'Pedido criado',
          timestamp: order.created_at
        });
      });

      // Ordenar por data mais recente
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(events.slice(0, 10));
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'status_change':
        return '🔄';
      case 'date_change':
        return '📅';
      case 'order_created':
        return '✨';
      default:
        return '•';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'status_change':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'date_change':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'order_created':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Atividades Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <CardTitle>Atividades Recentes</CardTitle>
        </div>
        <CardDescription>
          Últimas atualizações e mudanças em pedidos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma atividade recente
            </p>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="text-2xl">{getEventIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs font-medium">
                      {activity.order_number}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${getEventColor(activity.type)}`}>
                      {activity.type === 'status_change' && 'Status'}
                      {activity.type === 'date_change' && 'Data'}
                      {activity.type === 'order_created' && 'Novo'}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true,
                      locale: ptBR
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}