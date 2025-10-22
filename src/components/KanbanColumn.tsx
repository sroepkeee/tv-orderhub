import React from "react";
import { KanbanCard } from "./KanbanCard";
import { Order } from "@/components/Dashboard";
import { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDroppable } from "@dnd-kit/core";
import { Phase } from "./KanbanView";
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
  onStatusChange
}: KanbanColumnProps) => {
  const highCount = orders.filter(o => o.priority === "high").length;
  const {
    setNodeRef,
    isOver
  } = useDroppable({
    id: id
  });
  return <div ref={setNodeRef} className={`kanban-column transition-all duration-300 flex flex-col ${isOver ? "drop-target" : ""}`}>
      {/* Column Header */}
      <div className={`${colorClass} rounded-t-lg p-2 sticky top-0 z-10 shadow-sm h-12 flex items-center`}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4" />
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <Badge variant="secondary" className="bg-card/80 text-card-foreground border-border/50 text-xs h-5 px-2">
            {orders.length}
          </Badge>
        </div>
      </div>

      {/* Cards Container */}
      <div className="kanban-cards-container flex-1 bg-muted/30 rounded-b-lg p-2 overflow-y-auto space-y-2 animate-fade-in">
        {orders.length === 0 ? <div className="text-center text-muted-foreground text-sm py-8">
            Nenhum pedido nesta fase
          </div> : orders.map(order => <KanbanCard key={order.id} order={order} onEdit={onEdit} onStatusChange={onStatusChange} />)}
      </div>
    </div>;
};