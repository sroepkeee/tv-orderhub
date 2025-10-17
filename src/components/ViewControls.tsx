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
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-1 border rounded-lg p-1">
        <Button
          variant={viewMode === "list" ? "default" : "ghost"}
          size="sm"
          className="gap-2"
          onClick={() => onViewModeChange("list")}
        >
          <List className="h-4 w-4" />
          Lista
        </Button>
        <Button
          variant={viewMode === "kanban" ? "default" : "ghost"}
          size="sm"
          className="gap-2"
          onClick={() => onViewModeChange("kanban")}
        >
          <LayoutGrid className="h-4 w-4" />
          Kanban
        </Button>
      </div>

      {/* Sort Control (hidden in Kanban view) */}
      {viewMode === "list" && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Ordenar: {sortOptions.find(o => o.value === sortBy)?.label}
          </Button>
        </DropdownMenuTrigger>
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
      )}

      {/* Group Control (hidden in Kanban view) */}
      {viewMode === "list" && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Layers className="h-4 w-4" />
            Agrupar: {groupOptions.find(o => o.value === groupBy)?.label}
          </Button>
        </DropdownMenuTrigger>
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
      )}

      {/* Category Filter */}
      {onCategoryFilterChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              {categoryFilters.find(o => o.value === categoryFilter)?.icon}{' '}
              {categoryFilters.find(o => o.value === categoryFilter)?.label}
            </Button>
          </DropdownMenuTrigger>
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
      )}

      {/* Phase Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Fase: {phaseFilters.find(o => o.value === phaseFilter)?.label}
          </Button>
        </DropdownMenuTrigger>
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
    </div>
  );
};
