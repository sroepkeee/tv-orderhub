import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
import type { Order } from "@/components/Dashboard";

interface DepartmentLeaderboardProps {
  orders: Order[];
}

interface DepartmentMetric {
  department: string;
  role: string;
  processedOrders: number;
  avgProcessingTime: number;
  slaCompliance: number;
  rank: number;
}

export function DepartmentLeaderboard({ orders }: DepartmentLeaderboardProps) {
  const departmentConfig = [
    { dept: 'Almox SSM', role: 'almox_ssm', statuses: ['almox_ssm_received', 'almox_ssm_in_review', 'almox_ssm_approved'] },
    { dept: 'Planejamento', role: 'planejamento', statuses: ['order_generation_pending', 'order_in_creation', 'order_generated'] },
    { dept: 'Almox Geral', role: 'almox_geral', statuses: ['almox_general_received', 'almox_general_separating', 'almox_general_ready'] },
    { dept: 'Produção', role: 'producao', statuses: ['separation_started', 'in_production', 'production_completed'] },
    { dept: 'Faturamento', role: 'faturamento', statuses: ['balance_calculation', 'balance_review', 'balance_approved', 'awaiting_invoice', 'invoice_issued', 'invoice_sent'] },
    { dept: 'Laboratório', role: 'laboratorio', statuses: ['awaiting_lab', 'in_lab_analysis', 'lab_completed'] },
    { dept: 'Logística', role: 'logistica', statuses: ['in_packaging', 'ready_for_shipping', 'released_for_shipping', 'in_expedition', 'in_transit', 'collected'] },
    { dept: 'Comercial', role: 'comercial', statuses: ['freight_quote_requested', 'freight_quote_received', 'freight_approved'] },
  ];

  const calculateDepartmentMetrics = (): DepartmentMetric[] => {
    const metrics: DepartmentMetric[] = [];

    departmentConfig.forEach(config => {
      const deptOrders = orders.filter(o => config.statuses.includes(o.status));
      const processedOrders = deptOrders.length;

      // Tempo médio de processamento (simulado)
      const avgProcessingTime = processedOrders > 0
        ? Math.round(deptOrders.reduce((sum, o) => sum + (o.daysOpen || 0), 0) / processedOrders / 5)
        : 0;

      // SLA compliance (simulado - baseado em prazo)
      const onTimeOrders = deptOrders.filter(o => {
        const daysRemaining = Math.ceil(
          (new Date(o.deliveryDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysRemaining > 0;
      });
      const slaCompliance = processedOrders > 0
        ? Math.round((onTimeOrders.length / processedOrders) * 100)
        : 0;

      metrics.push({
        department: config.dept,
        role: config.role,
        processedOrders,
        avgProcessingTime,
        slaCompliance,
        rank: 0,
      });
    });

    // Calcular ranking (menor tempo + maior SLA = melhor)
    const scored = metrics.map(m => ({
      ...m,
      score: m.slaCompliance - m.avgProcessingTime * 2,
    }));

    scored.sort((a, b) => b.score - a.score);
    scored.forEach((m, idx) => {
      m.rank = idx + 1;
    });

    return scored;
  };

  const metrics = calculateDepartmentMetrics();

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-semibold">#{rank}</span>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Ranking de Departamentos
        </CardTitle>
        <CardDescription>
          Desempenho dos departamentos nos últimos 30 dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {metrics.map((metric) => (
            <div
              key={metric.department}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10">
                  {getRankIcon(metric.rank)}
                </div>
                <div>
                  <p className="font-medium">{metric.department}</p>
                  <p className="text-xs text-muted-foreground">
                    {metric.processedOrders} pedidos processados
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <p className="text-muted-foreground">Tempo Médio</p>
                  <p className="font-semibold">{metric.avgProcessingTime}d</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">SLA</p>
                  <Badge
                    variant={metric.slaCompliance >= 80 ? "default" : "destructive"}
                    className="gap-1"
                  >
                    {metric.slaCompliance}%
                    {metric.slaCompliance >= 80 && <TrendingUp className="h-3 w-3" />}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
