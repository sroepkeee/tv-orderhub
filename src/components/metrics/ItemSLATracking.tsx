import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, AlertTriangle, CheckCircle, Package, TrendingUp } from "lucide-react";
import { Order } from "@/components/Dashboard";
import { OrderItem } from "@/components/AddOrderDialog";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ItemSLATrackingProps {
  orders: Order[];
}

export const ItemSLATracking = ({ orders }: ItemSLATrackingProps) => {
  // Flatten all items from all orders with category info
  const allItems = orders.flatMap(order => 
    (order.items || []).map(item => ({
      ...item,
      orderNumber: order.orderNumber,
      orderId: order.id,
      orderCategory: order.order_category || 'outros'
    }))
  );

  // Calculate SLA status for each item
  const itemsWithSLA = allItems.map(item => {
    const today = new Date();
    const slaDeadline = item.sla_deadline ? parseISO(item.sla_deadline) : null;
    const deliveryDate = item.deliveryDate ? parseISO(item.deliveryDate) : null;
    
    let daysRemaining = 0;
    let slaStatus: 'on-track' | 'warning' | 'critical' | 'delayed' = 'on-track';
    let progress = 0;

    if (slaDeadline && deliveryDate) {
      daysRemaining = differenceInDays(slaDeadline, today);
      const totalDays = item.sla_days || 7;
      const daysPassed = totalDays - daysRemaining;
      progress = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));

      if (daysRemaining < 0) {
        slaStatus = 'delayed';
      } else if (daysRemaining <= 1) {
        slaStatus = 'critical';
      } else if (daysRemaining <= 3) {
        slaStatus = 'warning';
      }
    }

    return {
      ...item,
      daysRemaining,
      slaStatus,
      progress
    };
  });

  // Filter items by status
  const criticalItems = itemsWithSLA.filter(i => i.slaStatus === 'critical' || i.slaStatus === 'delayed');
  const warningItems = itemsWithSLA.filter(i => i.slaStatus === 'warning');
  const onTrackItems = itemsWithSLA.filter(i => i.slaStatus === 'on-track');

  // Calculate statistics
  const stats = {
    total: allItems.length,
    delayed: itemsWithSLA.filter(i => i.slaStatus === 'delayed').length,
    critical: itemsWithSLA.filter(i => i.slaStatus === 'critical').length,
    warning: warningItems.length,
    onTrack: onTrackItems.length,
    completed: allItems.filter(i => i.item_status === 'completed').length
  };

  const getSLABadge = (status: string) => {
    switch (status) {
      case 'delayed':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Atrasado</Badge>;
      case 'critical':
        return <Badge className="bg-orange-500 gap-1"><Clock className="h-3 w-3" /> Crítico</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500 gap-1"><Clock className="h-3 w-3" /> Atenção</Badge>;
      default:
        return <Badge className="bg-green-500 gap-1"><CheckCircle className="h-3 w-3" /> No Prazo</Badge>;
    }
  };

  const getSourceTypeBadge = (type: string | undefined) => {
    switch (type) {
      case 'in_stock':
        return <Badge variant="outline" className="text-green-700 border-green-300">📦 Estoque (2d)</Badge>;
      case 'production':
        return <Badge variant="outline" className="text-blue-700 border-blue-300">🏭 Produção (7d)</Badge>;
      case 'out_of_stock':
        return <Badge variant="outline" className="text-orange-700 border-orange-300">🛒 Compra (15d)</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const categoryLabels: Record<string, { label: string; color: string }> = {
      operacoes_especiais: { label: "Op. Especiais (7d)", color: "bg-purple-100 text-purple-700 border-purple-300" },
      reposicao: { label: "Reposição (7d)", color: "bg-blue-100 text-blue-700 border-blue-300" },
      vendas: { label: "Vendas (2d)", color: "bg-green-100 text-green-700 border-green-300" },
      outros: { label: "Outros (7d)", color: "bg-gray-100 text-gray-700 border-gray-300" }
    };
    
    const config = categoryLabels[category] || categoryLabels.outros;
    return <Badge variant="outline" className={config.color}>{config.label}</Badge>;
  };

  const getCurrentPhaseBadge = (phase: string | undefined) => {
    switch (phase) {
      case 'pending':
        return <Badge variant="secondary">Pendente</Badge>;
      case 'in_process':
        return <Badge className="bg-blue-500">Em Processo</Badge>;
      case 'quality_check':
        return <Badge className="bg-purple-500">Qualidade</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Concluído</Badge>;
      case 'delayed':
        return <Badge variant="destructive">Atrasado</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>

        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-xs text-red-600">Atrasados</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.delayed}</div>
        </Card>

        <Card className="p-4 border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-orange-600" />
            <span className="text-xs text-orange-600">Críticos</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">{stats.critical}</div>
        </Card>

        <Card className="p-4 border-yellow-200 bg-yellow-50">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-yellow-600" />
            <span className="text-xs text-yellow-600">Atenção</span>
          </div>
          <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
        </Card>

        <Card className="p-4 border-green-200 bg-green-50">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-600">No Prazo</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.onTrack}</div>
        </Card>

        <Card className="p-4 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-blue-600">Concluídos</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
        </Card>
      </div>

      {/* Detailed Item Tracking Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Rastreamento Detalhado de Itens por SLA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Pedido</TableHead>
                  <TableHead className="w-[120px]">Código</TableHead>
                  <TableHead className="min-w-[200px]">Descrição</TableHead>
                  <TableHead className="w-[150px]">Categoria</TableHead>
                  <TableHead className="w-[130px]">Tipo/SLA</TableHead>
                  <TableHead className="w-[120px]">Fase Atual</TableHead>
                  <TableHead className="w-[120px]">Prazo SLA</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[150px]">Progresso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsWithSLA.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum item encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  itemsWithSLA
                    .filter(item => item.item_status !== 'completed')
                    .sort((a, b) => a.daysRemaining - b.daysRemaining)
                    .map((item, idx) => (
                      <TableRow key={idx} className={
                        item.slaStatus === 'delayed' ? 'bg-red-50' :
                        item.slaStatus === 'critical' ? 'bg-orange-50' :
                        item.slaStatus === 'warning' ? 'bg-yellow-50' :
                        ''
                      }>
                        <TableCell className="font-medium">{item.orderNumber}</TableCell>
                        <TableCell className="font-mono text-sm">{item.itemCode}</TableCell>
                        <TableCell className="text-sm">{item.itemDescription}</TableCell>
                        <TableCell>
                          {getCategoryBadge((item as any).orderCategory)}
                        </TableCell>
                        <TableCell>
                          {getSourceTypeBadge(item.item_source_type)}
                          <div className="text-xs text-muted-foreground mt-1">
                            SLA Item: {item.sla_days || 7} dias
                          </div>
                        </TableCell>
                        <TableCell>{getCurrentPhaseBadge(item.current_phase)}</TableCell>
                        <TableCell>
                          {item.sla_deadline ? (
                            <div className="text-sm">
                              {format(parseISO(item.sla_deadline), "dd/MM/yyyy", { locale: ptBR })}
                              <div className={`text-xs ${
                                item.daysRemaining < 0 ? 'text-red-600' :
                                item.daysRemaining <= 1 ? 'text-orange-600' :
                                item.daysRemaining <= 3 ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {item.daysRemaining < 0 ? 
                                  `${Math.abs(item.daysRemaining)}d atrasado` :
                                  `${item.daysRemaining}d restantes`
                                }
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getSLABadge(item.slaStatus)}</TableCell>
                        <TableCell>
                          <Progress 
                            value={item.progress} 
                            className={`h-2 ${
                              item.slaStatus === 'delayed' ? '[&>div]:bg-red-500' :
                              item.slaStatus === 'critical' ? '[&>div]:bg-orange-500' :
                              item.slaStatus === 'warning' ? '[&>div]:bg-yellow-500' :
                              '[&>div]:bg-green-500'
                            }`}
                          />
                          <div className="text-xs text-muted-foreground mt-1">
                            {Math.round(item.progress)}%
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
