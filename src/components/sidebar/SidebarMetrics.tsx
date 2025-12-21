import React from "react";
import { SidebarGroup, useSidebar } from "@/components/ui/sidebar";
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

    const activeOrders = orders.filter(o => !["delivered", "completed"].includes(o.status));
    const completedOrders = orders.filter(o => ["delivered", "completed"].includes(o.status));

    return {
      total: activeOrders.length,
      highPriority: activeOrders.filter(o => o.priority === "high").length,
      mediumPriority: activeOrders.filter(o => o.priority === "medium").length,
      lowPriority: activeOrders.filter(o => o.priority === "low").length,
      completed: completedOrders.length,
      criticalDeadline: activeOrders.filter(o => {
        if (!o.deliveryDeadline) return false;
        const deadline = new Date(o.deliveryDeadline);
        const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 3 && daysUntil >= 0;
      }).length,
    };
  }, [orders]);

  if (isCollapsed) {
    return (
      <SidebarGroup className="py-1">
        <div className="flex flex-col items-center gap-0.5 px-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center w-7 h-7 rounded bg-muted text-[10px] font-bold">
                {metrics.total}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{metrics.total} ativos | {metrics.completed} ✓ | {metrics.criticalDeadline}🔥</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarGroup>
    );
  }

  // Ultra-compact: uma única linha com todas as métricas
  return (
    <SidebarGroup className="py-1 px-2">
      <div className="bg-sidebar-accent/30 rounded-md px-2 py-1.5 border border-sidebar-border/50">
        {/* Linha principal */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-sidebar-foreground">{metrics.total}</span>
          <span className="text-sidebar-foreground/60">|</span>
          <span className="text-[hsl(var(--progress-good))] font-medium">✓{metrics.completed}</span>
          <span className="text-sidebar-foreground/60">|</span>
          {metrics.criticalDeadline > 0 ? (
            <span className="text-orange-500 font-medium animate-pulse">🔥{metrics.criticalDeadline}</span>
          ) : (
            <span className="text-sidebar-foreground/40">🔥0</span>
          )}
        </div>
        {/* Sub-linha de prioridades */}
        <div className="flex items-center gap-2 mt-0.5 text-[10px]">
          <span className="text-[hsl(var(--priority-high))]">🔴{metrics.highPriority}</span>
          <span className="text-[hsl(var(--priority-medium))]">🟡{metrics.mediumPriority}</span>
          <span className="text-[hsl(var(--priority-low))]">🟢{metrics.lowPriority}</span>
        </div>
      </div>
    </SidebarGroup>
  );
};

export default SidebarMetrics;
