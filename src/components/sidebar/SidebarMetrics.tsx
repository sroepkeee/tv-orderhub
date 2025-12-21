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
              <p>{metrics.total} Ativos | {metrics.completed} Concluídos | {metrics.criticalDeadline} Críticos</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="py-2 px-2">
      <div className="bg-sidebar-accent/30 rounded-md p-2.5 border border-sidebar-border/50 space-y-2">
        {/* Título */}
        <div className="text-[10px] font-semibold text-sidebar-foreground/70 uppercase tracking-wide">
          Pedidos
        </div>
        
        {/* Métricas principais - 3 colunas */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="flex flex-col">
            <span className="text-base font-bold text-sidebar-foreground">{metrics.total}</span>
            <span className="text-[9px] text-sidebar-foreground/60">Ativos</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-[hsl(var(--progress-good))]">{metrics.completed}</span>
            <span className="text-[9px] text-sidebar-foreground/60">Concluídos</span>
          </div>
          <div className="flex flex-col">
            <span className={`text-base font-bold ${metrics.criticalDeadline > 0 ? 'text-orange-500' : 'text-sidebar-foreground/40'}`}>
              {metrics.criticalDeadline > 0 && '🔥'}{metrics.criticalDeadline}
            </span>
            <span className="text-[9px] text-sidebar-foreground/60">Críticos</span>
          </div>
        </div>
        
        {/* Prioridades com legenda */}
        <div className="pt-1.5 border-t border-sidebar-border/30">
          <div className="text-[10px] text-sidebar-foreground/50 mb-1">Prioridade:</div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-[hsl(var(--priority-high))]">🔴 {metrics.highPriority} Alta</span>
            <span className="text-[hsl(var(--priority-medium))]">🟡 {metrics.mediumPriority} Média</span>
            <span className="text-[hsl(var(--priority-low))]">🟢 {metrics.lowPriority} Baixa</span>
          </div>
        </div>
      </div>
    </SidebarGroup>
  );
};

export default SidebarMetrics;
