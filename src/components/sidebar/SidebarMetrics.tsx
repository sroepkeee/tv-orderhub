import React from "react";
import { Card } from "@/components/ui/card";
import { SidebarGroup, SidebarGroupLabel, useSidebar } from "@/components/ui/sidebar";
import { Order } from "@/components/Dashboard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarMetricsProps {
  orders: Order[];
}

const SidebarMetrics = ({ orders }: SidebarMetricsProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Calcular métricas
  const metrics = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const activeOrders = orders.filter(o => !["delivered", "completed"].includes(o.status));
    const completedOrders = orders.filter(o => ["delivered", "completed"].includes(o.status));
    const ecommerceOrders = orders.filter(o => o.type === 'ecommerce' && !["delivered", "completed"].includes(o.status));

    return {
      total: activeOrders.length,
      highPriority: activeOrders.filter(o => o.priority === "high").length,
      mediumPriority: activeOrders.filter(o => o.priority === "medium").length,
      lowPriority: activeOrders.filter(o => o.priority === "low").length,
      completed: completedOrders.length,
      completionRate: orders.length > 0 ? Math.round(completedOrders.length / orders.length * 100) : 0,
      criticalDeadline: activeOrders.filter(o => {
        if (!o.deliveryDeadline) return false;
        const deadline = new Date(o.deliveryDeadline);
        const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 3 && daysUntil >= 0;
      }).length,
      newToday: activeOrders.filter(o => {
        if (!o.createdDate) return false;
        const created = new Date(o.createdDate);
        return created >= todayStart;
      }).length,
      ecommerce: ecommerceOrders.length,
      ecommerceUrgent: ecommerceOrders.filter(o => {
        if (!o.deliveryDeadline) return false;
        const deadline = new Date(o.deliveryDeadline);
        const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 2;
      }).length,
    };
  }, [orders]);

  if (isCollapsed) {
    // Versão compacta quando colapsado
    return (
      <SidebarGroup className="py-2">
        <div className="flex flex-col items-center gap-1 px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-xs font-bold">
                {metrics.total}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Pedidos Ativos: {metrics.total}</p>
            </TooltipContent>
          </Tooltip>
          
          {metrics.criticalDeadline > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold animate-pulse">
                  {metrics.criticalDeadline}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Prazo Crítico: {metrics.criticalDeadline}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="py-2">
      <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
        📊 Indicadores
      </SidebarGroupLabel>
      <div className="space-y-2 px-2">
        {/* Card de Pedidos Ativos */}
        <Card className="p-2 bg-sidebar-accent/50 border-sidebar-border">
          <div className="flex justify-between items-center text-xs">
            <span className="text-sidebar-foreground/70 font-medium">Ativos</span>
            <span className="font-bold text-sidebar-foreground">{metrics.total}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px]">🔴</span>
              <span className="text-[10px] font-medium text-[hsl(var(--priority-high))]">{metrics.highPriority}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px]">🟡</span>
              <span className="text-[10px] font-medium text-[hsl(var(--priority-medium))]">{metrics.mediumPriority}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px]">🟢</span>
              <span className="text-[10px] font-medium text-[hsl(var(--priority-low))]">{metrics.lowPriority}</span>
            </div>
          </div>
        </Card>

        {/* Card de Concluídos */}
        <Card className="p-2 bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <div className="flex justify-between items-center text-xs">
            <span className="text-green-700 dark:text-green-300 font-medium">✓ Concluídos</span>
            <span className="font-bold text-[hsl(var(--progress-good))]">{metrics.completed}</span>
          </div>
          <div className="text-[10px] text-green-600 dark:text-green-400 mt-1">
            Taxa: {metrics.completionRate}%
          </div>
        </Card>

        {/* Alertas */}
        {(metrics.criticalDeadline > 0 || metrics.newToday > 0) && (
          <Card className="p-2 bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
            {metrics.criticalDeadline > 0 && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-orange-700 dark:text-orange-300 font-medium">🔥 Prazo Crítico</span>
                <span className="font-bold text-orange-600 dark:text-orange-400 animate-pulse">{metrics.criticalDeadline}</span>
              </div>
            )}
            {metrics.newToday > 0 && (
              <div className="flex justify-between items-center text-xs mt-1">
                <span className="text-blue-700 dark:text-blue-300 font-medium">📅 Novos Hoje</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{metrics.newToday}</span>
              </div>
            )}
          </Card>
        )}

        {/* E-commerce */}
        {metrics.ecommerce > 0 && (
          <Card className="p-2 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center text-xs">
              <span className="text-blue-700 dark:text-blue-300 font-medium">🛒 E-commerce</span>
              <span className="font-bold text-blue-900 dark:text-blue-100">{metrics.ecommerce}</span>
            </div>
            {metrics.ecommerceUrgent > 0 && (
              <div className="text-[10px] text-orange-600 dark:text-orange-400 mt-1 animate-pulse">
                ⏰ {metrics.ecommerceUrgent} urgente(s)
              </div>
            )}
          </Card>
        )}
      </div>
    </SidebarGroup>
  );
};

export default SidebarMetrics;
