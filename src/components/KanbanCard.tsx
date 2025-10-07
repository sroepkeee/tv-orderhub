import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, GripVertical } from "lucide-react";
import { Order } from "@/components/Dashboard";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface KanbanCardProps {
  order: Order;
  onEdit: (order: Order) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
}

export const KanbanCard = ({ order, onEdit, onStatusChange }: KanbanCardProps) => {
  const [isDraggingCard, setIsDraggingCard] = React.useState(false);
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
  });

  React.useEffect(() => {
    if (isDragging) {
      setIsDraggingCard(true);
    } else {
      // Reset após um pequeno delay para evitar click após drag
      const timer = setTimeout(() => setIsDraggingCard(false), 100);
      return () => clearTimeout(timer);
    }
  }, [isDragging]);

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCardClick = () => {
    if (!isDraggingCard) {
      onEdit(order);
    }
  };

  const getPriorityClass = (priority: Order["priority"]) => {
    switch (priority) {
      case "high":
        return "border-l-4 border-l-priority-high";
      case "medium":
        return "border-l-4 border-l-priority-medium";
      case "low":
        return "border-l-4 border-l-priority-low";
    }
  };

  const getPriorityLabel = (priority: Order["priority"]) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Média";
      case "low":
        return "Baixa";
    }
  };

  const getPriorityBadgeClass = (priority: Order["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-priority-high text-white";
      case "medium":
        return "bg-priority-medium text-white";
      case "low":
        return "bg-priority-low text-white";
    }
  };

  const getTypeLabel = (type: Order["type"]) => {
    switch (type) {
      case "production":
        return "Produção";
      case "sales":
        return "Vendas";
      case "materials":
        return "Materiais";
    }
  };

  const getTypeColor = (type: Order["type"]) => {
    switch (type) {
      case "production":
        return "bg-orderType-production-bg text-orderType-production";
      case "sales":
        return "bg-orderType-sales-bg text-orderType-sales";
      case "materials":
        return "bg-orderType-materials-bg text-orderType-materials";
    }
  };

  const calculateDaysRemaining = (deadline: string) => {
    const today = new Date();
    const deliveryDate = new Date(deadline);
    const diffTime = deliveryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getProgressBarColor = (daysRemaining: number) => {
    if (daysRemaining < 0) return "bg-progress-overdue";
    if (daysRemaining === 0) return "bg-progress-today";
    if (daysRemaining <= 2) return "bg-progress-critical";
    if (daysRemaining <= 5) return "bg-progress-warning";
    return "bg-progress-safe";
  };

  const daysRemaining = calculateDaysRemaining(order.deliveryDeadline);
  const progressBarColor = getProgressBarColor(daysRemaining);

  return (
      <div
        ref={setNodeRef}
        style={style}
        className={isDragging ? "dragging" : ""}
      >
        <Card
          className={`relative kanban-card p-2 cursor-pointer hover:shadow-md transition-all duration-200 ${getPriorityClass(
            order.priority
          )}`}
          onClick={handleCardClick}
        >
        {/* Drag handle */}
        <button
          className="absolute right-1 top-1 p-0.5 rounded hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing"
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastar"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-xs">#{order.orderNumber}</span>
          <Badge className={`${getTypeColor(order.type)} text-xs px-1 py-0`}>
            {getTypeLabel(order.type)}
          </Badge>
        </div>
        <Badge className={`${getPriorityBadgeClass(order.priority)} text-xs px-1 py-0`}>
          {getPriorityLabel(order.priority)}
        </Badge>
      </div>

      {/* Items Summary */}
      <div className="mb-1">
        <p className="text-xs font-medium truncate">
          {order.items && order.items.length > 0 
            ? `${order.items.length} item(ns)`
            : order.item}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {order.items && order.items.length > 0 
            ? order.items.map(item => item.itemCode).join(", ")
            : order.description}
        </p>
      </div>

      {/* Client */}
      <div className="mb-1">
        <p className="text-xs text-muted-foreground truncate">
          {order.client}
        </p>
      </div>

      {/* Deadline */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-0.5">
            <Clock className="h-2 w-2" />
            <span className="text-xs">Prazo:</span>
          </div>
          <span className="font-medium text-xs">
            {new Date(order.deliveryDeadline).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full ${progressBarColor} transition-all`} style={{ width: "100%" }} />
          </div>
          {daysRemaining < 3 && (
            <AlertCircle className="h-2 w-2 text-progress-critical" />
          )}
        </div>
        <p className="text-xs text-center">
          {daysRemaining < 0
            ? `${Math.abs(daysRemaining)}d atraso`
            : daysRemaining === 0
            ? "Hoje"
            : `${daysRemaining}d`}
        </p>
      </div>

      {/* Quantity */}
      <div className="mt-1 pt-1 border-t">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Qtd:</span> {order.quantity}
        </p>
      </div>
      </Card>
    </div>
  );
};
