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
    
    // Pedidos EMITIDOS neste dia (criados)
    const emittedOrders = orders.filter(order => {
      if (!order.issueDate) return false;
      const orderDate = new Date(order.issueDate);
      return isWithinInterval(orderDate, { start: dayStart, end: dayEnd });
    }).length;

    // Pedidos CONCLUÍDOS neste dia (mudaram para completed/delivered)
    const completedOrders = orders.filter(order => {
      if (!order.updatedAt) return false;
      const hasCompletedStatus = order.status === 'completed' || order.status === 'delivered';
      if (!hasCompletedStatus) return false;
      
      const updatedDate = new Date(order.updatedAt);
      return isWithinInterval(updatedDate, { start: dayStart, end: dayEnd });
    }).length;

    // Pedidos que INICIARAM PRODUÇÃO neste dia
    const startedProductionOrders = orders.filter(order => {
      if (!order.updatedAt) return false;
      const hasProductionStatus = order.status === 'in_production' || order.status === 'separation_started';
      if (!hasProductionStatus) return false;
      
      const updatedDate = new Date(order.updatedAt);
      return isWithinInterval(updatedDate, { start: dayStart, end: dayEnd });
    }).length;

    return {
      day: format(day, 'dd/MM', { locale: ptBR }),
      emitidos: emittedOrders,
      concluidos: completedOrders,
      iniciados: startedProductionOrders
    };
  });

  const chartConfig = {
    emitidos: {
      label: "Emitidos",
      color: "hsl(var(--primary))",
    },
    concluidos: {
      label: "Concluídos",
      color: "hsl(var(--progress-good))",
    },
    iniciados: {
      label: "Iniciados",
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
          Emitidos: pedidos criados | Concluídos: finalizados/entregues | Iniciados: entraram em produção
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
                dataKey="emitidos" 
                stroke="var(--color-emitidos)" 
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
                dataKey="iniciados" 
                stroke="var(--color-iniciados)" 
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