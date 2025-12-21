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
}
export const KanbanColumn = ({
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
  density = "comfortable"
}: KanbanColumnProps) => {
  const navigate = useNavigate();
  const highCount = orders.filter(o => o.priority === "high").length;
  const hasHighPriority = highCount > 0;

  const isTV = density === "tv";
  const isCompact = density === "compact";

  // Dynamic styles based on density
  const headerStyles = canDrag 
    ? `${colorClass} border-l-4 shadow-lg` 
    : `bg-muted/20 text-muted-foreground border-l-2 border-muted shadow-sm`;
  
  const iconSize = isTV ? "h-3.5 w-3.5" : isCompact ? "h-4 w-4" : "h-5 w-5";
  const iconOpacity = canDrag ? "opacity-100" : "opacity-60";
  const titleOpacity = canDrag ? "opacity-100" : "opacity-70";
  const badgeVariant = canDrag ? "default" : "secondary";
  const pulseClass = canDrag && hasHighPriority && !isTV ? "animate-pulse-slow" : "";
  const containerBg = canDrag ? "bg-muted/30" : "bg-muted/10";
  const containerBorder = canDrag ? "border-l-4 border-l-primary/20" : "";
  
  const headerHeight = isTV ? "h-7" : isCompact ? "h-9" : "h-12";
  const headerPadding = isTV ? "p-1 px-2" : isCompact ? "p-2" : "p-3";
  const cardGap = isTV ? "gap-1" : isCompact ? "gap-1.5" : "gap-2";

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
            
            {/* Title - Hidden in TV mode, truncated in compact */}
            {!isTV && (
              <h3 className={cn(
                "font-semibold truncate",
                titleOpacity,
                isCompact ? "text-xs max-w-[80px]" : "text-sm"
              )}>
                {title}
              </h3>
            )}
            
            {linkTo && !isTV && <ExternalLink className="h-3 w-3 opacity-60 flex-shrink-0" />}
            
            {/* Info icon - Hidden in TV mode */}
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
          
          {/* Badge count */}
          <Badge 
            variant={badgeVariant} 
            className={cn(
              "flex-shrink-0",
              isTV ? "text-[10px] h-4 px-1.5" : "text-xs h-5 px-2"
            )}
          >
            {orders.length}
          </Badge>
        </div>
      </div>

      {/* Cards Container */}
      <div className={cn(
        "kanban-cards-container flex-1 rounded-b-lg overflow-y-auto animate-fade-in transition-all duration-200",
        containerBg,
        containerBorder,
        isTV ? "p-1 space-y-1" : isCompact ? "p-1.5 space-y-1.5" : "p-2 space-y-2"
      )}>
        {orders.length === 0 ? (
          <div className={cn(
            "text-center text-muted-foreground",
            isTV ? "text-[10px] py-2" : "text-sm py-8"
          )}>
            {isTV ? "—" : "Nenhum pedido"}
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