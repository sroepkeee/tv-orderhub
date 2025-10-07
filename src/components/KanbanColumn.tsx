import React from "react";
import { KanbanCard } from "./KanbanCard";
import { Order } from "@/components/Dashboard";
import { LucideIcon, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDroppable } from "@dnd-kit/core";
import { Phase } from "./KanbanView";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface KanbanColumnProps {
  id: Phase;
  title: string;
  icon: LucideIcon;
  orders: Order[];
  colorClass: string;
  onEdit: (order: Order) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
}

export const KanbanColumn = ({
  id,
  title,
  icon: Icon,
  orders,
  colorClass,
  onEdit,
  onStatusChange,
}: KanbanColumnProps) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const highCount = orders.filter((o) => o.priority === "high").length;
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        ref={setNodeRef}
        className={`kanban-column flex-shrink-0 transition-all duration-300 flex flex-col ${
          isOpen ? "w-56" : "w-16"
        } ${isOver ? "drop-target" : ""}`}
      >
        {/* Column Header */}
        <div className={`${colorClass} rounded-t-lg p-2 sticky top-0 z-10 shadow-sm`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 p-0 hover:bg-black/10"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <Icon className="h-3 w-3" />
              {isOpen && <h3 className="font-semibold text-xs">{title}</h3>}
            </div>
            <Badge variant="secondary" className="bg-white/90 text-foreground text-xs">
              {orders.length}
            </Badge>
          </div>
          {isOpen && highCount > 0 && (
            <div className="flex gap-1 mt-1">
              <Badge className="bg-priority-high text-white text-xs px-1 py-0">
                {highCount} alta
              </Badge>
            </div>
          )}
        </div>

        {/* Cards Container */}
        <CollapsibleContent className="flex-1 overflow-hidden">
          <div className="kanban-cards-container h-full bg-muted/30 rounded-b-lg p-2 overflow-y-auto space-y-2 animate-fade-in">
            {orders.length === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-4">
                Vazio
              </div>
            ) : (
              orders.map((order) => (
                <KanbanCard
                  key={order.id}
                  order={order}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                />
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
