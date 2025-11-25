import React from "react";
import { KanbanCard } from "./KanbanCard";
import { Order } from "@/components/Dashboard";
import { LucideIcon, Info, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDroppable } from "@dnd-kit/core";
import { Phase } from "./KanbanView";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";

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
  linkTo
}: KanbanColumnProps) => {
  const navigate = useNavigate();
  const highCount = orders.filter(o => o.priority === "high").length;
  const hasHighPriority = highCount > 0;

  // Estilos condicionais baseados em canDrag
  const headerStyles = canDrag ? `${colorClass} border-l-4 shadow-lg` : `bg-muted/20 text-muted-foreground border-l-2 border-muted shadow-sm`;
  const iconSize = canDrag ? "h-5 w-5" : "h-4 w-4";
  const iconOpacity = canDrag ? "opacity-100" : "opacity-60";
  const titleOpacity = canDrag ? "opacity-100" : "opacity-70";
  const badgeVariant = canDrag ? "default" : "secondary";
  const pulseClass = canDrag && hasHighPriority ? "animate-pulse-slow" : "";
  const containerBg = canDrag ? "bg-muted/30" : "bg-muted/10";
  const containerBorder = canDrag ? "border-l-4 border-l-primary/20" : "";
  const {
    setNodeRef,
    isOver
  } = useDroppable({
    id: id
  });
  return <div ref={setNodeRef} className={`kanban-column transition-all duration-300 flex flex-col ${isOver ? "drop-target" : ""}`}>
      {/* Column Header */}
      <div className={`${headerStyles} ${pulseClass} rounded-t-lg p-3 sticky top-0 z-10 h-12 flex items-center transition-all duration-200`}>
        <div className="flex items-center justify-between w-full">
          <div 
            className={`flex items-center gap-2 ${linkTo ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={() => linkTo && navigate(linkTo)}
          >
            <Icon className={`${iconSize} ${iconOpacity} transition-all`} />
            <h3 className={`font-semibold text-sm ${titleOpacity}`}>{title}</h3>
            {linkTo && <ExternalLink className="h-3 w-3 opacity-60" />}
            
            {/* Badge "Sua fase" - destaca responsabilidade */}
            {canDrag}
            
            {/* Ícone de Informação com Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help opacity-70 hover:opacity-100 transition-opacity" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-1 text-sm">
                    {area && <p className="font-semibold text-primary">{area}</p>}
                    {responsibleRole && <p className="text-muted-foreground">
                        Responsável: <span className="font-medium text-foreground">{responsibleRole}</span>
                      </p>}
                    {/* Indicar permissão */}
                    <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                      {canDrag ? "✓ Você pode editar pedidos nesta fase" : "👁️ Você pode apenas visualizar esta fase"}
                    </p>
                    {responsibleUsers && responsibleUsers.length > 0 && <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Usuários:</p>
                        <ul className="space-y-0.5">
                          {responsibleUsers.map(user => <li key={user.email} className="text-xs">
                              • {user.full_name}
                            </li>)}
                        </ul>
                      </div>}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge variant={badgeVariant} className="text-xs h-5 px-2">
            {orders.length}
          </Badge>
        </div>
      </div>

      {/* Cards Container */}
      <div className={`kanban-cards-container flex-1 ${containerBg} ${containerBorder} rounded-b-lg p-2 overflow-y-auto space-y-2 animate-fade-in transition-all duration-200`}>
        {orders.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            Nenhum pedido nesta fase
            {linkTo && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4 gap-2"
                onClick={() => navigate(linkTo)}
              >
                <Icon className="h-4 w-4" />
                Ver Módulo de Compras
              </Button>
            )}
          </div>
        ) : (
          <>
            {orders.map(order => <KanbanCard key={order.id} order={order} onEdit={onEdit} onStatusChange={onStatusChange} canDrag={canDrag} />)}
            {linkTo && (
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
    </div>;
};