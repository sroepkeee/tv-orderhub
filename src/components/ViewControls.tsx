import React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, Filter, Layers } from "lucide-react";
import { Order } from "./Dashboard";
import { KanbanDensity } from "@/hooks/useKanbanDensity";
import { ViewSettingsPopover } from "./ViewSettingsPopover";
export type SortOption = "priority" | "deadline" | "created" | "status";
export type GroupOption = "priority" | "phase" | "type" | "category" | "none";
export type PhaseFilter = "all" | "preparation" | "production" | "packaging" | "logistics" | "completion";
export type ViewMode = "list" | "kanban" | "matrix";
export type CategoryFilter = "all" | "reposicao" | "vendas" | "operacoes_especiais";
export type StatusFilter = "all" | "high_priority" | "medium_priority" | "low_priority" | "critical_deadline" | "new_today" | "on_hold" | "delayed" | "preparation" | "production" | "packaging" | "invoicing" | "shipping" | "completed" | "ecommerce";
export type CardViewMode = "full" | "compact" | "micro";
interface ViewControlsProps {
  sortBy: SortOption;
  groupBy: GroupOption;
  phaseFilter: PhaseFilter;
  viewMode: ViewMode;
  categoryFilter?: CategoryFilter;
  statusFilter?: StatusFilter;
  cardViewMode?: CardViewMode;
  orders?: Order[];
  kanbanDensity?: KanbanDensity;
  kanbanAutoDetect?: boolean;
  kanbanSuggestedDensity?: KanbanDensity;
  onSortChange: (sort: SortOption) => void;
  onGroupChange: (group: GroupOption) => void;
  onPhaseFilterChange: (phase: PhaseFilter) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onCategoryFilterChange?: (category: CategoryFilter) => void;
  onStatusFilterChange?: (status: StatusFilter) => void;
  onCardViewModeChange?: (mode: CardViewMode) => void;
  onKanbanDensityChange?: (density: KanbanDensity) => void;
  onKanbanAutoDetectChange?: (enabled: boolean) => void;
}
export const ViewControls = ({
  sortBy,
  groupBy,
  phaseFilter,
  viewMode,
  categoryFilter = "all",
  statusFilter = "all",
  cardViewMode = "full",
  orders = [],
  kanbanDensity = "comfortable",
  kanbanAutoDetect = true,
  kanbanSuggestedDensity,
  onSortChange,
  onGroupChange,
  onPhaseFilterChange,
  onViewModeChange,
  onCategoryFilterChange,
  onStatusFilterChange,
  onCardViewModeChange,
  onKanbanDensityChange,
  onKanbanAutoDetectChange
}: ViewControlsProps) => {
  const sortOptions = [{
    value: "priority" as SortOption,
    label: "Prioridade"
  }, {
    value: "deadline" as SortOption,
    label: "Prazo de Entrega"
  }, {
    value: "created" as SortOption,
    label: "Data de Criação"
  }, {
    value: "status" as SortOption,
    label: "Status"
  }];
  const groupOptions = [{
    value: "priority" as GroupOption,
    label: "Prioridade"
  }, {
    value: "phase" as GroupOption,
    label: "Fase"
  }, {
    value: "category" as GroupOption,
    label: "Categoria"
  }, {
    value: "type" as GroupOption,
    label: "Tipo de Pedido"
  }, {
    value: "none" as GroupOption,
    label: "Sem Agrupamento"
  }];
  const categoryFilters = [{
    value: "all" as CategoryFilter,
    label: "Todas Categorias",
    icon: "📋"
  }, {
    value: "reposicao" as CategoryFilter,
    label: "Reposição",
    icon: "📦"
  }, {
    value: "vendas" as CategoryFilter,
    label: "Vendas",
    icon: "🏪"
  }, {
    value: "operacoes_especiais" as CategoryFilter,
    label: "Operações Especiais",
    icon: "🔄"
  }];
  const phaseFilters = [{
    value: "all" as PhaseFilter,
    label: "Todas as Fases"
  }, {
    value: "preparation" as PhaseFilter,
    label: "Preparação"
  }, {
    value: "production" as PhaseFilter,
    label: "Produção"
  }, {
    value: "packaging" as PhaseFilter,
    label: "Embalagem"
  }, {
    value: "logistics" as PhaseFilter,
    label: "Expedição"
  }, {
    value: "completion" as PhaseFilter,
    label: "Conclusão"
  }];

  // Calcular contagens por status e métricas (EXCLUINDO CONCLUÍDOS dos indicadores principais)
  const statusCounts = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Pedidos ativos (excluindo concluídos)
    const activeOrders = orders.filter(o => !["delivered", "completed"].includes(o.status));
    const completedOrders = orders.filter(o => ["delivered", "completed"].includes(o.status));
    const counts = {
      // INDICADORES ATIVOS (sem concluídos)
      total: activeOrders.length,
      preparation: activeOrders.filter(o => ["pending", "in_review", "approved", "materials_ordered"].includes(o.status)).length,
      production: activeOrders.filter(o => ["in_production", "awaiting_material", "production_completed"].includes(o.status)).length,
      packaging: activeOrders.filter(o => ["in_quality_check", "in_packaging", "ready_for_shipping"].includes(o.status)).length,
      invoicing: activeOrders.filter(o => ["ready_to_invoice", "pending_invoice_request", "awaiting_invoice", "invoice_requested", "invoice_issued", "invoice_sent"].includes(o.status)).length,
      shipping: activeOrders.filter(o => ["released_for_shipping", "in_expedition", "in_transit", "awaiting_pickup", "collected"].includes(o.status)).length,
      delayed: activeOrders.filter(o => ["delayed", "on_hold"].includes(o.status)).length,
      highPriority: activeOrders.filter(o => o.priority === "high").length,
      mediumPriority: activeOrders.filter(o => o.priority === "medium").length,
      lowPriority: activeOrders.filter(o => o.priority === "low").length,
      criticalDeadline: activeOrders.filter(o => {
        if (!o.deliveryDeadline) return false;
        const deadline = new Date(o.deliveryDeadline);
        const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 3 && daysUntil >= 0;
      }).length,
      newToday: activeOrders.filter(o => {
        if (!o.createdDate) return false;
        const created = new Date(o.createdDate);
        return created >= todayStart;
      }).length,
      onHold: activeOrders.filter(o => ["on_hold", "awaiting_material", "awaiting_approval"].includes(o.status)).length,
      // INDICADORES DE CONCLUÍDOS (seção separada)
      completed: completedOrders.length,
      completionRate: orders.length > 0 ? Math.round(completedOrders.length / orders.length * 100) : 0,
      totalWithCompleted: orders.length,
      // Pedidos concluídos no prazo
      completedOnTime: completedOrders.filter(o => {
        if (!o.deliveryDeadline || !o.createdDate) return false;
        const deadline = new Date(o.deliveryDeadline);
        const created = new Date(o.createdDate);
        const actualDays = Math.ceil((deadline.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return actualDays >= 0; // Entregue antes ou no prazo
      }).length,
      onTimeRate: completedOrders.length > 0 ? Math.round(completedOrders.filter(o => {
        if (!o.deliveryDeadline || !o.createdDate) return false;
        const deadline = new Date(o.deliveryDeadline);
        const created = new Date(o.createdDate);
        return Math.ceil((deadline.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)) >= 0;
      }).length / completedOrders.length * 100) : 0
    };
    return counts;
  }, [orders]);
  return <TooltipProvider>
      
    </TooltipProvider>;
};