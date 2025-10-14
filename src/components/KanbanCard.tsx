import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, GripVertical } from "lucide-react";
import { Order } from "@/components/Dashboard";
import { OrderItem } from "@/components/AddOrderDialog";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface KanbanCardProps {
  order: Order;
  onEdit: (order: Order) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
}

export const KanbanCard = ({ order, onEdit, onStatusChange }: KanbanCardProps) => {
  const [clickStart, setClickStart] = useState<number>(0);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const clickDuration = Date.now() - clickStart;
    
    // Se o click durou menos de 200ms, é um click real
    if (clickDuration < 200) {
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
      case "ecommerce":
        return "E-commerce";
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
      case "ecommerce":
        return "bg-orderType-ecommerce-bg text-orderType-ecommerce";
    }
  };

  const countItemsBySource = (items?: OrderItem[]) => {
    if (!items || items.length === 0) return { inStock: 0, production: 0, outOfStock: 0 };
    
    return {
      inStock: items.filter(i => i.item_source_type === 'in_stock' || !i.item_source_type).length,
      production: items.filter(i => i.item_source_type === 'production').length,
      outOfStock: items.filter(i => i.item_source_type === 'out_of_stock').length
    };
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
          className={`relative kanban-card p-3 transition-all duration-200 ${getPriorityClass(
            order.priority
          )} ${
            isDragging 
              ? 'cursor-grabbing opacity-50 scale-105 shadow-2xl' 
              : 'cursor-pointer hover:shadow-lg hover:scale-[1.02]'
          }`}
          onClick={handleCardClick}
          onMouseDown={() => setClickStart(Date.now())}
        >
        {/* Drag handle - maior e mais visível */}
        <div
          className="absolute right-1 top-1 p-2 rounded-md hover:bg-primary/10 text-muted-foreground cursor-grab active:cursor-grabbing transition-colors"
          {...listeners}
          {...attributes}
          onMouseDown={(e) => {
            e.stopPropagation();
            setClickStart(Date.now() + 500); // Evita click ao arrastar pelo handle
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastar pedido"
          title="Arraste para mover entre fases"
        >
          <GripVertical className="h-5 w-5" />
        </div>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col gap-1">
          <span className="font-bold text-sm">Pedido #{order.orderNumber}</span>
          <Badge className={`${getTypeColor(order.type)} text-xs`}>
            {getTypeLabel(order.type)}
          </Badge>
        </div>
        <Badge className={`${getPriorityBadgeClass(order.priority)} text-xs`}>
          {getPriorityLabel(order.priority)}
        </Badge>
      </div>

      {/* Items Summary */}
      <div className="mb-2">
        <p className="text-sm font-medium">
          {order.items && order.items.length > 0 
            ? `${order.items.length} item(ns)`
            : order.item}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {order.items && order.items.length > 0 
            ? order.items.map(item => item.itemCode).join(", ")
            : order.description}
        </p>
        
        {/* Item Source Badges */}
        {order.items && order.items.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {countItemsBySource(order.items).inStock > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                ✅ {countItemsBySource(order.items).inStock}
              </span>
            )}
            {countItemsBySource(order.items).production > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                🏭 {countItemsBySource(order.items).production}
              </span>
            )}
            {countItemsBySource(order.items).outOfStock > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                ⚠️ {countItemsBySource(order.items).outOfStock}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Client */}
      <div className="mb-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Cliente:</span> {order.client}
        </p>
      </div>

      {/* Deadline */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Prazo:</span>
          </div>
          <span className="font-medium">
            {new Date(order.deliveryDeadline).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full ${progressBarColor} transition-all`} style={{ width: "100%" }} />
          </div>
          {daysRemaining < 3 && (
            <AlertCircle className="h-3 w-3 text-progress-critical" />
          )}
        </div>
        <p className="text-xs text-center">
          {daysRemaining < 0
            ? `${Math.abs(daysRemaining)} dias atrasado`
            : daysRemaining === 0
            ? "Entrega hoje"
            : `${daysRemaining} dias restantes`}
        </p>
      </div>

      {/* Quantity */}
      <div className="mt-2 pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Qtd Total:</span> {order.quantity}
          {order.items && order.items.length > 0 && (
            <span className="ml-2">
              ({order.items.reduce((sum, item) => sum + item.deliveredQuantity, 0)} entregue)
            </span>
          )}
        </p>
      </div>
      </Card>
    </div>
  );
};
