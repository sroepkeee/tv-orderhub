import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import type { Order } from "@/components/Dashboard";
import { TrendingUp } from "lucide-react";
import { startOfWeek, endOfWeek, eachWeekOfInterval, format, subWeeks, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ComparativeMetricsProps {
  orders: Order[];
}

export function ComparativeMetrics({ orders }: ComparativeMetricsProps) {
  const now = new Date();
  const weeksAgo8 = subWeeks(now, 8);
  
  // Gerar todas as semanas dos últimos 8 semanas
  const weeks = eachWeekOfInterval({
    start: weeksAgo8,
    end: now
  });

  const chartData = weeks.map(weekStart => {
    const weekEnd = endOfWeek(weekStart);
    
    const ordersInWeek = orders.filter(order => {
      const orderDate = new Date(order.createdDate);
      return isWithinInterval(orderDate, { start: weekStart, end: weekEnd });
    });

    const completedOrders = ordersInWeek.filter(o => 
      o.status === 'completed' || o.status === 'delivered'
    ).length;

    const inProductionOrders = ordersInWeek.filter(o => 
      o.status === 'in_production' || o.status === 'separation_started'
    ).length;

    return {
      week: format(weekStart, 'dd/MMM', { locale: ptBR }),
      total: ordersInWeek.length,
      concluidos: completedOrders,
      producao: inProductionOrders
    };
  });

  const chartConfig = {
    total: {
      label: "Total",
      color: "hsl(var(--primary))",
    },
    concluidos: {
      label: "Concluídos",
      color: "hsl(var(--progress-good))",
    },
    producao: {
      label: "Em Produção",
      color: "hsl(var(--status-production))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Evolução Semanal de Pedidos</CardTitle>
        </div>
        <CardDescription>
          Comparativo das últimas 8 semanas - Total, Concluídos e Em Produção
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="week" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="var(--color-total)" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="concluidos" 
                stroke="var(--color-concluidos)" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="producao" 
                stroke="var(--color-producao)" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}