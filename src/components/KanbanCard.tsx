import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, GripVertical, Info, ShoppingCart } from "lucide-react";
import { Order } from "@/components/Dashboard";
import { OrderItem } from "@/components/AddOrderDialog";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePhaseInfo } from "@/hooks/usePhaseInfo";
import { ROLE_LABELS } from "@/lib/roleLabels";
interface KanbanCardProps {
  order: Order;
  onEdit: (order: Order) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
  canDrag?: boolean;
}
export const KanbanCard = ({
  order,
  onEdit,
  onStatusChange,
  canDrag = true
}: KanbanCardProps) => {
  const [clickStart, setClickStart] = useState<number>(0);
  const { getPhaseInfo } = usePhaseInfo();
  const phaseInfo = getPhaseInfo(order.status);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: order.id,
    disabled: !canDrag,
  });
  const style = {
    transform: CSS.Translate.toString(transform)
  };
  const handleCardClick = (e: React.MouseEvent) => {
    const clickDuration = Date.now() - clickStart;

    // Se o click durou menos de 200ms, é um click real
    if (clickDuration < 200) {
      onEdit(order);
    }
  };

  // Verifica se é vendas e-commerce (somente vendas_ecommerce deve piscar)
  const isVendasEcommerce = order.type?.toLowerCase() === 'vendas_ecommerce';
  const isEcommerce = order.type?.toLowerCase().includes('ecommerce');
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
    if (!items || items.length === 0) return {
      inStock: 0,
      production: 0,
      outOfStock: 0
    };
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
  
  // Contar itens que precisam de compra
  const purchaseItemsCount = order.items?.filter(
    i => i.item_status === 'purchase_required' || i.item_status === 'purchase_requested'
  ).length || 0;
  
  return <div ref={setNodeRef} style={style} className={isDragging ? "dragging" : ""}>
        <Card className={`relative kanban-card p-2 transition-all duration-200 ${!isEcommerce ? getPriorityClass(order.priority) : ''} ${isDragging ? 'cursor-grabbing opacity-50 scale-105 shadow-2xl' : 'cursor-pointer hover:shadow-lg hover:scale-[1.01]'} ${isVendasEcommerce ? 'animate-ecommerce-pulse border-[3px]' : ''}`} onClick={handleCardClick} onMouseDown={() => setClickStart(Date.now())}>
        {/* Selo E-commerce no canto superior direito */}
        {isEcommerce}
        {/* Drag handle */}
        <div className="absolute right-0.5 top-0.5 p-1 rounded hover:bg-primary/10 text-muted-foreground cursor-grab active:cursor-grabbing transition-colors" {...listeners} {...attributes} onMouseDown={e => {
        e.stopPropagation();
        setClickStart(Date.now() + 500);
      }} onClick={e => e.stopPropagation()} aria-label="Arrastar pedido" title="Arraste para mover entre fases">
          <GripVertical className="h-4 w-4" />
        </div>
      {/* Header */}
      <div className="flex items-start justify-between mb-1 pr-5">
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-xs flex items-center gap-1">
            {isEcommerce && <span className="text-base animate-pulse">🛒</span>}
            #{order.orderNumber}
            
            {/* Ícone de informação com tooltip */}
            {phaseInfo && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground hover:text-primary cursor-help transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-semibold text-xs">{phaseInfo.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Área:</span>{' '}
                        {ROLE_LABELS[phaseInfo.responsibleRole]?.area || 'N/A'}
                      </p>
                      {phaseInfo.responsibleUsers.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Responsáveis:</span>
                          <div className="mt-0.5 space-y-0.5">
                            {phaseInfo.responsibleUsers.map(user => (
                              <div key={user.id}>• {user.full_name}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">
            {getTypeLabel(order.type)}
          </Badge>
        </div>
        {order.priority === 'high' && (
          <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">
            Alta
          </Badge>
        )}
        {order.priority === 'medium' && (
          <Badge variant="outline" className="border-orange-400 text-orange-600 dark:text-orange-400 text-[10px] px-1.5 py-0">
            Média
          </Badge>
        )}
        {order.priority === 'low' && (
          <Badge variant="outline" className="border-green-400 text-green-600 dark:text-green-400 text-[10px] px-1.5 py-0">
            Baixa
          </Badge>
        )}
      </div>

      {/* Items Summary */}
      <div className="mb-1">
        <p className="text-xs font-medium">
          {order.items && order.items.length > 0 ? `${order.items.length} item(ns)` : order.item}
        </p>
        <p className="text-[10px] text-muted-foreground line-clamp-1">
          {order.items && order.items.length > 0 ? order.items.map(item => item.itemCode).join(", ") : order.description}
        </p>
        
        {/* Item Source Indicators - Monochromatic */}
        {order.items && order.items.length > 0 && (
          <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
            {countItemsBySource(order.items).inStock > 0 && (
              <span>✓ {countItemsBySource(order.items).inStock} estoque</span>
            )}
            {countItemsBySource(order.items).production > 0 && (
              <span>⚙ {countItemsBySource(order.items).production} produção</span>
            )}
            {countItemsBySource(order.items).outOfStock > 0 && (
              <span className="text-red-500">⚠ {countItemsBySource(order.items).outOfStock} falta</span>
            )}
            {purchaseItemsCount > 0 && (
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 gap-1 text-[10px] px-1.5 py-0 h-4">
                <ShoppingCart className="h-2.5 w-2.5" />
                {purchaseItemsCount}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Client */}
      <div className="mb-1">
        <p className="text-[10px] text-muted-foreground line-clamp-1">
          <span className="font-medium">Cliente:</span> {order.client}
        </p>
      </div>

      {/* Deadline */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            <span>Prazo:</span>
          </div>
          <span className="font-medium">
            {new Date(order.deliveryDeadline).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full ${progressBarColor} transition-all`} style={{
              width: "100%"
            }} />
          </div>
          {daysRemaining < 3 && <AlertCircle className="h-3 w-3 text-progress-critical" />}
        </div>
        <p className="text-[10px] text-center font-medium">
          {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d atraso` : daysRemaining === 0 ? "Hoje" : `${daysRemaining}d`}
        </p>
      </div>

      {/* Quantity */}
      <div className="mt-1 pt-1 border-t">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium">Qtd:</span> {order.quantity}
          {order.items && order.items.length > 0 && <span className="ml-1">
              ({order.items.reduce((sum, item) => sum + item.deliveredQuantity, 0)} ent.)
            </span>}
        </p>
      </div>
      </Card>
    </div>;
};