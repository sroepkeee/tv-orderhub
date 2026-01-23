import React from "react";
import { KanbanCard, CardViewMode } from "./KanbanCard";
import { Order } from "@/components/Dashboard";
import { LucideIcon, Info, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDroppable } from "@dnd-kit/core";
import { Phase } from "./KanbanView";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { KanbanDensity } from "@/hooks/useKanbanDensity";

interface KanbanColumnProps {
  id: Phase;
  title: string;
  icon: LucideIcon;
  orders: Order[];
  colorClass: string;
  onEdit: (order: Order) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
  phaseKey: string;
  area?: string;
  responsibleRole?: string;
  responsibleUsers?: Array<{
    full_name: string;
    email: string;
  }>;
  canDrag?: boolean;
  linkTo?: string;
  animatedCardIds?: Set<string>;
  cardViewMode?: CardViewMode;
  density?: KanbanDensity;
  getDaysInPhase?: (orderId: string) => number | null;
  getPhaseEnteredAt?: (orderId: string) => Date | null;
  daysLoading?: boolean;
  searchQuery?: string;
}
const KanbanColumnComponent = ({
  id,
  title,
  icon: Icon,
  orders,
  colorClass,
  onEdit,
  onStatusChange,
  phaseKey,
  area,
  responsibleRole,
  responsibleUsers,
  canDrag = true,
  linkTo,
  animatedCardIds,
  cardViewMode = "full",
  density = "comfortable",
  getDaysInPhase,
  getPhaseEnteredAt,
  daysLoading = false,
  searchQuery = ""
}: KanbanColumnProps) => {
  const navigate = useNavigate();
  const highCount = orders.filter(o => o.priority === "high").length;
  const hasHighPriority = highCount > 0;

  const isTV = density === "tv";
  const isCompact = density === "compact";

  // Dynamic styles based on density - minimalist design
  const headerStyles = canDrag 
    ? `bg-background border-b border-border/50` 
    : `bg-muted/10 text-muted-foreground/70 border-b border-border/30`;
  
  const iconSize = isTV ? "h-4 w-4" : isCompact ? "h-3.5 w-3.5" : "h-4 w-4";
  const iconOpacity = canDrag ? "opacity-70" : "opacity-40";
  // TV mode gets full opacity for better visibility from distance
  const titleOpacity = isTV ? "opacity-100" : canDrag ? "opacity-90" : "opacity-60";
  const badgeVariant = canDrag ? "secondary" : "outline";
  const pulseClass = ""; // Remove pulse animation for minimal design
  const containerBg = "bg-background/50";
  const containerBorder = "";
  
  // TV mode gets compact header
  const headerHeight = isTV ? "h-6" : isCompact ? "h-7" : "h-8";
  const headerPadding = isTV ? "p-1.5 px-2" : isCompact ? "p-1.5" : "p-2";
  const cardGap = isTV ? "gap-0.5" : isCompact ? "gap-1" : "gap-1";

  const {
    setNodeRef,
    isOver
  } = useDroppable({
    id: id
  });

  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        "kanban-column transition-all duration-300 flex flex-col",
        isTV && "kanban-column-tv",
        isCompact && "kanban-column-compact",
        isOver && "drop-target ring-2 ring-primary/30 bg-primary/5 scale-[1.01]"
      )}
    >
      {/* Column Header */}
      <div className={cn(
        headerStyles, 
        pulseClass, 
        "rounded-t-lg sticky top-0 z-10 flex items-center transition-all duration-200",
        headerHeight,
        headerPadding
      )}>
        <div className="flex items-center justify-between w-full">
          <div 
            className={cn(
              "flex items-center",
              isTV ? "gap-1" : "gap-2",
              linkTo && "cursor-pointer hover:opacity-80 transition-opacity"
            )} 
            onClick={() => linkTo && navigate(linkTo)}
          >
            <Icon className={cn(iconSize, iconOpacity, "transition-all flex-shrink-0")} />
            
            {/* Title - Truncated in TV/compact modes, full in comfortable */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className={cn(
                    "font-semibold truncate cursor-default",
                    titleOpacity,
                    isTV ? "text-[9px] max-w-[60px] uppercase tracking-tight font-bold" : isCompact ? "text-xs max-w-[80px]" : "text-sm"
                  )}>
                    {isTV ? title.split(' ')[0].substring(0, 8) : title}
                  </h3>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {title}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {linkTo && !isTV && <ExternalLink className="h-3 w-3 opacity-60 flex-shrink-0" />}
            
            {/* Info icon with tooltip - Hidden in TV mode */}
            {!isTV && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 cursor-help opacity-70 hover:opacity-100 transition-opacity flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="space-y-1 text-sm">
                      {area && <p className="font-semibold text-primary">{area}</p>}
                      {responsibleRole && (
                        <p className="text-muted-foreground">
                          Responsável: <span className="font-medium text-foreground">{responsibleRole}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                        {canDrag ? "✓ Você pode editar pedidos nesta fase" : "👁️ Você pode apenas visualizar esta fase"}
                      </p>
                      {responsibleUsers && responsibleUsers.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-1">Usuários:</p>
                          <ul className="space-y-0.5">
                            {responsibleUsers.map(user => (
                              <li key={user.email} className="text-xs">• {user.full_name}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {/* Count - Badge in TV mode for better visibility */}
          {isTV ? (
            <Badge 
              variant="default" 
              className="flex-shrink-0 text-[10px] font-bold px-1 py-0 min-w-[18px] h-4 justify-center bg-primary text-primary-foreground"
            >
              {orders.length}
            </Badge>
          ) : (
            <span 
              className="flex-shrink-0 font-mono tabular-nums text-muted-foreground/70 text-[10px]"
            >
              {orders.length}
            </span>
          )}
        </div>
      </div>

      {/* Cards Container - with subtle dividers */}
      <div className={cn(
        "kanban-cards-container flex-1 overflow-y-auto transition-all duration-150",
        containerBg,
        isTV ? "p-0.5 divide-y divide-border/20" : isCompact ? "p-1 divide-y divide-border/20" : "p-1.5 divide-y divide-border/30"
      )}>
        {orders.length === 0 ? (
          <div className={cn(
            "text-center text-muted-foreground/50",
            isTV ? "text-[9px] py-2" : "text-xs py-6"
          )}>
            {isTV ? "—" : "—"}
          </div>
        ) : (
          <>
            {orders.map(order => (
              <KanbanCard 
                key={order.id} 
                order={order} 
                onEdit={onEdit} 
                onStatusChange={onStatusChange} 
                canDrag={canDrag} 
                isAnimating={animatedCardIds?.has(order.id)} 
                viewMode={cardViewMode}
                daysInPhase={getDaysInPhase?.(order.id)}
                phaseEnteredAt={getPhaseEnteredAt?.(order.id)}
                daysLoading={daysLoading}
                searchQuery={searchQuery}
              />
            ))}
            {linkTo && !isTV && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2 mt-2" 
                onClick={() => navigate(linkTo)}
              >
                <Icon className="h-4 w-4" />
                Ver Módulo de Compras
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Comparador customizado para evitar re-renders desnecessários
const areColumnsEqual = (prev: KanbanColumnProps, next: KanbanColumnProps): boolean => {
  // Comparar props primitivas
  if (
    prev.id !== next.id ||
    prev.title !== next.title ||
    prev.canDrag !== next.canDrag ||
    prev.cardViewMode !== next.cardViewMode ||
    prev.density !== next.density ||
    prev.linkTo !== next.linkTo ||
    prev.area !== next.area ||
    prev.responsibleRole !== next.responsibleRole ||
    prev.searchQuery !== next.searchQuery
  ) {
    return false;
  }
  
  // Comparar array de orders (shallow)
  if (prev.orders.length !== next.orders.length) {
    return false;
  }
  
  // Verificar se as orders mudaram (comparação por id e status)
  for (let i = 0; i < prev.orders.length; i++) {
    if (
      prev.orders[i].id !== next.orders[i].id ||
      prev.orders[i].status !== next.orders[i].status ||
      prev.orders[i].priority !== next.orders[i].priority
    ) {
      return false;
    }
  }
  
  // Comparar animatedCardIds (Set)
  if (prev.animatedCardIds?.size !== next.animatedCardIds?.size) {
    return false;
  }
  
  return true;
};

export const KanbanColumn = React.memo(KanbanColumnComponent, areColumnsEqual);
KanbanColumn.displayName = 'KanbanColumn';