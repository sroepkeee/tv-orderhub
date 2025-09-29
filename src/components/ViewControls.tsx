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
import { ArrowUpDown, Filter, Layers } from "lucide-react";

export type SortOption = "priority" | "deadline" | "created" | "status";
export type GroupOption = "priority" | "phase" | "type" | "none";
export type PhaseFilter = "all" | "preparation" | "production" | "packaging" | "logistics" | "completion";

interface ViewControlsProps {
  sortBy: SortOption;
  groupBy: GroupOption;
  phaseFilter: PhaseFilter;
  onSortChange: (sort: SortOption) => void;
  onGroupChange: (group: GroupOption) => void;
  onPhaseFilterChange: (phase: PhaseFilter) => void;
}

export const ViewControls = ({
  sortBy,
  groupBy,
  phaseFilter,
  onSortChange,
  onGroupChange,
  onPhaseFilterChange,
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
    { value: "type" as GroupOption, label: "Tipo de Pedido" },
    { value: "none" as GroupOption, label: "Sem Agrupamento" },
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
    <div className="flex items-center gap-3 mb-6">
      {/* Sort Control */}
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

      {/* Group Control */}
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
