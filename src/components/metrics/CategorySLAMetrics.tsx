import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { Order } from "@/components/Dashboard";
import { differenceInDays, parseISO } from "date-fns";

interface CategorySLAMetricsProps {
  orders: Order[];
}

const categoryConfig = {
  operacoes_especiais: {
    label: "Operações Especiais",
    color: "#8b5cf6",
    slaDays: 7
  },
  reposicao: {
    label: "Reposição",
    color: "#3b82f6",
    slaDays: 7
  },
  vendas: {
    label: "Vendas",
    color: "#10b981",
    slaDays: 2
  },
  outros: {
    label: "Outros",
    color: "#94a3b8",
    slaDays: 7
  }
};

export function CategorySLAMetrics({ orders }: CategorySLAMetricsProps) {
  // Agrupar pedidos por categoria e calcular métricas
  const categoryStats = Object.entries(categoryConfig).map(([key, config]) => {
    const categoryOrders = orders.filter(o => (o.order_category || 'outros') === key);
    
    if (categoryOrders.length === 0) {
      return {
        category: key,
        ...config,
        total: 0,
        onTime: 0,
        delayed: 0,
        avgDays: 0,
        complianceRate: 0
      };
    }

    // Calcular pedidos no prazo vs atrasados
    let onTimeCount = 0;
    let delayedCount = 0;
    let totalDays = 0;

    categoryOrders.forEach(order => {
      const createdDate = parseISO(order.createdDate);
      const today = new Date();
      const daysOpen = differenceInDays(today, createdDate);
      totalDays += daysOpen;

      // Se o pedido tem prazo de entrega, verificar se está atrasado
      if (order.deliveryDeadline) {
        const deadline = parseISO(order.deliveryDeadline);
        if (today > deadline && order.status !== 'completed' && order.status !== 'delivered') {
          delayedCount++;
        } else {
          onTimeCount++;
        }
      } else {
        // Se não tem prazo, considerar o SLA da categoria
        if (daysOpen > config.slaDays) {
          delayedCount++;
        } else {
          onTimeCount++;
        }
      }
    });

    const avgDays = Math.round(totalDays / categoryOrders.length);
    const complianceRate = categoryOrders.length > 0 
      ? Math.round((onTimeCount / categoryOrders.length) * 100)
      : 0;

    return {
      category: key,
      ...config,
      total: categoryOrders.length,
      onTime: onTimeCount,
      delayed: delayedCount,
      avgDays,
      complianceRate
    };
  }).filter(stat => stat.total > 0); // Mostrar apenas categorias com pedidos

  const getStatusIcon = (complianceRate: number) => {
    if (complianceRate >= 85) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (complianceRate >= 70) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  };

  const getStatusColor = (complianceRate: number) => {
    if (complianceRate >= 85) return "text-green-600";
    if (complianceRate >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Performance de SLA por Categoria</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categoryStats.map(stat => (
          <Card key={stat.category} className="p-4 border-2" style={{ borderColor: stat.color }}>
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm" style={{ color: stat.color }}>
                  {stat.label}
                </h4>
                {getStatusIcon(stat.complianceRate)}
              </div>

              {/* SLA Info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>SLA: {stat.slaDays} dias úteis</span>
              </div>

              {/* Metrics */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total de Pedidos</span>
                  <Badge variant="outline">{stat.total}</Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">No Prazo</span>
                  <span className="text-sm font-medium text-green-600">{stat.onTime}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Atrasados</span>
                  <span className="text-sm font-medium text-red-600">{stat.delayed}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tempo Médio</span>
                  <span className={`text-sm font-medium ${
                    stat.avgDays <= stat.slaDays ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.avgDays}d
                  </span>
                </div>
              </div>

              {/* Compliance Rate */}
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-muted-foreground">Taxa de Cumprimento</span>
                  <span className={`text-lg font-bold ${getStatusColor(stat.complianceRate)}`}>
                    {stat.complianceRate}%
                  </span>
                </div>
                <Progress 
                  value={stat.complianceRate} 
                  className={`h-2 ${
                    stat.complianceRate >= 85 ? '[&>div]:bg-green-500' :
                    stat.complianceRate >= 70 ? '[&>div]:bg-yellow-500' :
                    '[&>div]:bg-red-500'
                  }`}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {categoryStats.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum pedido encontrado para análise de SLA
        </div>
      )}
    </Card>
  );
}