import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import type { Order } from "@/components/Dashboard";
import type { OrderItem } from "@/components/AddOrderDialog";
import { calculateDaysOpen, calculateDaysUntilDeadline, getDeadlineStatus, getPartialDeliveryInfo, countOrderDateChanges } from "@/lib/metrics";
import { Calendar, TrendingUp, Package, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn, cleanItemDescription } from "@/lib/utils";
interface OrdersTrackingTableProps {
  orders: Order[];
  onOrderClick: (order: Order) => void;
}
interface OrderWithDetails extends Order {
  items?: OrderItem[];
  dateChangesCount?: number;
}
type SortField = 'orderNumber' | 'client' | 'orderType' | 'itemsQuantity' | 'status' | 'issueDate' | 'deliveryDeadline' | 'daysOpen' | 'deadline' | 'dateChanges';
type SortDirection = 'asc' | 'desc';

export function OrdersTrackingTable({
  orders,
  onOrderClick
}: OrdersTrackingTableProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'good'>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [ordersWithDetails, setOrdersWithDetails] = useState<OrderWithDetails[]>([]);
  const [orderTypes, setOrderTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  useEffect(() => {
    loadOrderDetails();
    loadOrderTypes();
  }, [orders]);

  const loadOrderTypes = async () => {
    const { data } = await supabase
      .from('order_type_config')
      .select('*')
      .order('display_name');
    
    if (data) {
      setOrderTypes(data);
    }
  };
  const loadOrderDetails = async () => {
    setLoading(true);
    try {
      const enrichedOrders = await Promise.all(orders.map(async order => {
        // Carregar itens do pedido
        const {
          data: itemsData
        } = await supabase.from('order_items').select('*').eq('order_id', order.id);

        // Transformar itens do formato do banco para OrderItem
        const items: OrderItem[] = (itemsData || []).map(item => ({
          id: item.id,
          itemCode: item.item_code,
          itemDescription: cleanItemDescription(item.item_description),
          requestedQuantity: item.requested_quantity,
          deliveredQuantity: item.delivered_quantity,
          unit: item.unit,
          warehouse: item.warehouse,
          deliveryDate: item.delivery_date,
          item_source_type: item.item_source_type as 'in_stock' | 'production' | 'out_of_stock',
          production_estimated_date: item.production_estimated_date || undefined,
          received_status: item.received_status as 'pending' | 'partial' | 'completed'
        }));

        // Contar mudanças de prazo
        const dateChanges = await countOrderDateChanges(order.id);
        return {
          ...order,
          items,
          dateChangesCount: dateChanges
        };
      }));
      setOrdersWithDetails(enrichedOrders);
    } catch (error) {
      console.error('Erro ao carregar detalhes dos pedidos:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const getFilteredOrders = () => {
    let filtered = ordersWithDetails;
    
    // Filtrar por prazo (crítico, atenção, em dia)
    if (filter !== 'all') {
      filtered = filtered.filter(order => {
        const daysUntil = calculateDaysUntilDeadline(order.deliveryDeadline);
        const status = getDeadlineStatus(daysUntil);
        return status === filter;
      });
    }
    
    // Filtrar por tipo de pedido
    if (orderTypeFilter !== 'all') {
      filtered = filtered.filter(order => order.type === orderTypeFilter);
    }

    // Aplicar ordenação
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case 'orderNumber':
            aValue = a.orderNumber;
            bValue = b.orderNumber;
            break;
          case 'client':
            aValue = a.client.toLowerCase();
            bValue = b.client.toLowerCase();
            break;
          case 'orderType':
            aValue = a.type?.toLowerCase() || '';
            bValue = b.type?.toLowerCase() || '';
            break;
          case 'itemsQuantity':
            aValue = (a.items || []).reduce((sum, item) => sum + item.requestedQuantity, 0);
            bValue = (b.items || []).reduce((sum, item) => sum + item.requestedQuantity, 0);
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'issueDate':
            aValue = a.issueDate ? new Date(a.issueDate).getTime() : 0;
            bValue = b.issueDate ? new Date(b.issueDate).getTime() : 0;
            break;
          case 'deliveryDeadline':
            aValue = new Date(a.deliveryDeadline).getTime();
            bValue = new Date(b.deliveryDeadline).getTime();
            break;
          case 'daysOpen':
            aValue = calculateDaysOpen(a.createdDate);
            bValue = calculateDaysOpen(b.createdDate);
            break;
          case 'deadline':
            aValue = calculateDaysUntilDeadline(a.deliveryDeadline);
            bValue = calculateDaysUntilDeadline(b.deliveryDeadline);
            break;
          case 'dateChanges':
            aValue = a.dateChangesCount || 0;
            bValue = b.dateChangesCount || 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };
  const getOrderTypeBadge = (type: string) => {
    // Buscar configuração do tipo
    const typeConfig = orderTypes.find(t => t.order_type === type);
    
    if (typeConfig) {
      // Cores por categoria
      const categoryColors: Record<string, string> = {
        vendas: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
        estoque: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        producao: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        logistica: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
        outros: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
      };
      
      const colorClass = categoryColors[typeConfig.category] || categoryColors.outros;
      
      return (
        <Badge 
          variant="outline" 
          className={cn("text-xs font-medium", colorClass)}
        >
          {typeConfig.icon} {typeConfig.display_name}
        </Badge>
      );
    }
    
    // Fallback para tipos antigos
    return (
      <Badge 
        variant="outline" 
        className="text-xs font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20"
      >
        📋 {type}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, {
      label: string;
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
    }> = {
      pending: {
        label: 'Pendente',
        variant: 'outline'
      },
      in_analysis: {
        label: 'Em Análise',
        variant: 'secondary'
      },
      in_production: {
        label: 'Em Produção',
        variant: 'default'
      },
      completed: {
        label: 'Concluído',
        variant: 'default'
      },
      delivered: {
        label: 'Entregue',
        variant: 'default'
      }
    };
    const config = statusMap[status] || {
      label: status,
      variant: 'outline' as const
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
  const getDeadlineBadge = (daysUntil: number) => {
    const status = getDeadlineStatus(daysUntil);
    const bgColor = status === 'critical' ? 'bg-destructive/10 text-destructive' : status === 'warning' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500' : 'bg-green-500/10 text-green-600 dark:text-green-500';
    const label = daysUntil < 0 ? `${Math.abs(daysUntil)}d atrasado` : daysUntil === 0 ? 'Hoje' : `${daysUntil}d restantes`;
    return <div className={`px-3 py-1 rounded-md text-sm font-semibold ${bgColor} text-center min-w-[90px]`}>
        {label}
      </div>;
  };
  const getItemSourceBadges = (items: OrderItem[]) => {
    const inStock = items.filter(i => i.item_source_type === 'in_stock' || !i.item_source_type).length;
    const production = items.filter(i => i.item_source_type === 'production').length;
    const outOfStock = items.filter(i => i.item_source_type === 'out_of_stock').length;
    return <div className="flex gap-1 flex-wrap">
        {inStock > 0 && <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
            {inStock} Est.
          </Badge>}
        {production > 0 && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
            {production} Prod.
          </Badge>}
        {outOfStock > 0 && <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
            {outOfStock} S/Est.
          </Badge>}
      </div>;
  };
  const filteredOrders = getFilteredOrders();
  if (loading) {
    return <div className="bg-card border rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>;
  }
  return <div className="bg-card border rounded-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          📋 Acompanhamento Detalhado de Pedidos
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Visão completa do status e prazos de todos os pedidos - Clique em qualquer linha para ver detalhes
        </p>

        {/* Filtros por Prazo */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Filtrar por Prazo</h3>
            <div className="flex gap-2 flex-wrap">
              <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
                Todos ({ordersWithDetails.length})
              </Button>
              <Button variant={filter === 'critical' ? 'destructive' : 'outline'} size="sm" onClick={() => setFilter('critical')}>
                Críticos ({ordersWithDetails.filter(o => getDeadlineStatus(calculateDaysUntilDeadline(o.deliveryDeadline)) === 'critical').length})
              </Button>
              <Button variant={filter === 'warning' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('warning')} className={filter === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}>
                Atenção ({ordersWithDetails.filter(o => getDeadlineStatus(calculateDaysUntilDeadline(o.deliveryDeadline)) === 'warning').length})
              </Button>
              <Button variant={filter === 'good' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('good')} className={filter === 'good' ? 'bg-green-600 hover:bg-green-700' : ''}>
                Em dia ({ordersWithDetails.filter(o => getDeadlineStatus(calculateDaysUntilDeadline(o.deliveryDeadline)) === 'good').length})
              </Button>
            </div>
          </div>

          {/* Filtros por Tipo de Pedido */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Filtrar por Tipo de Pedido</h3>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant={orderTypeFilter === 'all' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setOrderTypeFilter('all')}
              >
                Todos os Tipos ({ordersWithDetails.length})
              </Button>
              {orderTypes.map(typeConfig => {
                const count = ordersWithDetails.filter(o => o.type === typeConfig.order_type).length;
                if (count === 0) return null;
                
                return (
                  <Button 
                    key={typeConfig.order_type}
                    variant={orderTypeFilter === typeConfig.order_type ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setOrderTypeFilter(typeConfig.order_type)}
                  >
                    {typeConfig.icon} {typeConfig.display_name} ({count})
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('orderNumber')}>
                Nº Pedido{getSortIcon('orderNumber')}
              </TableHead>
              <TableHead className="min-w-[150px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('client')}>
                Cliente{getSortIcon('client')}
              </TableHead>
              <TableHead className="min-w-[180px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('orderType')}>
                Tipo{getSortIcon('orderType')}
              </TableHead>
              <TableHead className="min-w-[90px] text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('itemsQuantity')}>
                Qtd. Itens{getSortIcon('itemsQuantity')}
              </TableHead>
              <TableHead className="min-w-[120px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                Status{getSortIcon('status')}
              </TableHead>
              <TableHead className="min-w-[120px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('issueDate')}>
                Data de Emissão{getSortIcon('issueDate')}
              </TableHead>
              <TableHead className="min-w-[120px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('deliveryDeadline')}>
                Data de Entrega{getSortIcon('deliveryDeadline')}
              </TableHead>
              <TableHead className="min-w-[90px] text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('daysOpen')}>
                Dias Aberto{getSortIcon('daysOpen')}
              </TableHead>
              <TableHead className="min-w-[120px] text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('deadline')}>
                Prazo{getSortIcon('deadline')}
              </TableHead>
              <TableHead className="min-w-[150px]">Entregas Parciais</TableHead>
              <TableHead className="min-w-[140px]">Origem Itens</TableHead>
              <TableHead className="min-w-[80px] text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort('dateChanges')}>
                Mudanças{getSortIcon('dateChanges')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  Nenhum pedido encontrado com os filtros selecionados
                </TableCell>
              </TableRow> : filteredOrders.map(order => {
            const daysOpen = calculateDaysOpen(order.createdDate);
            const daysUntil = calculateDaysUntilDeadline(order.deliveryDeadline);
            const deliveryInfo = getPartialDeliveryInfo(order.items || []);
            const deliveryPercentage = deliveryInfo.total > 0 ? Math.round(deliveryInfo.delivered / deliveryInfo.total * 100) : 0;

            // Calcular quantidade total de itens do pedido
            const totalItemsQuantity = (order.items || []).reduce((sum, item) => sum + item.requestedQuantity, 0);
            const isCritical = daysUntil <= 2 && daysUntil >= 0;
            return <TableRow key={order.id} className={cn("cursor-pointer hover:bg-muted/50 transition-colors", isCritical && "animate-pulse-critical")} onClick={() => onOrderClick(order)}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{order.client}</TableCell>
                    <TableCell>
                      {getOrderTypeBadge(order.type)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-sm font-semibold">
                        <Package className="h-3 w-3 mr-1" />
                        {totalItemsQuantity}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {order.issueDate || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {order.deliveryDeadline}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {daysOpen}d
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {getDeadlineBadge(daysUntil)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {deliveryInfo.delivered}/{deliveryInfo.total} itens ({deliveryPercentage}%)
                        </div>
                        <Progress value={deliveryPercentage} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>
                      {getItemSourceBadges(order.items || [])}
                    </TableCell>
                    <TableCell className="text-center">
                      {order.dateChangesCount && order.dateChangesCount > 0 ? <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                          🔄 {order.dateChangesCount}
                        </Badge> : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
                  </TableRow>;
          })}
          </TableBody>
        </Table>
      </div>
    </div>;
}