import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import type { Order } from "@/components/Dashboard";
import { TrendingUp } from "lucide-react";
import { startOfDay, endOfDay, eachDayOfInterval, format, subDays, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ComparativeMetricsProps {
  orders: Order[];
}

interface OrderChange {
  order_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

// Status da fase almox_ssm
const ALMOX_SSM_STATUSES = ['almox_ssm_pending', 'almox_ssm_received', 'almox_ssm_in_review', 'almox_ssm_approved'];

// Status da fase completion
const COMPLETION_STATUSES = ['delivered', 'completed', 'cancelled', 'delayed', 'returned', 'pending', 'in_analysis', 'awaiting_approval', 'planned', 'on_hold'];

export function ComparativeMetrics({ orders }: ComparativeMetricsProps) {
  const [orderChanges, setOrderChanges] = useState<OrderChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderChanges = async () => {
      const thirtyDaysAgo = subDays(new Date(), 30);
      
      const { data, error } = await supabase
        .from('order_changes')
        .select('order_id, field_name, old_value, new_value, changed_at')
        .eq('field_name', 'status')
        .gte('changed_at', thirtyDaysAgo.toISOString())
        .order('changed_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mudanças de status:', error);
      } else {
        setOrderChanges(data || []);
      }
      setLoading(false);
    };

    fetchOrderChanges();
  }, []);

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

    // Pedidos CONCLUÍDOS neste dia (mudaram para status de completion)
    const completedOrders = orderChanges.filter(change => {
      if (!change.new_value || !COMPLETION_STATUSES.includes(change.new_value)) return false;
      const changeDate = new Date(change.changed_at);
      return isWithinInterval(changeDate, { start: dayStart, end: dayEnd });
    }).length;

    // Pedidos que INICIARAM (saíram da fase almox_ssm)
    const startedOrders = orderChanges.filter(change => {
      if (!change.old_value || !change.new_value) return false;
      // Saiu de almox_ssm para qualquer outro status
      const leftAlmoxSsm = ALMOX_SSM_STATUSES.includes(change.old_value) && 
                          !ALMOX_SSM_STATUSES.includes(change.new_value);
      if (!leftAlmoxSsm) return false;
      
      const changeDate = new Date(change.changed_at);
      return isWithinInterval(changeDate, { start: dayStart, end: dayEnd });
    }).length;

    return {
      day: format(day, 'dd/MM', { locale: ptBR }),
      emitidos: emittedOrders,
      concluidos: completedOrders,
      iniciados: startedOrders
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Evolução Diária de Pedidos</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground">
            Carregando dados...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Evolução Diária de Pedidos</CardTitle>
        </div>
        <CardDescription>
          Emitidos: data de emissão | Concluídos: movidos para fase de conclusão | Iniciados: saíram da fase Almox SSM
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
