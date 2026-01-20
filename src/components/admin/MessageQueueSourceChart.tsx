import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SourceStats {
  source: string;
  count: number;
}

interface MessageQueueSourceChartProps {
  messages: Array<{ metadata?: { source?: string } | null }>;
}

const sourceLabels: Record<string, string> = {
  'ai-agent-notify': 'Notif. Cliente',
  'ai-agent-auto-reply': 'Auto-IA',
  'ai-agent-auto-reply-handoff': 'Handoff',
  'daily-management-report': 'Relatório Diário',
  'send-freight-quote': 'Cotação Frete',
  'check-delivery-confirmations': 'Confirm. Entrega',
  'manager-smart-alerts': 'Alertas',
  'notify-phase-manager': 'Notif. Fase',
  'send-scheduled-reports': 'Rel. Agendado',
  'legacy': 'Legado',
};

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210, 70%, 50%)',
  'hsl(280, 70%, 50%)',
  'hsl(30, 70%, 50%)',
  'hsl(180, 70%, 50%)',
];

export function MessageQueueSourceChart({ messages }: MessageQueueSourceChartProps) {
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    
    messages.forEach(msg => {
      const source = (msg.metadata as any)?.source || 'legacy';
      counts[source] = (counts[source] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([source, count]) => ({
        source,
        name: sourceLabels[source] || source,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [messages]);

  if (sourceData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Distribuição por Origem</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="count"
                nameKey="name"
              >
                {sourceData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} msgs`, '']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Legend 
                layout="vertical" 
                align="right" 
                verticalAlign="middle"
                formatter={(value) => <span className="text-xs">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
