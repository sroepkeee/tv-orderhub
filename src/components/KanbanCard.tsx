import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, GripVertical, Info, ShoppingCart, Wrench, Building2, Ruler, MapPin, Calendar } from "lucide-react";
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
  daysInPhase?: number | null;
  phaseEnteredAt?: Date | null;
  daysLoading?: boolean;
  searchQuery?: string;
}
const KanbanCardComponent = ({
  order,
  onEdit,
  onStatusChange,
  canDrag = true,
  isAnimating = false,
  viewMode = "full",
  daysInPhase,
  phaseEnteredAt,
  daysLoading = false,
  searchQuery = ""
}: KanbanCardProps) => {
  const [clickStart, setClickStart] = useState<number>(0);
  const { getPhaseInfo } = usePhaseInfo();
  const { isMinimal } = useVisualMode();
  const { maskText } = usePrivacyMode();
  const phaseInfo = getPhaseInfo(order.status);
  
  // Função para encontrar itens correspondentes à busca
  const getMatchingItems = (items: OrderItem[] | undefined, query: string): OrderItem[] => {
    if (!query.trim() || !items) return [];
    const term = query.toLowerCase().trim();
    return items.filter(item => 
      item.itemCode?.toLowerCase().includes(term) ||
      item.itemDescription?.toLowerCase().includes(term)
    );
  };
  
  const matchingItems = getMatchingItems(order.items, searchQuery);
  const hasSearchMatch = matchingItems.length > 0 && searchQuery?.trim();
  
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
  // Minimal priority border - 1px fine line
  const getPriorityClass = (priority: Order["priority"]) => {
    switch (priority) {
      case "high":
        return "border-l border-l-priority-high/70";
      case "medium":
        return "border-l border-l-priority-medium/70";
      case "low":
        return "border-l border-l-priority-low/70";
    }
  };
  
  // Priority dot for minimal indicator
  const getPriorityDotClass = (priority: Order["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-priority-high";
      case "medium":
        return "bg-priority-medium";
      case "low":
        return "bg-priority-low";
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
  
  // Usar dias na fase se disponível
  // Se está carregando e não tem valor, mostrar "..." para evitar "0d" falso
  const displayDaysInPhase = daysInPhase ?? (daysLoading ? null : 0);
  const daysDisplay = displayDaysInPhase === null ? '...' : `${displayDaysInPhase}d`;
  
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
                  isAnimating && 'animate-card-pop-in',
                  isVendasEcommerce && !isMinimal && 'animate-ecommerce-pulse border border-purple-500/40'
                )}
                onClick={handleCardClick}
                onMouseDown={() => setClickStart(Date.now())}
              >
                {/* Priority indicator */}
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", getPriorityColor())} />
                
                {/* E-commerce indicator */}
                {isVendasEcommerce && (
                  <ShoppingCart className="w-2.5 h-2.5 text-purple-500 flex-shrink-0" />
                )}
                
                {/* Order number - 6 digits */}
                <span className="font-bold text-[10px] flex-shrink-0">
                  #{order.orderNumber.slice(-6)}
                </span>
                
                {/* Days in phase indicator */}
                <span className={cn(
                  "text-[9px] font-medium ml-auto flex-shrink-0",
                  displayDaysInPhase !== null && displayDaysInPhase > 7 ? "text-destructive" : 
                  displayDaysInPhase !== null && displayDaysInPhase > 3 ? "text-priority-medium" : 
                  "text-muted-foreground"
                )}>
                  {daysDisplay}
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
              <div className="border-t pt-1 mt-1">
                <p><span className="text-muted-foreground">📅 Emissão:</span> {new Date(order.createdDate).toLocaleDateString("pt-BR")}</p>
                <p><span className="text-muted-foreground">📆 Dias de emissão:</span> {Math.max(0, Math.floor((Date.now() - new Date(order.createdDate).getTime()) / (1000 * 60 * 60 * 24)))}</p>
                <p><span className="text-muted-foreground">⏱️ Tempo na fase:</span> {daysDisplay}</p>
              </div>
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div ref={setNodeRef} style={style} className={isDragging ? "dragging" : ""}>
              <Card 
                className={cn(
                  "group relative kanban-card kanban-card-compact p-1.5 transition-all duration-150 shadow-none",
                  !isEcommerce && !isMinimal && getPriorityClass(order.priority),
                  isMinimal && "border-l border-l-border/50",
                  isDragging ? 'cursor-grabbing opacity-50' : 'cursor-pointer hover:bg-accent/40',
                  isVendasEcommerce && !isMinimal && 'animate-ecommerce-pulse border',
                  isAnimating && 'animate-card-pop-in'
                )}
                onClick={handleCardClick}
                onMouseDown={() => setClickStart(Date.now())}
              >
                {/* Drag handle - hidden by default, visible on hover */}
                <div 
                  className="absolute right-0 top-0 p-0.5 rounded text-muted-foreground/40 cursor-grab active:cursor-grabbing transition-opacity opacity-0 group-hover:opacity-100"
                  {...listeners}
                  {...attributes}
                  onMouseDown={e => { e.stopPropagation(); setClickStart(Date.now() + 500); }}
                  onClick={e => e.stopPropagation()}
                >
                  <GripVertical className="h-2.5 w-2.5" />
                </div>
                  
                {/* Line 1: Priority dot + Order number + minimal badges */}
                <div className="flex items-center gap-1 flex-wrap pr-3">
                  {/* Priority dot - minimal indicator */}
                  {!isMinimal && order.priority !== 'low' && (
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                      getPriorityDotClass(order.priority)
                    )} />
                  )}
                  
                  <span className="font-semibold text-[10px] text-foreground/90">#{order.orderNumber}</span>
                  
                  {/* WhatsApp indicator - subtle */}
                  {(order as any).customer_whatsapp && (
                    <span className="text-[8px] text-muted-foreground" title="WhatsApp">📱</span>
                  )}
                  
                  {/* Business area - text only */}
                  {order.business_area && BUSINESS_AREA_CONFIG[order.business_area] && (
                    <span className="text-[8px] text-muted-foreground font-medium">
                      {BUSINESS_AREA_CONFIG[order.business_area].label}
                    </span>
                  )}
                  
                  {/* State - text only */}
                  {sender && (
                    <span className="text-[8px] text-muted-foreground">
                      {sender.state}
                    </span>
                  )}
                    
                  {/* Source indicators - subtle text */}
                  {sourceCounts.outOfStock > 0 && (
                    <span className="text-[8px] text-destructive/70 font-medium">
                      {sourceCounts.outOfStock}p
                    </span>
                  )}
                  {purchaseItemsCount > 0 && (
                    <span className="text-[8px] text-muted-foreground">
                      {purchaseItemsCount}c
                    </span>
                  )}
                  
                  {/* Days in phase - compact mono */}
                  <span className={cn(
                    "text-[9px] font-mono tabular-nums ml-auto",
                    displayDaysInPhase !== null && displayDaysInPhase > 7 ? "text-destructive/80" : 
                    displayDaysInPhase !== null && displayDaysInPhase > 3 ? "text-priority-medium/80" : 
                    "text-muted-foreground/70"
                  )}>
                    {daysDisplay}
                  </span>
                </div>
                
                {/* Line 2: Client + items - subtle */}
                <p className="text-[9px] text-muted-foreground/80 line-clamp-1 mt-0.5">
                  {maskText(order.client, 'name')} · {order.items?.length || 0}
                </p>
              </Card>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-2 text-xs">
              <p className="font-bold border-b pb-1">#{order.orderNumber}</p>
              
              <p><span className="text-muted-foreground">Cliente:</span> {maskText(order.client, 'name')}</p>
              <p><span className="text-muted-foreground">Prazo:</span> {new Date(order.deliveryDeadline).toLocaleDateString("pt-BR")}</p>
              <p className={daysRemaining < 0 ? "text-destructive" : daysRemaining <= 2 ? "text-priority-medium" : ""}>
                {daysRemaining < 0 
                  ? `⚠️ ${Math.abs(daysRemaining)} dias atrasado`
                  : daysRemaining === 0 
                    ? "📌 Vence hoje"
                    : `✓ ${daysRemaining} dias restantes`
                }
              </p>
              
              <div className="border-t pt-2 mt-2">
                <p>
                  <span className="text-muted-foreground">📅 Emissão:</span>{' '}
                  {new Date(order.createdDate).toLocaleDateString("pt-BR")}
                </p>
                <p>
                  <span className="text-muted-foreground">📆 Dias de emissão:</span>{' '}
                  {Math.max(0, Math.floor((Date.now() - new Date(order.createdDate).getTime()) / (1000 * 60 * 60 * 24)))}
                </p>
              </div>
              
              <div className="border-t pt-2 mt-2">
                {phaseEnteredAt && (
                  <p>
                    <span className="text-muted-foreground">📅 Entrada na fase:</span>{' '}
                    {phaseEnteredAt.toLocaleDateString("pt-BR")}
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">⏱️ Tempo na fase:</span>{' '}
                  {displayDaysInPhase !== null ? `${displayDaysInPhase} ${displayDaysInPhase === 1 ? 'dia' : 'dias'}` : '...'}
                </p>
              </div>
              
              <div className="border-t pt-2 mt-2">
                <p>
                  <span className="text-muted-foreground">🎯 Prioridade:</span>{' '}
                  {getPriorityLabel(order.priority)}
                </p>
                <p>
                  <span className="text-muted-foreground">📦 Itens:</span>{' '}
                  {order.items?.length || 0}
                </p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Full view rendering - SIMPLIFIED (3 lines only)
  const sourceCounts = countItemsBySource(order.items);
  const sender = (order as any).sender_company ? getSenderById((order as any).sender_company) : null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div ref={setNodeRef} style={style} className={isDragging ? "dragging" : ""}>
            <Card 
              className={cn(
                "group relative kanban-card p-1.5 transition-all duration-150 shadow-none",
                !isEcommerce && !isMinimal && getPriorityClass(order.priority),
                isMinimal && "border-l border-l-border/50",
                isDragging ? 'cursor-grabbing opacity-50' : 'cursor-pointer hover:bg-accent/40',
                isVendasEcommerce && !isMinimal && 'animate-ecommerce-pulse border',
                isAnimating && 'animate-card-pop-in'
              )} 
              onClick={handleCardClick} 
              onMouseDown={() => setClickStart(Date.now())}
            >
              {/* Drag handle - hidden by default */}
              <div 
                className="absolute right-0 top-0 p-0.5 rounded text-muted-foreground/40 cursor-grab active:cursor-grabbing transition-opacity opacity-0 group-hover:opacity-100" 
                {...listeners} 
                {...attributes} 
                onMouseDown={e => { e.stopPropagation(); setClickStart(Date.now() + 500); }} 
                onClick={e => e.stopPropagation()}
              >
                <GripVertical className="h-2.5 w-2.5" />
              </div>

              {/* Line 1: Priority dot + Order number + minimal text badges */}
              <div className="flex items-center gap-1 pr-3 flex-wrap">
                {/* Priority dot */}
                {!isMinimal && order.priority !== 'low' && (
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    getPriorityDotClass(order.priority)
                  )} />
                )}
                
                <span className="font-semibold text-[10px] text-foreground/90">#{order.orderNumber}</span>
                
                {(order as any).customer_whatsapp && (
                  <span className="text-[8px] text-muted-foreground" title="WhatsApp">📱</span>
                )}
                
                {/* Business area - text only */}
                {order.business_area && BUSINESS_AREA_CONFIG[order.business_area] && (
                  <span className="text-[8px] text-muted-foreground font-medium">
                    {BUSINESS_AREA_CONFIG[order.business_area].label}
                  </span>
                )}
                
                {/* State - text only */}
                {sender && (
                  <span className="text-[8px] text-muted-foreground">
                    {sender.state}
                  </span>
                )}
              </div>

              {/* Line 2: Client + items */}
              <div className="flex items-center gap-1 mt-0.5 text-[9px]">
                <span className="text-muted-foreground/80 truncate flex-1" title={maskText(order.client, 'name')}>
                  {maskText(order.client, 'name')}
                </span>
                <span className="text-muted-foreground/60 flex-shrink-0">
                  · {order.items?.length || 1}
                </span>
                
                {/* Source indicators - subtle */}
                {sourceCounts.outOfStock > 0 && (
                  <span className="text-[8px] text-destructive/70 font-medium flex-shrink-0">
                    {sourceCounts.outOfStock}p
                  </span>
                )}
                {purchaseItemsCount > 0 && (
                  <span className="text-[8px] text-muted-foreground flex-shrink-0">
                    {purchaseItemsCount}c
                  </span>
                )}
              </div>

              {/* Line 3: Days in phase */}
              <div className="flex items-center justify-between mt-0.5 text-[9px]">
                <span className="text-muted-foreground/60 font-mono text-[8px]">
                  {new Date(order.deliveryDeadline).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
                </span>
                <span className={cn(
                  "font-mono tabular-nums text-[9px]",
                  displayDaysInPhase !== null && displayDaysInPhase > 7 ? "text-destructive/80" : 
                  displayDaysInPhase !== null && displayDaysInPhase > 3 ? "text-priority-medium/80" : 
                  "text-muted-foreground/60"
                )}>
                  {daysDisplay}
                </span>
              </div>
            </Card>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <p className="font-bold border-b pb-1">#{order.orderNumber}</p>
            
            <p><span className="text-muted-foreground">Cliente:</span> {maskText(order.client, 'name')}</p>
            <p><span className="text-muted-foreground">Prazo:</span> {new Date(order.deliveryDeadline).toLocaleDateString("pt-BR")}</p>
            <p className={daysRemaining < 0 ? "text-destructive" : daysRemaining <= 2 ? "text-priority-medium" : ""}>
              {daysRemaining < 0 
                ? `⚠️ ${Math.abs(daysRemaining)} dias atrasado`
                : daysRemaining === 0 
                  ? "📌 Vence hoje"
                  : `✓ ${daysRemaining} dias restantes`
              }
            </p>
            
            <div className="border-t pt-2 mt-2">
              {phaseEnteredAt && (
                <p>
                  <span className="text-muted-foreground">📅 Entrada na fase:</span>{' '}
                  {phaseEnteredAt.toLocaleDateString("pt-BR")}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">⏱️ Tempo na fase:</span>{' '}
                {displayDaysInPhase !== null ? `${displayDaysInPhase} ${displayDaysInPhase === 1 ? 'dia' : 'dias'}` : '...'}
              </p>
            </div>
            
            <div className="border-t pt-2 mt-2">
              <p>
                <span className="text-muted-foreground">🎯 Prioridade:</span>{' '}
                {getPriorityLabel(order.priority)}
              </p>
              <p>
                <span className="text-muted-foreground">📦 Itens:</span>{' '}
                {order.items?.length || 0}
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Comparador customizado para evitar re-renders desnecessários do card
const areCardsEqual = (prev: KanbanCardProps, next: KanbanCardProps): boolean => {
  // Comparar props de controle
  if (
    prev.canDrag !== next.canDrag ||
    prev.isAnimating !== next.isAnimating ||
    prev.viewMode !== next.viewMode ||
    prev.daysInPhase !== next.daysInPhase
  ) {
    return false;
  }
  
  // Comparar propriedades relevantes da order
  const prevOrder = prev.order;
  const nextOrder = next.order;
  
  return (
    prevOrder.id === nextOrder.id &&
    prevOrder.orderNumber === nextOrder.orderNumber &&
    prevOrder.status === nextOrder.status &&
    prevOrder.priority === nextOrder.priority &&
    prevOrder.client === nextOrder.client &&
    prevOrder.deliveryDeadline === nextOrder.deliveryDeadline &&
    prevOrder.type === nextOrder.type &&
    prevOrder.business_area === nextOrder.business_area &&
    prevOrder.items?.length === nextOrder.items?.length &&
    prevOrder.customer_whatsapp === nextOrder.customer_whatsapp
  );
};

export const KanbanCard = React.memo(KanbanCardComponent, areCardsEqual);
KanbanCard.displayName = 'KanbanCard';