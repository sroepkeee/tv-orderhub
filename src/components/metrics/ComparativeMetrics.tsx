import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import type { Order } from "@/components/Dashboard";
import { TrendingUp } from "lucide-react";
import { startOfDay, endOfDay, eachDayOfInterval, format, subDays, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ComparativeMetricsProps {
  orders: Order[];
}

export function ComparativeMetrics({ orders }: ComparativeMetricsProps) {
  const now = new Date();
  const daysAgo30 = subDays(now, 30);
  
  // Gerar todos os dias dos últimos 30 dias
  const days = eachDayOfInterval({
    start: daysAgo30,
    end: now
  });

  const chartData = days.map(day => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    
    const ordersInDay = orders.filter(order => {
      const orderDate = new Date(order.createdDate);
      return isWithinInterval(orderDate, { start: dayStart, end: dayEnd });
    });

    const completedOrders = ordersInDay.filter(o => 
      o.status === 'completed' || o.status === 'delivered'
    ).length;

    const inProductionOrders = ordersInDay.filter(o => 
      o.status === 'in_production' || o.status === 'separation_started'
    ).length;

    return {
      day: format(day, 'dd/MM', { locale: ptBR }),
      total: ordersInDay.length,
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
          <CardTitle>Evolução Diária de Pedidos</CardTitle>
        </div>
        <CardDescription>
          Comparativo dos últimos 30 dias - Total, Concluídos e Em Produção
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="day"
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