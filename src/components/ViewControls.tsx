import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowUpDown, Filter, Layers, LayoutGrid, List } from "lucide-react";

export type SortOption = "priority" | "deadline" | "created" | "status";
export type GroupOption = "priority" | "phase" | "type" | "category" | "none";
export type PhaseFilter = "all" | "preparation" | "production" | "packaging" | "logistics" | "completion";
export type ViewMode = "list" | "kanban";
export type CategoryFilter = "all" | "reposicao" | "vendas" | "operacoes_especiais";

interface ViewControlsProps {
  sortBy: SortOption;
  groupBy: GroupOption;
  phaseFilter: PhaseFilter;
  viewMode: ViewMode;
  categoryFilter?: CategoryFilter;
  onSortChange: (sort: SortOption) => void;
  onGroupChange: (group: GroupOption) => void;
  onPhaseFilterChange: (phase: PhaseFilter) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onCategoryFilterChange?: (category: CategoryFilter) => void;
}

export const ViewControls = ({
  sortBy,
  groupBy,
  phaseFilter,
  viewMode,
  categoryFilter = "all",
  onSortChange,
  onGroupChange,
  onPhaseFilterChange,
  onViewModeChange,
  onCategoryFilterChange,
}: ViewControlsProps) => {
  const sortOptions = [
    { value: "priority" as SortOption, label: "Prioridade" },
    { value: "deadline" as SortOption, label: "Prazo de Entrega" },
    { value: "created" as SortOption, label: "Data de Criação" },
    { value: "status" as SortOption, label: "Status" },
  ];

  const groupOptions = [
    { value: "priority" as GroupOption, label: "Prioridade" },
    { value: "phase" as GroupOption, label: "Fase" },
    { value: "category" as GroupOption, label: "Categoria" },
    { value: "type" as GroupOption, label: "Tipo de Pedido" },
    { value: "none" as GroupOption, label: "Sem Agrupamento" },
  ];

  const categoryFilters = [
    { value: "all" as CategoryFilter, label: "Todas Categorias", icon: "📋" },
    { value: "reposicao" as CategoryFilter, label: "Reposição", icon: "📦" },
    { value: "vendas" as CategoryFilter, label: "Vendas", icon: "🏪" },
    { value: "operacoes_especiais" as CategoryFilter, label: "Operações Especiais", icon: "🔄" },
  ];

  const phaseFilters = [
    { value: "all" as PhaseFilter, label: "Todas as Fases" },
    { value: "preparation" as PhaseFilter, label: "Preparação" },
    { value: "production" as PhaseFilter, label: "Produção" },
    { value: "packaging" as PhaseFilter, label: "Embalagem" },
    { value: "logistics" as PhaseFilter, label: "Expedição" },
    { value: "completion" as PhaseFilter, label: "Conclusão" },
  ];

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-0.5 border rounded-md p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => onViewModeChange("list")}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Lista</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => onViewModeChange("kanban")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Kanban</TooltipContent>
          </Tooltip>
        </div>

        {/* Sort Control (hidden in Kanban view) */}
        {viewMode === "list" && (
        <Tooltip>
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
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                  className={sortBy === option.value ? "bg-accent" : ""}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipContent>Ordenar</TooltipContent>
        </Tooltip>
        )}

        {/* Group Control (hidden in Kanban view) */}
        {viewMode === "list" && (
        <Tooltip>
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
              {groupOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onGroupChange(option.value)}
                  className={groupBy === option.value ? "bg-accent" : ""}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipContent>Agrupar</TooltipContent>
        </Tooltip>
        )}

        {/* Category Filter */}
        {onCategoryFilterChange && (
          <Tooltip>
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
                {categoryFilters.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => onCategoryFilterChange(option.value)}
                    className={categoryFilter === option.value ? "bg-accent" : ""}
                  >
                    <span className="mr-2">{option.icon}</span>
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent>Filtrar por Categoria</TooltipContent>
          </Tooltip>
        )}

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
              {phaseFilters.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onPhaseFilterChange(option.value)}
                  className={phaseFilter === option.value ? "bg-accent" : ""}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipContent>Filtrar por Fase</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
