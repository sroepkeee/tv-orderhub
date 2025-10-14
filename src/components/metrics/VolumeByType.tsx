import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import type { Order } from "@/components/Dashboard";
import { BarChart3 } from "lucide-react";

interface VolumeByTypeProps {
  orders: Order[];
}

export function VolumeByType({ orders }: VolumeByTypeProps) {
  const typeMap: Record<string, { label: string; color: string }> = {
    production: { label: 'Produção', color: 'hsl(var(--type-production))' },
    sales: { label: 'Vendas', color: 'hsl(var(--type-sales))' },
    materials: { label: 'Materiais', color: 'hsl(var(--type-materials))' },
    ecommerce: { label: 'E-commerce', color: 'hsl(var(--type-ecommerce))' },
  };

  const typeCounts = orders.reduce((acc, order) => {
    const type = order.type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(typeCounts).map(([type, count]) => ({
    type: typeMap[type]?.label || type,
    count: count,
    fill: typeMap[type]?.color || 'hsl(var(--muted))'
  }));

  const chartConfig = chartData.reduce((acc, item) => {
    acc[item.type] = {
      label: item.type,
      color: item.fill,
    };
    return acc;
  }, {} as any);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle>Volume por Tipo de Pedido</CardTitle>
        </div>
        <CardDescription>
          Quantidade de pedidos por categoria
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="type" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}