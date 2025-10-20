import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Factory, ShoppingCart, TrendingUp, Clock } from "lucide-react";
import type { Order } from "@/components/Dashboard";
import { countItemsBySource } from "@/lib/metrics";

interface ItemSourceAnalyticsProps {
  orders: Order[];
}

export function ItemSourceAnalytics({ orders }: ItemSourceAnalyticsProps) {
  // Coletar todos os itens dos pedidos
  const allItems = orders.flatMap(o => o.items || []);
  const itemsBySource = countItemsBySource(allItems);

  const total = itemsBySource.inStock + itemsBySource.production + itemsBySource.outOfStock;

  const sourceData = [
    {
      type: 'Em Estoque',
      icon: Package,
      count: itemsBySource.inStock,
      percentage: total > 0 ? Math.round((itemsBySource.inStock / total) * 100) : 0,
      avgLeadTime: 2,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      impact: 'Baixo impacto no prazo',
    },
    {
      type: 'Produção',
      icon: Factory,
      count: itemsBySource.production,
      percentage: total > 0 ? Math.round((itemsBySource.production / total) * 100) : 0,
      avgLeadTime: 7,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      impact: 'Médio impacto no prazo',
    },
    {
      type: 'Compra/Importação',
      icon: ShoppingCart,
      count: itemsBySource.outOfStock,
      percentage: total > 0 ? Math.round((itemsBySource.outOfStock / total) * 100) : 0,
      avgLeadTime: 15,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      impact: 'Alto impacto no prazo',
    },
  ];

  // Calcular correlação entre origem e atraso (simulado)
  const delayedOrders = orders.filter(o => {
    const daysRemaining = Math.ceil(
      (new Date(o.deliveryDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysRemaining < 0;
  });

  const delayedWithImported = delayedOrders.filter(o => 
    (o.items || []).some(i => i.item_source_type === 'out_of_stock')
  ).length;

  const importCorrelation = delayedOrders.length > 0
    ? Math.round((delayedWithImported / delayedOrders.length) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Análise de Origem dos Itens
        </CardTitle>
        <CardDescription>
          Distribuição de itens por origem e impacto no prazo de entrega
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Distribuição por origem */}
        <div className="space-y-4">
          {sourceData.map((source) => {
            const Icon = source.icon;
            return (
              <div key={source.type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${source.bgColor}`}>
                      <Icon className={`h-4 w-4 ${source.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{source.type}</p>
                      <p className="text-xs text-muted-foreground">{source.impact}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{source.count} itens</p>
                    <p className="text-xs text-muted-foreground">{source.percentage}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={source.bgColor}
                      style={{ width: `${source.percentage}%` }}
                    />
                  </div>
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {source.avgLeadTime}d
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Insights */}
        <div className="pt-4 border-t space-y-3">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">Correlação com Atrasos</p>
              <p className="text-xs text-muted-foreground mt-1">
                {importCorrelation}% dos pedidos atrasados contêm itens importados/comprados,
                indicando que a origem do item é um fator crítico para cumprimento de prazo.
              </p>
            </div>
          </div>

          {itemsBySource.production > itemsBySource.inStock && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Atenção:</strong> Maior volume de itens em produção ({itemsBySource.production}) 
                que em estoque ({itemsBySource.inStock}). Considere aumentar estoque de segurança.
              </p>
            </div>
          )}

          {itemsBySource.outOfStock > total * 0.3 && (
            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <p className="text-sm text-orange-900 dark:text-orange-100">
                <strong>Alerta:</strong> {Math.round((itemsBySource.outOfStock / total) * 100)}% dos itens 
                requerem compra/importação. Isso pode impactar significativamente os prazos de entrega.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
