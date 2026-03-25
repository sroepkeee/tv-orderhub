import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, Package, Truck, TrendingDown, Box, Search, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/metrics/MetricCard";
import { EnhancedDateChangeHistory } from "@/components/metrics/EnhancedDateChangeHistory";
import { SLAAlert } from "@/components/metrics/SLAAlert";
import { OrdersTrackingTable } from "@/components/metrics/OrdersTrackingTable";
import { EditOrderDialog } from "@/components/EditOrderDialog";
import { ComparativeMetrics } from "@/components/metrics/ComparativeMetrics";
import { TrendCard } from "@/components/metrics/TrendCard";
import { CategorySLAMetrics } from "@/components/metrics/CategorySLAMetrics";
import { CompletedOrdersTable } from "@/components/metrics/CompletedOrdersTable";
import type { Order } from "@/components/Dashboard";
import { cleanItemDescription } from "@/lib/utils";
import { 
  calculateAverageProductionTime, 
  calculateOnTimeRate, 
  countDateChanges,
  getOrderCountByPhase,
  findProblematicOrders,
  countItemsBySource
} from "@/lib/metrics";
import { 
  calculateRealOnTimeRate, 
  calculateProductionTimeRange, 
  separateOrdersByDeadline,
  getOrdersStartedToday,
  getOrdersEndingToday
} from "@/lib/metricsV2";

import { PhasePerformanceMetrics } from "@/components/metrics/PhasePerformanceMetrics";
import { DepartmentLeaderboard } from "@/components/metrics/DepartmentLeaderboard";
import { BottleneckAnalysis } from "@/components/metrics/BottleneckAnalysis";
import { ItemSourceAnalytics } from "@/components/metrics/ItemSourceAnalytics";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

