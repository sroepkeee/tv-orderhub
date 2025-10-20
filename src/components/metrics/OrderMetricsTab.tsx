import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Order } from "@/components/Dashboard";
import { OrderItem } from "@/components/AddOrderDialog";
import { calculateDaysOpen, calculateDaysUntilDeadline, getDeadlineStatus, getPartialDeliveryInfo } from "@/lib/metrics";
import { Clock, Package, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import { OrderPhaseTimeline } from "./OrderPhaseTimeline";
import { CompactItemSLATable } from "./CompactItemSLATable";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OrderMetricsTabProps {
  order: Order;
  items: OrderItem[];
}

interface DateChange {
  id: string;
  old_date: string;
  new_date: string;
  changed_at: string;
  change_category: string | null;
  reason: string | null;
  notes: string | null;
}

export function OrderMetricsTab({ order, items }: OrderMetricsTabProps) {
  const [dateChanges, setDateChanges] = useState<DateChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDateChanges();
  }, [order.id]);

  const loadDateChanges = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_date_changes')
        .select('*')
        .eq('order_id', order.id)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      setDateChanges(data || []);
    } catch (error) {
      console.error('Error loading date changes:', error);
    } finally {
      setLoading(false);
    }
  };

  const daysOpen = calculateDaysOpen(order.createdDate, order.issueDate);
  const daysUntilDeadline = calculateDaysUntilDeadline(order.deliveryDeadline);
  const deadlineStatus = getDeadlineStatus(daysUntilDeadline);
  const { delivered: totalDelivered, total: totalRequested, percentage: percentDelivered } = getPartialDeliveryInfo(items);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'destructive';
      case 'warning': return 'default';
      case 'good': return 'secondary';
      default: return 'outline';
    }
  };

  const getCategoryLabel = (category: string | null) => {
    const labels: Record<string, string> = {
      'customer_request': 'Solicitação do Cliente',
      'production_delay': 'Atraso na Produção',
      'stock_issue': 'Problema de Estoque',
      'logistics_delay': 'Atraso na Logística',
      'planning_error': 'Erro de Planejamento',
      'other': 'Outro'
    };
    return labels[category || ''] || 'Não especificado';
  };

  return (
    <div className="space-y-6">
      {/* Cards de Resumo Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Geral</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{daysOpen} dias</div>
            <p className="text-xs text-muted-foreground">Tempo em aberto</p>
            <Badge variant="outline" className="mt-2">{order.status}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progresso de Itens</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDelivered}/{totalRequested}</div>
            <p className="text-xs text-muted-foreground">Itens entregues</p>
            <div className="mt-2 w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${percentDelivered}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazo Final</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{daysUntilDeadline} dias</div>
            <p className="text-xs text-muted-foreground">
              {daysUntilDeadline >= 0 ? 'Até o prazo' : 'Em atraso'}
            </p>
            <Badge variant={getStatusColor(deadlineStatus)} className="mt-2">
              {deadlineStatus === 'critical' ? 'Crítico' : deadlineStatus === 'warning' ? 'Atenção' : 'No Prazo'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Linha do Tempo de Fases */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Linha do Tempo de Fases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrderPhaseTimeline orderId={order.id} currentStatus={order.status} />
        </CardContent>
      </Card>

      {/* Status de SLA por Item */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Status de SLA por Item
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CompactItemSLATable items={items} />
        </CardContent>
      </Card>

      {/* Histórico de Mudanças de Prazo */}
      {dateChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Histórico de Mudanças de Prazo ({dateChanges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dateChanges.map((change) => (
                <div key={change.id} className="border-l-2 border-primary pl-4 py-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{getCategoryLabel(change.change_category)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(change.changed_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm mt-1">
                        De <span className="font-semibold">{new Date(change.old_date).toLocaleDateString('pt-BR')}</span> para{' '}
                        <span className="font-semibold">{new Date(change.new_date).toLocaleDateString('pt-BR')}</span>
                      </p>
                      {change.reason && (
                        <p className="text-sm text-muted-foreground mt-1">Motivo: {change.reason}</p>
                      )}
                      {change.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{change.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
