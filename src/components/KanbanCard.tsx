import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, GripVertical, Info, ShoppingCart, Wrench, Building2, Ruler, MapPin } from "lucide-react";
import { Order } from "@/components/Dashboard";
import { OrderItem } from "@/components/AddOrderDialog";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePhaseInfo } from "@/hooks/usePhaseInfo";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { cn } from "@/lib/utils";
import { getSenderById } from "@/lib/senderOptions";
import { useVisualMode } from "@/hooks/useVisualMode";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
// Configuração de áreas de negócio
const BUSINESS_AREA_CONFIG: Record<string, { label: string; icon: typeof Wrench; className: string }> = {
  ssm: { 
    label: 'SSM', 
    icon: Wrench, 
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800' 
  },
  ecommerce: { 
    label: 'E-commerce', 
    icon: ShoppingCart, 
    className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800' 
  },
  projetos: { 
    label: 'Projetos', 
    icon: Ruler, 
    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800' 
  },
  filial: { 
    label: 'Filial', 
    icon: Building2, 
    className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800' 
  }
};
export type CardViewMode = "full" | "compact" | "micro";

interface KanbanCardProps {
  order: Order;
  onEdit: (order: Order) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
  canDrag?: boolean;
  isAnimating?: boolean;
  viewMode?: CardViewMode;
}
export const KanbanCard = ({
  order,
  onEdit,
  onStatusChange,
  canDrag = true,
  isAnimating = false,
  viewMode = "full"
}: KanbanCardProps) => {
  const [clickStart, setClickStart] = useState<number>(0);
  const { getPhaseInfo } = usePhaseInfo();
  const { isMinimal } = useVisualMode();
  const { maskText } = usePrivacyMode();
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
    // Filtrar itens NÃO concluídos para mostrar indicadores de pendência
    const activeItems = items.filter(i => 
      !['completed', 'delivered', 'received'].includes(i.item_status || '')
    );
    return {
      inStock: activeItems.filter(i => i.item_source_type === 'in_stock' || !i.item_source_type).length,
      production: activeItems.filter(i => i.item_source_type === 'production').length,
      outOfStock: activeItems.filter(i => i.item_source_type === 'out_of_stock').length
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
  
  // Micro view rendering (TV/Dashboard mode)
  if (viewMode === "micro") {
    const getPriorityColor = () => {
      if (isMinimal) return "bg-muted-foreground";
      switch (order.priority) {
        case "high": return "bg-priority-high";
        case "medium": return "bg-priority-medium";
        case "low": return "bg-priority-low";
        default: return "bg-muted-foreground";
      }
    };

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div ref={setNodeRef} style={style} className={isDragging ? "dragging" : ""}>
              <Card 
                className={cn(
                  "kanban-card kanban-card-micro p-1 flex items-center gap-1.5 cursor-pointer transition-all h-7",
                  isDragging ? 'opacity-50' : 'hover:bg-accent',
                  isAnimating && 'animate-card-pop-in'
                )}
                onClick={handleCardClick}
                onMouseDown={() => setClickStart(Date.now())}
              >
                {/* Priority indicator */}
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", getPriorityColor())} />
                
                {/* Order number */}
                <span className="font-bold text-[10px] flex-shrink-0">
                  #{order.orderNumber.slice(-4)}
                </span>
                
                {/* Days indicator */}
                <span className={cn(
                  "text-[9px] font-medium ml-auto flex-shrink-0",
                  daysRemaining < 0 ? "text-destructive" : 
                  daysRemaining <= 2 ? "text-priority-medium" : 
                  "text-muted-foreground"
                )}>
                  {daysRemaining < 0 ? `${Math.abs(daysRemaining)}↓` : daysRemaining === 0 ? "•" : `${daysRemaining}d`}
                </span>
              </Card>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <p className="font-bold">#{order.orderNumber}</p>
              <p><span className="text-muted-foreground">Cliente:</span> {maskText(order.client, 'name')}</p>
              <p><span className="text-muted-foreground">Prazo:</span> {new Date(order.deliveryDeadline).toLocaleDateString("pt-BR")}</p>
              <p><span className="text-muted-foreground">Itens:</span> {order.items?.length || 0}</p>
              <p><span className="text-muted-foreground">Prioridade:</span> {getPriorityLabel(order.priority)}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Compact view rendering
  if (viewMode === "compact") {
    const sourceCounts = countItemsBySource(order.items);
    const sender = (order as any).sender_company ? getSenderById((order as any).sender_company) : null;
    
    return (
      <div ref={setNodeRef} style={style} className={isDragging ? "dragging" : ""}>
        <Card 
          className={cn(
            "relative kanban-card kanban-card-compact p-1.5 transition-all duration-200",
            !isEcommerce && !isMinimal && getPriorityClass(order.priority),
            isMinimal && "border-l border-l-border",
            isDragging ? 'cursor-grabbing opacity-50 scale-105 shadow-2xl' : 'cursor-pointer hover:shadow-md hover:scale-[1.01]',
            isVendasEcommerce && !isMinimal && 'animate-ecommerce-pulse border-[2px]',
            isAnimating && 'animate-card-pop-in'
          )}
          onClick={handleCardClick}
          onMouseDown={() => setClickStart(Date.now())}
        >
          {/* Drag handle - compact */}
          <div 
            className="absolute right-0 top-0 p-0.5 rounded hover:bg-primary/10 text-muted-foreground cursor-grab active:cursor-grabbing transition-colors"
            {...listeners}
            {...attributes}
            onMouseDown={e => { e.stopPropagation(); setClickStart(Date.now() + 500); }}
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3" />
          </div>
          
          {/* Line 1: Order number, badges, indicators */}
          <div className="flex items-center gap-1 flex-wrap pr-4">
            {isEcommerce && !isMinimal && <span className="text-xs">🛒</span>}
            <span className="font-bold text-[10px]">#{order.orderNumber}</span>
            
            {/* WhatsApp indicator */}
            {(order as any).customer_whatsapp && (
              <span className="text-[9px]" title="Cliente com WhatsApp cadastrado">📱</span>
            )}
            
            {order.business_area && BUSINESS_AREA_CONFIG[order.business_area] && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[8px] px-0.5 py-0 h-3",
                  isMinimal ? "minimal-badge" : BUSINESS_AREA_CONFIG[order.business_area].className
                )}
              >
                {BUSINESS_AREA_CONFIG[order.business_area].label}
              </Badge>
            )}
            
            {sender && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[8px] px-0.5 py-0 h-3",
                  isMinimal ? "minimal-badge" : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                )}
              >
                {sender.state}
              </Badge>
            )}
            
            {/* Source indicators compact - text only in minimal */}
            {sourceCounts.inStock > 0 && (
              <span className="text-[9px] text-muted-foreground">
                {isMinimal ? `${sourceCounts.inStock}ok` : `✓${sourceCounts.inStock}`}
              </span>
            )}
            {sourceCounts.outOfStock > 0 && (
              <span className={cn("text-[9px]", isMinimal ? "text-muted-foreground font-medium" : "text-red-500")}>
                {isMinimal ? `${sourceCounts.outOfStock}p` : `⚠${sourceCounts.outOfStock}`}
              </span>
            )}
            {purchaseItemsCount > 0 && (
              <span className={cn("text-[9px]", isMinimal ? "text-muted-foreground" : "text-amber-600")}>
                {isMinimal ? `${purchaseItemsCount}c` : `🛒${purchaseItemsCount}`}
              </span>
            )}
            
            {/* Deadline compact */}
            <span className={cn(
              "text-[9px] font-medium ml-auto",
              isMinimal 
                ? "text-muted-foreground"
                : daysRemaining < 0 ? "text-red-500" : daysRemaining <= 2 ? "text-orange-500" : "text-muted-foreground"
            )}>
              {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d↓` : daysRemaining === 0 ? "Hoje" : `${daysRemaining}d`}
            </span>
          </div>
          
          {/* Line 2: Client truncated */}
          <p className="text-[9px] text-muted-foreground line-clamp-1 mt-0.5">
            {maskText(order.client, 'name')} • {order.items?.length || 0} itens
          </p>
        </Card>
      </div>
    );
  }
  
  // Full view rendering - SIMPLIFIED (3 lines only)
  const sourceCounts = countItemsBySource(order.items);
  const sender = (order as any).sender_company ? getSenderById((order as any).sender_company) : null;
  
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "dragging" : ""}>
      <Card 
        className={cn(
          "relative kanban-card p-1.5 transition-all duration-200",
          !isEcommerce && !isMinimal && getPriorityClass(order.priority),
          isMinimal && "border-l border-l-border",
          isDragging ? 'cursor-grabbing opacity-50 scale-105 shadow-2xl' : 'cursor-pointer hover:shadow-md hover:scale-[1.01]',
          isVendasEcommerce && !isMinimal && 'animate-ecommerce-pulse border-[2px]',
          isAnimating && 'animate-card-pop-in'
        )} 
        onClick={handleCardClick} 
        onMouseDown={() => setClickStart(Date.now())}
      >
        {/* Drag handle */}
        <div 
          className="absolute right-0 top-0 p-0.5 rounded hover:bg-primary/10 text-muted-foreground cursor-grab active:cursor-grabbing transition-colors" 
          {...listeners} 
          {...attributes} 
          onMouseDown={e => { e.stopPropagation(); setClickStart(Date.now() + 500); }} 
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </div>

        {/* Line 1: Order number + Area badge + Priority */}
        <div className="flex items-center gap-1 pr-4 flex-wrap">
          {isEcommerce && !isMinimal && <span className="text-xs">🛒</span>}
          <span className="font-bold text-[11px]">#{order.orderNumber}</span>
          
          {(order as any).customer_whatsapp && (
            <span className="text-[9px]" title="WhatsApp">📱</span>
          )}
          
          {order.business_area && BUSINESS_AREA_CONFIG[order.business_area] && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-[8px] px-0.5 py-0 h-3.5",
                isMinimal ? "minimal-badge" : BUSINESS_AREA_CONFIG[order.business_area].className
              )}
            >
              {BUSINESS_AREA_CONFIG[order.business_area].label}
            </Badge>
          )}
          
          {sender && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-[8px] px-0.5 py-0 h-3.5",
                isMinimal ? "minimal-badge" : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
              )}
            >
              {sender.state}
            </Badge>
          )}
          
          {/* Priority badge - only high/medium */}
          {order.priority === 'high' && (
            <Badge className={cn(
              "text-[8px] px-1 py-0 h-3.5 ml-auto",
              isMinimal ? "minimal-badge" : "bg-red-500 text-white"
            )}>
              Alta
            </Badge>
          )}
          {order.priority === 'medium' && (
            <Badge variant="outline" className={cn(
              "text-[8px] px-1 py-0 h-3.5 ml-auto",
              isMinimal ? "minimal-badge" : "border-orange-400 text-orange-600 dark:text-orange-400"
            )}>
              Média
            </Badge>
          )}
        </div>

        {/* Line 2: Client + Items count + Source indicators */}
        <div className="flex items-center gap-1 mt-0.5 text-[10px]">
          <span className="text-muted-foreground truncate flex-1" title={maskText(order.client, 'name')}>
            {maskText(order.client, 'name')}
          </span>
          <span className="text-muted-foreground flex-shrink-0">
            • {order.items?.length || 1} {(order.items?.length || 1) === 1 ? 'item' : 'itens'}
          </span>
          
          {/* Source indicators inline */}
          {sourceCounts.outOfStock > 0 && (
            <span className={cn("text-[9px] flex-shrink-0", isMinimal ? "font-medium" : "text-red-500")}>
              ⚠{sourceCounts.outOfStock}
            </span>
          )}
          {purchaseItemsCount > 0 && (
            <span className={cn("text-[9px] flex-shrink-0", isMinimal ? "" : "text-amber-600")}>
              🛒{purchaseItemsCount}
            </span>
          )}
        </div>

        {/* Line 3: Deadline + Days remaining */}
        <div className="flex items-center justify-between mt-0.5 text-[10px]">
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            <span>{new Date(order.deliveryDeadline).toLocaleDateString("pt-BR")}</span>
          </div>
          <span className={cn(
            "font-semibold",
            isMinimal 
              ? "text-muted-foreground"
              : daysRemaining < 0 ? "text-red-500" 
              : daysRemaining <= 2 ? "text-orange-500" 
              : "text-muted-foreground"
          )}>
            {daysRemaining < 0 
              ? `${Math.abs(daysRemaining)}d atraso` 
              : daysRemaining === 0 
              ? "Hoje" 
              : `${daysRemaining}d`}
            {daysRemaining < 3 && !isMinimal && <AlertCircle className="inline h-2.5 w-2.5 ml-0.5" />}
          </span>
        </div>
      </Card>
    </div>
  );
};