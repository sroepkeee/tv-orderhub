import React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, Filter, Layers, LayoutGrid, List, Maximize2, Minimize2, Palette, Circle, Table2, Monitor, Columns3, Wand2 } from "lucide-react";
import { Order } from "./Dashboard";
import { useVisualMode } from "@/hooks/useVisualMode";
import { KanbanDensity } from "@/hooks/useKanbanDensity";
import { cn } from "@/lib/utils";
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
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {/* Status Cards - Linha 1: Métricas Gerais */}
        {orders.length > 0 && <>
            <div className="flex items-center gap-1 mr-2 px-2 py-0.5 bg-muted/50 rounded-md border">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground font-medium">Ativos:</span>
                <span className="font-bold text-foreground">{statusCounts.total}</span>
                <span className="text-[10px] text-muted-foreground ml-0.5">
                  ({statusCounts.totalWithCompleted} total)
                </span>
              </div>
              <div className="h-3 w-px bg-border mx-1" />
              
              <Button variant="ghost" size="sm" onClick={() => onStatusFilterChange?.(statusFilter === "high_priority" ? "all" : "high_priority")} className={`flex items-center gap-1 px-1.5 py-0.5 h-auto rounded transition-all hover:bg-red-100 dark:hover:bg-red-900/30 ${statusFilter === "high_priority" ? "bg-red-100 dark:bg-red-900/40" : ""}`}>
                <span className="text-[10px] text-muted-foreground font-medium">🔴 Alta:</span>
                <span className="text-[10px] font-bold text-[hsl(var(--priority-high))]">{statusCounts.highPriority}</span>
              </Button>
              
              <div className="h-3 w-px bg-border mx-1" />
              
              <Button variant="ghost" size="sm" onClick={() => onStatusFilterChange?.(statusFilter === "medium_priority" ? "all" : "medium_priority")} className={`flex items-center gap-1 px-1.5 py-0.5 h-auto rounded transition-all hover:bg-orange-100 dark:hover:bg-orange-900/30 ${statusFilter === "medium_priority" ? "bg-orange-100 dark:bg-orange-900/40" : ""}`}>
                <span className="text-[10px] text-muted-foreground font-medium">🟡 Média:</span>
                <span className="text-[10px] font-bold text-[hsl(var(--priority-medium))]">{statusCounts.mediumPriority}</span>
              </Button>
              
              <div className="h-3 w-px bg-border mx-1" />
              
              <Button variant="ghost" size="sm" onClick={() => onStatusFilterChange?.(statusFilter === "low_priority" ? "all" : "low_priority")} className={`flex items-center gap-1 px-1.5 py-0.5 h-auto rounded transition-all hover:bg-green-100 dark:hover:bg-green-900/30 ${statusFilter === "low_priority" ? "bg-green-100 dark:bg-green-900/40" : ""}`}>
                <span className="text-[10px] text-muted-foreground font-medium">🟢 Baixa:</span>
                <span className="text-[10px] font-bold text-[hsl(var(--priority-low))]">{statusCounts.lowPriority}</span>
              </Button>
              {statusCounts.criticalDeadline > 0 && <>
                  <div className="h-3 w-px bg-border mx-1" />
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground font-medium">🔥 Prazo Crítico:</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400 animate-pulse">{statusCounts.criticalDeadline}</span>
                  </div>
                </>}
              {statusCounts.newToday > 0 && <>
                  <div className="h-3 w-px bg-border mx-1" />
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground font-medium">📅 Novos Hoje:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{statusCounts.newToday}</span>
                  </div>
                </>}
              {statusCounts.onHold > 0 && <>
                  <div className="h-3 w-px bg-border mx-1" />
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground font-medium">⏱️ Aguardando:</span>
                    <span className="font-bold text-yellow-600 dark:text-yellow-400">{statusCounts.onHold}</span>
                  </div>
                </>}
              {statusCounts.delayed > 0 && <>
                  <div className="h-3 w-px bg-border mx-1" />
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground font-medium">⚠️ Atrasados:</span>
                    <span className="font-bold text-[hsl(var(--progress-critical))] animate-pulse">{statusCounts.delayed}</span>
                  </div>
                </>}
            </div>

            {/* Status Cards - Linha 2: Fases do Processo */}
            

            {/* Seção de Indicadores de Concluídos */}
            <div className="flex items-center gap-1 mr-2 px-2 py-1 bg-green-50/50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800">
              <Button variant="ghost" size="sm" onClick={() => onStatusFilterChange?.(statusFilter === "completed" ? "all" : "completed")} className={`flex items-center gap-1 px-2 py-0.5 h-auto rounded transition-all hover:bg-green-100 dark:hover:bg-green-900/30 ${statusFilter === "completed" ? "bg-green-100 dark:bg-green-900/40" : ""}`}>
                <span className="text-xs text-green-700 dark:text-green-300 font-medium">✓ Concluídos:</span>
                <span className="text-xs font-bold text-[hsl(var(--progress-good))]">{statusCounts.completed}</span>
              </Button>
              
              <div className="h-3 w-px bg-green-300 dark:bg-green-700 mx-1" />
              
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-700 dark:text-green-300 font-medium">% Total:</span>
                <span className="font-bold text-[hsl(var(--progress-good))]">{statusCounts.completionRate}%</span>
              </div>
              
              <div className="h-3 w-px bg-green-300 dark:bg-green-700 mx-1" />
              
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-700 dark:text-green-300 font-medium">✓ No Prazo:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{statusCounts.completedOnTime}</span>
              </div>
              
              <div className="h-3 w-px bg-green-300 dark:bg-green-700 mx-1" />
              
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-700 dark:text-green-300 font-medium">Taxa Prazo:</span>
                <span className={`font-bold ${statusCounts.onTimeRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : statusCounts.onTimeRate >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {statusCounts.onTimeRate}%
                </span>
              </div>
            </div>

            {/* E-commerce Insights Card */}
            {(() => {
          const ecommerceOrders = orders.filter(o => o.type === 'ecommerce');
          const ecomTotal = ecommerceOrders.length;
          const ecomHigh = ecommerceOrders.filter(o => o.priority === 'high').length;
          const ecomInProgress = ecommerceOrders.filter(o => !["delivered", "completed", "cancelled"].includes(o.status)).length;
          const ecomCritical = ecommerceOrders.filter(o => {
            if (!o.deliveryDeadline || ["delivered", "completed", "cancelled"].includes(o.status)) return false;
            const deadline = new Date(o.deliveryDeadline);
            const now = new Date();
            const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return daysUntil <= 2 && daysUntil >= 0;
          }).length;
          const ecomCompleted = ecommerceOrders.filter(o => ["delivered", "completed"].includes(o.status)).length;
          const ecomCompletionRate = ecomTotal > 0 ? Math.round(ecomCompleted / ecomTotal * 100) : 0;
          if (ecomTotal === 0) return null;
          return <Button variant="ghost" size="sm" onClick={() => onStatusFilterChange?.(statusFilter === "ecommerce" ? "all" : "ecommerce")} className={`flex items-center gap-1 mr-2 px-2 py-0.5 h-auto rounded-md border transition-all hover:shadow-md ${statusFilter === "ecommerce" ? "bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600" : "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"}`}>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-blue-700 dark:text-blue-300 font-medium">🛒 E-commerce:</span>
                    <span className="font-bold text-blue-900 dark:text-blue-100">{ecomTotal}</span>
                  </div>
                  {ecomHigh > 0 && <>
                      <div className="h-3 w-px bg-blue-300 dark:bg-blue-700 mx-1" />
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-blue-700 dark:text-blue-300 font-medium">🔴 Prioritários:</span>
                        <span className="font-bold text-red-600 dark:text-red-400">{ecomHigh}</span>
                      </div>
                    </>}
                  {ecomInProgress > 0 && <>
                      <div className="h-3 w-px bg-blue-300 dark:bg-blue-700 mx-1" />
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-blue-700 dark:text-blue-300 font-medium">⚙️ Em Andamento:</span>
                        <span className="font-bold text-blue-900 dark:text-blue-100">{ecomInProgress}</span>
                      </div>
                    </>}
                  {ecomCritical > 0 && <>
                      <div className="h-3 w-px bg-blue-300 dark:bg-blue-700 mx-1" />
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-blue-700 dark:text-blue-300 font-medium">⏰ Prazo Urgente:</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400 animate-pulse">{ecomCritical}</span>
                      </div>
                    </>}
                  <div className="h-3 w-px bg-blue-300 dark:bg-blue-700 mx-1" />
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-blue-700 dark:text-blue-300 font-medium">✓ Taxa:</span>
                    <span className="font-bold text-green-600 dark:text-green-400">{ecomCompletionRate}%</span>
                  </div>
                </Button>;
        })()}
          </>}
        
        {/* View Mode Toggle */}
        <div className="flex items-center gap-0.5 border rounded-md p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onViewModeChange("list")}>
                <List className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Lista</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onViewModeChange("kanban")}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Kanban</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={viewMode === "matrix" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => onViewModeChange("matrix")}>
                <Table2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Matriz de Fases</TooltipContent>
          </Tooltip>
        </div>
        
        {/* Kanban Density Controls (only in Kanban view) */}
        {viewMode === "kanban" && onKanbanDensityChange && <div className="flex items-center gap-0.5 border rounded-md p-0.5 bg-muted/30">
            {/* Auto-detect toggle */}
            {onKanbanAutoDetectChange && <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={kanbanAutoDetect ? "default" : "ghost"} size="icon" className={cn("h-7 w-7", kanbanAutoDetect && "bg-primary/80")} onClick={() => onKanbanAutoDetectChange(!kanbanAutoDetect)}>
                    <Wand2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <p className="font-medium">Auto-detectar</p>
                    <p className="text-xs text-muted-foreground">
                      {kanbanAutoDetect ? `Ativo: usando "${kanbanSuggestedDensity === 'comfortable' ? 'Confortável' : kanbanSuggestedDensity === 'compact' ? 'Compacto' : 'TV'}"` : "Clique para ativar (Ctrl+0)"}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>}
            
            <div className="h-4 w-px bg-border mx-0.5" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={kanbanDensity === "comfortable" && !kanbanAutoDetect ? "default" : "ghost"} size="icon" className={cn("h-7 w-7", kanbanAutoDetect && kanbanSuggestedDensity === "comfortable" && "ring-2 ring-primary/50")} onClick={() => onKanbanDensityChange("comfortable")}>
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-medium">Confortável</p>
                  <p className="text-xs text-muted-foreground">Cards completos (Ctrl+1)</p>
                </div>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={kanbanDensity === "compact" && !kanbanAutoDetect ? "default" : "ghost"} size="icon" className={cn("h-7 w-7", kanbanAutoDetect && kanbanSuggestedDensity === "compact" && "ring-2 ring-primary/50")} onClick={() => onKanbanDensityChange("compact")}>
                  <Columns3 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-medium">Compacto</p>
                  <p className="text-xs text-muted-foreground">Ver mais fases (Ctrl+2)</p>
                </div>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={kanbanDensity === "tv" && !kanbanAutoDetect ? "default" : "ghost"} size="icon" className={cn("h-7 w-7", kanbanAutoDetect && kanbanSuggestedDensity === "tv" && "ring-2 ring-primary/50")} onClick={() => onKanbanDensityChange("tv")}>
                  <Monitor className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-medium">TV/Dashboard</p>
                  <p className="text-xs text-muted-foreground">Visão geral (Ctrl+3)</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>}
        
        {/* Visual Mode Toggle */}
        <VisualModeToggle />

        {/* Sort Control (hidden in Kanban view) */}
        {viewMode === "list" && <Tooltip>
          <DropdownMenu>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sortOptions.map(option => <DropdownMenuItem key={option.value} onClick={() => onSortChange(option.value)} className={sortBy === option.value ? "bg-accent" : ""}>
                  {option.label}
                </DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipContent>Ordenar</TooltipContent>
        </Tooltip>}

        {/* Group Control (hidden in Kanban view) */}
        {viewMode === "list" && <Tooltip>
          <DropdownMenu>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7">
                  <Layers className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Agrupar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {groupOptions.map(option => <DropdownMenuItem key={option.value} onClick={() => onGroupChange(option.value)} className={groupBy === option.value ? "bg-accent" : ""}>
                  {option.label}
                </DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipContent>Agrupar</TooltipContent>
        </Tooltip>}

        {/* Category Filter */}
        {onCategoryFilterChange && <Tooltip>
            <DropdownMenu>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-7 w-7">
                    <span className="text-sm">{categoryFilters.find(o => o.value === categoryFilter)?.icon}</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Filtrar por Categoria</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {categoryFilters.map(option => <DropdownMenuItem key={option.value} onClick={() => onCategoryFilterChange(option.value)} className={categoryFilter === option.value ? "bg-accent" : ""}>
                    <span className="mr-2">{option.icon}</span>
                    {option.label}
                  </DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent>Filtrar por Categoria</TooltipContent>
          </Tooltip>}

        {/* Phase Filter */}
        <Tooltip>
          <DropdownMenu>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7">
                  <Filter className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filtrar por Fase</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {phaseFilters.map(option => <DropdownMenuItem key={option.value} onClick={() => onPhaseFilterChange(option.value)} className={phaseFilter === option.value ? "bg-accent" : ""}>
                  {option.label}
                </DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipContent>Filtrar por Fase</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>;
};

// Visual Mode Toggle Component
const VisualModeToggle = () => {
  const {
    mode,
    toggleMode,
    isMinimal
  } = useVisualMode();
  return <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={toggleMode}>
            {isMinimal ? <Palette className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isMinimal ? "Modo Colorido" : "Modo Minimalista"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>;
};