import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import type { Order } from "@/components/Dashboard";
import { PieChart as PieChartIcon } from "lucide-react";

interface StatusDistributionProps {
  orders: Order[];
}

export function StatusDistribution({ orders }: StatusDistributionProps) {
  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendente', color: 'hsl(var(--status-pending))' },
    in_analysis: { label: 'Em Análise', color: 'hsl(var(--status-analysis))' },
    awaiting_materials: { label: 'Aguardando Material', color: 'hsl(var(--status-material))' },
    in_separation: { label: 'Em Separação', color: 'hsl(var(--status-separation))' },
    in_production: { label: 'Em Produção', color: 'hsl(var(--status-production))' },
    separation_complete: { label: 'Separação Concluída', color: 'hsl(var(--status-sep-complete))' },
    in_packaging: { label: 'Em Embalagem', color: 'hsl(var(--status-packaging))' },
    ready_to_ship: { label: 'Pronto para Expedição', color: 'hsl(var(--status-ready))' },
    in_expedition: { label: 'Em Expedição', color: 'hsl(var(--status-expedition))' },
    in_transit: { label: 'Em Trânsito', color: 'hsl(var(--status-transit))' },
    delivered: { label: 'Entregue', color: 'hsl(var(--status-delivered))' },
    completed: { label: 'Concluído', color: 'hsl(var(--status-completed))' },
    cancelled: { label: 'Cancelado', color: 'hsl(var(--status-cancelled))' },
  };

  const statusCounts = orders.reduce((acc, order) => {
    const status = order.status;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(statusCounts).map(([status, count]) => ({
    name: statusMap[status]?.label || status,
    value: count,
    color: statusMap[status]?.color || 'hsl(var(--muted))'
  }));

  const chartConfig = chartData.reduce((acc, item) => {
    acc[item.name] = {
      label: item.name,
      color: item.color,
    };
    return acc;
  }, {} as any);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-primary" />
          <CardTitle>Distribuição por Status</CardTitle>
        </div>
        <CardDescription>
          Visualização da distribuição de pedidos por status atual
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}