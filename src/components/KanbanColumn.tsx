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
  onStatusChange,
}: KanbanColumnProps) => {
  const highCount = orders.filter((o) => o.priority === "high").length;
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column flex-shrink-0 w-80 flex flex-col ${
        isOver ? "drop-target" : ""
      }`}
    >
      {/* Column Header */}
      <div className={`${colorClass} rounded-t-lg p-4 sticky top-0 z-10 shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <h3 className="font-semibold text-base">{title}</h3>
          </div>
          <Badge variant="secondary" className="bg-white/90 text-foreground">
            {orders.length}
          </Badge>
        </div>
        {highCount > 0 && (
          <div className="flex gap-2 mt-2">
            <Badge className="bg-priority-high text-white text-xs">
              {highCount} alta prioridade
            </Badge>
          </div>
        )}
      </div>

      {/* Cards Container */}
      <div className="kanban-cards-container flex-1 bg-muted/30 rounded-b-lg p-3 overflow-y-auto space-y-3">
        {orders.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            Nenhum pedido nesta fase
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
    </div>
  );
};