export default function Metrics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyChanges, setWeeklyChanges] = useState(0);
  const [problematicCount, setProblematicCount] = useState(0);
  const [itemsBySource, setItemsBySource] = useState({ inStock: 0, production: 0, outOfStock: 0 });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [previousWeekData, setPreviousWeekData] = useState({
    avgProductionTime: 0,
    onTimeRate: 0,
    weeklyChanges: 0
  });

  const filterOrder = (order: Order, query: string): boolean => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    const isNumeric = /^\d+$/.test(q);
    
    if (isNumeric) {
      if (order.orderNumber?.includes(q)) return true;
      if ((order as any).totvsOrderNumber?.includes(q)) return true;
      if (order.items?.some(item => item.itemCode?.toLowerCase().includes(q))) return true;
    }
    
    if (order.orderNumber?.toLowerCase().includes(q)) return true;
    if (order.client?.toLowerCase().includes(q)) return true;
    if (order.deskTicket?.toLowerCase().includes(q)) return true;
    if (order.items?.some(item => 
      item.itemCode?.toLowerCase().includes(q) || 
      item.itemDescription?.toLowerCase().includes(q)
    )) return true;
    
    return false;
  };

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    return orders.filter(o => filterOrder(o, searchQuery));
  }, [orders, searchQuery]);

  const filteredCompletedOrders = useMemo(() => {
    if (!searchQuery.trim()) return completedOrders;
    return completedOrders.filter(o => filterOrder(o, searchQuery));
  }, [completedOrders, searchQuery]);
  
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      // Executar TODAS as queries em paralelo
      const [activeResult, completedResult, changes, problematic, changes14] = await Promise.all([
        // Query 1: Pedidos ativos
        supabase
          .from('orders')
          .select(`*, order_items (*)`)
          .not('status', 'in', '(delivered,completed,cancelled)')
          .order('created_at', { ascending: false }),
        // Query 2: Pedidos concluídos (campos restritos)
        supabase
          .from('orders')
          .select(`
            id, order_number, customer_name, status, order_type, priority,
            created_at, updated_at, delivery_date, issue_date, order_category, notes, user_id,
            order_items (id, item_code, item_description, requested_quantity, 
                         delivered_quantity, unit, item_source_type, item_status, 
                         sla_days, sla_deadline, delivery_date, user_id, warehouse,
                         is_imported, import_lead_time_days, current_phase, phase_started_at,
                         production_estimated_date, received_status, unit_price, 
                         discount_percent, total_value, ipi_percent, icms_percent)
          `)
          .in('status', ['completed', 'delivered'])
          .order('updated_at', { ascending: false })
          .range(0, 499),
        // Query 3-5: Métricas auxiliares
        countDateChanges(7),
        findProblematicOrders(3),
        countDateChanges(14),
      ]);

      if (activeResult.error) throw activeResult.error;

      const transformOrder = (dbOrder: any): Order => {
        const createdDate = new Date(dbOrder.created_at);
        const now = new Date();
        const daysOpen = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: dbOrder.id,
          type: dbOrder.order_type as any,
          priority: dbOrder.priority as any,
          orderNumber: dbOrder.order_number,
          item: dbOrder.customer_name,
          description: dbOrder.notes || "",
          quantity: 0,
          createdDate: createdDate.toISOString().split('T')[0],
          issueDate: dbOrder.issue_date ? new Date(dbOrder.issue_date).toISOString().split('T')[0] : undefined,
          status: dbOrder.status as any,
          client: dbOrder.customer_name,
          deliveryDeadline: dbOrder.delivery_date,
          deskTicket: dbOrder.order_number,
          order_category: dbOrder.order_category,
          daysOpen,
          items: (dbOrder.order_items || []).map((item: any) => ({
            id: item.id,
            itemCode: item.item_code,
            itemDescription: cleanItemDescription(item.item_description),
            requestedQuantity: item.requested_quantity,
            deliveredQuantity: item.delivered_quantity,
            unit: item.unit,
            warehouse: item.warehouse,
            deliveryDate: item.delivery_date,
            userId: item.user_id,
            item_source_type: item.item_source_type as 'in_stock' | 'production' | 'out_of_stock',
            item_status: item.item_status as 'pending' | 'in_stock' | 'awaiting_production' | 'purchase_required' | 'completed',
            sla_days: item.sla_days,
            is_imported: item.is_imported,
            import_lead_time_days: item.import_lead_time_days,
            sla_deadline: item.sla_deadline,
            current_phase: item.current_phase,
            phase_started_at: item.phase_started_at,
            production_estimated_date: item.production_estimated_date,
            received_status: item.received_status,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
            total_value: item.total_value,
            ipi_percent: item.ipi_percent,
            icms_percent: item.icms_percent,
          }))
        };
      };

      const transformedOrders = (activeResult.data || []).map(transformOrder);
      setOrders(transformedOrders);

      if (!completedResult.error && completedResult.data) {
        setCompletedOrders(completedResult.data.map(transformOrder));
      }

      // Métricas síncronas
      const allItems = transformedOrders.flatMap(o => o.items || []);
      setItemsBySource(countItemsBySource(allItems));
      setWeeklyChanges(changes);
      setProblematicCount(problematic.length);

      // Comparação com semana anterior
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const previousWeekOrders = transformedOrders.filter(o => 
        new Date(o.createdDate) < oneWeekAgo
      );
      
      setPreviousWeekData({
        avgProductionTime: calculateAverageProductionTime(previousWeekOrders),
        onTimeRate: calculateOnTimeRate(previousWeekOrders, 10),
        weeklyChanges: changes14 - changes
      });
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando indicadores...</p>
        </div>
      </div>
    );
  }
  
  const avgProductionTime = calculateAverageProductionTime(filteredOrders);
  const realOnTimeRate = calculateRealOnTimeRate(filteredOrders);
  const onTimeRate = calculateOnTimeRate(filteredOrders, 10);
  const productionCount = getOrderCountByPhase(filteredOrders, 'production');
  const logisticsCount = getOrderCountByPhase(filteredOrders, 'logistics');
  const productionTimeRange = calculateProductionTimeRange(filteredOrders);
  const ordersByDeadline = separateOrdersByDeadline(filteredOrders);
  const ordersStartedToday = getOrdersStartedToday(filteredOrders);
  const ordersEndingToday = getOrdersEndingToday(filteredOrders);
  
  const getTimeStatus = (days: number): 'good' | 'warning' | 'critical' => {
    if (days <= 10) return 'good';
    if (days <= 12) return 'warning';
    return 'critical';
  };
  
  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-3xl font-bold">📊 Indicadores de Performance</h1>
            </div>
            <p className="text-muted-foreground ml-14">Monitoramento em tempo real da produção e logística</p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pedido, código, cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>
      

      {/* SLA Alerts */}
      <SLAAlert orders={filteredOrders} threshold={2} />
      
      {/* Grid de Cards Principais com Tendências */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <TrendCard
          title="Tempo Médio SSM"
          value={`${avgProductionTime}d`}
          previousValue={previousWeekData.avgProductionTime}
          subtitle="Meta: 10 dias"
          icon={Clock}
          status={getTimeStatus(avgProductionTime)}
          additionalMetrics={[
            { label: "Mais rápido", value: `${productionTimeRange.min}d` },
            { label: "Mais lento", value: `${productionTimeRange.max}d` },
            { label: "Mediana", value: `${productionTimeRange.median}d` }
          ]}
        />
        
        <TrendCard
          title="Taxa de Cumprimento"
          value={`${realOnTimeRate}%`}
          previousValue={previousWeekData.onTimeRate}
          subtitle="Pedidos no prazo"
          icon={CheckCircle}
          status={realOnTimeRate >= 85 ? 'good' : realOnTimeRate >= 70 ? 'warning' : 'critical'}
          additionalMetrics={[
            { label: "No prazo", value: ordersByDeadline.onTime },
            { label: "Atrasados", value: ordersByDeadline.late, highlight: ordersByDeadline.late > 0 },
            { label: "Meta", value: "85%" }
          ]}
        />
        
        <TrendCard
          title="Mudanças de Prazo"
          value={weeklyChanges}
          previousValue={previousWeekData.weeklyChanges}
          subtitle="Últimos 7 dias"
          icon={AlertTriangle}
          status={weeklyChanges <= 5 ? 'good' : weeklyChanges <= 10 ? 'warning' : 'critical'}
        />
        
        <MetricCard
          title="Em Produção"
          value={productionCount}
          subtitle="Pedidos ativos"
          icon={Package}
          additionalMetrics={[
            { label: "Iniciados hoje", value: ordersStartedToday },
            { label: "Finalizando hoje", value: ordersEndingToday, highlight: ordersEndingToday > 0 },
            { label: "Tempo médio", value: `${avgProductionTime}d` }
          ]}
        />
        
        <MetricCard
          title="Em Logística"
          value={logisticsCount}
          subtitle="Em trânsito/expedição"
          icon={Truck}
        />
        
        <MetricCard
          title="Itens sem Estoque"
          value={itemsBySource.outOfStock}
          subtitle={`${itemsBySource.production} em produção`}
          icon={Box}
          status={itemsBySource.outOfStock === 0 ? 'good' : itemsBySource.outOfStock <= 5 ? 'warning' : 'critical'}
        />
      </div>
      
      {/* Evolução e Comparativos */}
      <div className="mb-6">
        <ComparativeMetrics orders={filteredOrders} />
      </div>

      {/* Tabela de Acompanhamento Detalhado */}
      <div className="mb-6">
        <OrdersTrackingTable 
          searchQuery={searchQuery}
          onOrderClick={(order) => {
            setSelectedOrder(order);
            setShowEditDialog(true);
          }}
        />
      </div>

      {/* Histórico de Mudanças de Prazos (Últimas 10) */}
      <div className="mb-6">
        <EnhancedDateChangeHistory limit={10} orders={filteredOrders} />
      </div>

      {/* Performance de SLA por Categoria */}
      <div className="mb-6">
        <CategorySLAMetrics orders={filteredOrders} />
      </div>

      {/* Pedidos Concluídos */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">✅ Pedidos Concluídos ({filteredCompletedOrders.length})</h2>
        <CompletedOrdersTable 
          orders={filteredCompletedOrders}
          onOrderClick={(order) => {
            setSelectedOrder(order);
            setShowEditDialog(true);
          }}
        />
      </div>

      {/* Dialog de Edição */}
      {selectedOrder && (
        <EditOrderDialog
          order={selectedOrder}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
              onSave={async (updatedOrder) => {
                try {
                  // 1. Buscar pedido original para comparar
                  const { data: originalOrder, error: fetchError } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('id', updatedOrder.id)
                    .maybeSingle();

                  if (fetchError) throw fetchError;
                  if (!originalOrder) throw new Error('Pedido não encontrado.');

                  // 2. Detectar mudanças
                  const changes = [];
                  const fieldMap = {
                    customer_name: { old: originalOrder.customer_name, new: updatedOrder.client },
                    delivery_date: { old: originalOrder.delivery_date, new: updatedOrder.deliveryDeadline },
                    status: { old: originalOrder.status, new: updatedOrder.status },
                    priority: { old: originalOrder.priority, new: updatedOrder.priority },
                    order_type: { old: originalOrder.order_type, new: updatedOrder.type },
                    notes: { old: originalOrder.notes, new: updatedOrder.deskTicket },
                  };

                  for (const [field, values] of Object.entries(fieldMap)) {
                    if (values.old !== values.new) {
                      changes.push({
                        order_id: updatedOrder.id,
                        changed_by: user!.id,
                        field_name: field,
                        old_value: String(values.old || ''),
                        new_value: String(values.new || ''),
                      });
                    }
                  }

                  // 3. Atualizar pedido
                  const { data: row, error: updateError } = await supabase
                    .from('orders')
                    .update({
                      customer_name: updatedOrder.client,
                      delivery_address: updatedOrder.client,
                      delivery_date: updatedOrder.deliveryDeadline,
                      status: updatedOrder.status,
                      priority: updatedOrder.priority,
                      order_type: updatedOrder.type,
                      notes: updatedOrder.deskTicket,
                      totvs_order_number: (updatedOrder as any).totvsOrderNumber || null,
                    })
                    .eq('id', updatedOrder.id)
                    .select('id')
                    .maybeSingle();

                  if (updateError) throw updateError;
                  if (!row) throw new Error('Falha ao salvar alterações.');

                  // 4. Registrar auditoria (se houver mudanças)
                  if (changes.length > 0) {
                    const { error: auditError } = await supabase
                      .from('order_changes')
                      .insert(changes);

                    if (auditError) {
                      console.error('⚠️ Falha ao registrar auditoria:', auditError);
                      // Não falhar a operação por falha na auditoria
                    }
                  }

                  toast({
                    title: 'Pedido atualizado',
                    description: `${changes.length} alteração(ões) salva(s) com sucesso.`,
                  });

                  await loadData();
                  setShowEditDialog(false);
                } catch (err: any) {
                  console.error('Erro ao atualizar pedido:', err);
                  toast({
                    title: 'Erro ao salvar',
                    description: err.message || 'Não foi possível salvar as alterações.',
                    variant: 'destructive',
                  });
                }
              }}
        />
      )}
    </div>
  );
}
