import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, Package, Truck, TrendingDown, Box } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/metrics/MetricCard";
import { ProductionMetrics } from "@/components/metrics/ProductionMetrics";
import { PhaseTimeMetrics } from "@/components/metrics/PhaseTimeMetrics";
import { EnhancedDateChangeHistory } from "@/components/metrics/EnhancedDateChangeHistory";
import { SLAAlert } from "@/components/metrics/SLAAlert";
import { OrderTotvsMetrics } from "@/components/metrics/OrderTotvsMetrics";
import { ItemSourceMetrics } from "@/components/metrics/ItemSourceMetrics";
import { CriticalItemsAlert } from "@/components/metrics/CriticalItemsAlert";
import { ProductionTimeBySource } from "@/components/metrics/ProductionTimeBySource";
import { OrdersTrackingTable } from "@/components/metrics/OrdersTrackingTable";
import { EditOrderDialog } from "@/components/EditOrderDialog";
import { ComparativeMetrics } from "@/components/metrics/ComparativeMetrics";
import { StatusDistribution } from "@/components/metrics/StatusDistribution";
import { VolumeByType } from "@/components/metrics/VolumeByType";
import { ActivityTimeline } from "@/components/metrics/ActivityTimeline";
import { TrendCard } from "@/components/metrics/TrendCard";
import type { Order } from "@/components/Dashboard";
import { 
  calculateAverageProductionTime, 
  calculateOnTimeRate, 
  countDateChanges,
  getOrderCountByPhase,
  findProblematicOrders,
  countItemsBySource
} from "@/lib/metrics";
import { useNavigate } from "react-router-dom";

export default function Metrics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyChanges, setWeeklyChanges] = useState(0);
  const [problematicCount, setProblematicCount] = useState(0);
  const [itemsBySource, setItemsBySource] = useState({ inStock: 0, production: 0, outOfStock: 0 });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [previousWeekData, setPreviousWeekData] = useState({
    avgProductionTime: 0,
    onTimeRate: 0,
    weeklyChanges: 0
  });
  
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar apenas pedidos ativos (excluindo finalizados e cancelados)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .not('status', 'in', '(delivered,completed,cancelled)')
        .order('created_at', { ascending: false });
      
      if (ordersError) throw ordersError;
      
      // Transformar dados
      const transformedOrders: Order[] = (ordersData || []).map(dbOrder => ({
        id: dbOrder.id,
        type: dbOrder.order_type as any,
        priority: dbOrder.priority as any,
        orderNumber: dbOrder.order_number,
        item: dbOrder.customer_name,
        description: dbOrder.notes || "",
        quantity: 0,
        createdDate: new Date(dbOrder.created_at).toISOString().split('T')[0],
        issueDate: dbOrder.issue_date ? new Date(dbOrder.issue_date).toISOString().split('T')[0] : undefined,
        status: dbOrder.status as any,
        client: dbOrder.customer_name,
        deliveryDeadline: dbOrder.delivery_date,
        deskTicket: dbOrder.order_number,
      }));
      
      setOrders(transformedOrders);
      
      // Carregar mudanças semanais
      const changes = await countDateChanges(7);
      setWeeklyChanges(changes);
      
      // Carregar pedidos problemáticos
      const problematic = await findProblematicOrders(3);
      setProblematicCount(problematic.length);
      
      // Calcular distribuição de itens por origem
      const allItems = transformedOrders.flatMap(o => o.items || []);
      const itemsSource = countItemsBySource(allItems);
      setItemsBySource(itemsSource);

      // Calcular dados da semana anterior para comparação
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const previousWeekOrders = transformedOrders.filter(o => 
        new Date(o.createdDate) < oneWeekAgo
      );
      
      setPreviousWeekData({
        avgProductionTime: calculateAverageProductionTime(previousWeekOrders),
        onTimeRate: calculateOnTimeRate(previousWeekOrders, 10),
        weeklyChanges: await countDateChanges(14) - weeklyChanges // Diferença entre 14 dias e 7 dias
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
  
  const avgProductionTime = calculateAverageProductionTime(orders);
  const onTimeRate = calculateOnTimeRate(orders, 10);
  const productionCount = getOrderCountByPhase(orders, 'production');
  const logisticsCount = getOrderCountByPhase(orders, 'logistics');
  
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
        </div>
      </header>
      
      {/* SLA Alerts */}
      <SLAAlert orders={orders} threshold={2} />
      
      {/* Critical Items Alert */}
      <CriticalItemsAlert orders={orders} />
      
      {/* Grid de Cards Principais com Tendências */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <TrendCard
          title="Tempo Médio SSM"
          value={`${avgProductionTime}d`}
          previousValue={previousWeekData.avgProductionTime}
          subtitle="Meta: 10 dias"
          icon={Clock}
          status={getTimeStatus(avgProductionTime)}
        />
        
        <TrendCard
          title="Taxa de Cumprimento"
          value={`${onTimeRate}%`}
          previousValue={previousWeekData.onTimeRate}
          subtitle="Entregas no prazo"
          icon={CheckCircle}
          status={onTimeRate >= 85 ? 'good' : onTimeRate >= 70 ? 'warning' : 'critical'}
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
      
      {/* Tabela de Acompanhamento Detalhado */}
      <div className="mb-6">
        <OrdersTrackingTable 
          orders={orders}
          onOrderClick={(order) => {
            setSelectedOrder(order);
            setShowEditDialog(true);
          }}
        />
      </div>

      {/* Histórico Expandido de Mudanças de Prazos */}
      <div className="mb-6">
        <EnhancedDateChangeHistory limit={20} orders={orders} />
      </div>

      {/* Evolução e Comparativos */}
      <div className="mb-6">
        <ComparativeMetrics orders={orders} />
      </div>

      {/* Distribuições e Atividades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <StatusDistribution orders={orders} />
        <VolumeByType orders={orders} />
        <ActivityTimeline />
      </div>
      
      {/* Seções de Indicadores Detalhados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ProductionMetrics orders={orders} />
        <PhaseTimeMetrics orders={orders} />
      </div>
      
      {/* Indicadores de Origem dos Itens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ItemSourceMetrics orders={orders} />
        <ProductionTimeBySource orders={orders} />
      </div>
      
      {/* Integração TOTVS */}
      <div className="mb-6">
        <OrderTotvsMetrics orders={orders} />
      </div>

      {/* Dialog de Edição */}
      {selectedOrder && (
        <EditOrderDialog
          order={selectedOrder}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSave={(updatedOrder) => {
            loadData();
            setShowEditDialog(false);
          }}
        />
      )}
    </div>
  );
}
