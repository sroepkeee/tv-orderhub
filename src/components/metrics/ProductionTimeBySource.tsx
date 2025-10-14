import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Factory } from "lucide-react";
import type { Order } from "@/components/Dashboard";
import { differenceInDays, parseISO } from "date-fns";

interface ProductionTimeBySourceProps {
  orders: Order[];
}

export const ProductionTimeBySource = ({ orders }: ProductionTimeBySourceProps) => {
  const productionItems = orders.flatMap(o => o.items || [])
    .filter(i => i.item_source_type === 'production');
  
  // Calcular tempo médio de produção
  let avgTime = 0;
  if (productionItems.length > 0) {
    const totalDays = productionItems.reduce((sum, item) => {
      const start = new Date(item.deliveryDate);
      const end = item.production_estimated_date 
        ? new Date(item.production_estimated_date)
        : new Date();
      return sum + Math.abs(differenceInDays(end, start));
    }, 0);
    avgTime = Math.round(totalDays / productionItems.length);
  }
  
  // Calcular taxa de cumprimento (itens entregues no prazo de 10 dias)
  const completedItems = productionItems.filter(i => i.deliveredQuantity >= i.requestedQuantity);
  const onTimeItems = completedItems.filter(item => {
    if (!item.production_estimated_date) return false;
    const days = Math.abs(differenceInDays(
      new Date(item.production_estimated_date),
      new Date(item.deliveryDate)
    ));
    return days <= 10;
  });
  const onTimeRate = completedItems.length > 0 
    ? Math.round((onTimeItems.length / completedItems.length) * 100)
    : 100;
  
  const getTimeColor = (days: number) => {
    if (days <= 10) return 'text-green-600';
    if (days <= 12) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-5 w-5" />
          🏭 Performance de Produção
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm">Tempo Médio de Produção</span>
              <span className={`text-sm font-bold ${getTimeColor(avgTime)}`}>
                {avgTime} dias
              </span>
            </div>
            <Progress value={avgTime > 0 ? Math.min((10 / avgTime) * 100, 100) : 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">Meta: 10 dias</p>
          </div>
          
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm">Taxa de Cumprimento (10 dias)</span>
              <span className="text-sm font-bold">{onTimeRate}%</span>
            </div>
            <Progress value={onTimeRate} className="h-2" />
          </div>
          
          <div className="pt-2 border-t text-xs text-muted-foreground">
            {productionItems.length} itens em processo de produção
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
