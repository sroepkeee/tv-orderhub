import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { ProductionFilters as Filters } from "@/types/production";

interface ProductionFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  warehouses: string[];
}

export const ProductionFilters = ({ filters, onFiltersChange, warehouses }: ProductionFiltersProps) => {
  const handleReset = () => {
    onFiltersChange({
      orderNumber: '',
      itemStatus: 'all',
      warehouse: '',
      searchTerm: '',
    });
  };

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filtros</h3>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Busca geral */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar código ou descrição..."
            value={filters.searchTerm || ''}
            onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Número do pedido */}
        <Input
          placeholder="Nº do Pedido"
          value={filters.orderNumber || ''}
          onChange={(e) => onFiltersChange({ ...filters, orderNumber: e.target.value })}
        />

        {/* Situação */}
        <Select
          value={filters.itemStatus || 'all'}
          onValueChange={(value) => onFiltersChange({ ...filters, itemStatus: value as any })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas as situações" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_stock">Disponível em Estoque</SelectItem>
            <SelectItem value="awaiting_production">Aguardando Produção</SelectItem>
            <SelectItem value="purchase_required">Solicitar Compra</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
          </SelectContent>
        </Select>

        {/* Armazém */}
        <Select
          value={filters.warehouse || 'all'}
          onValueChange={(value) => onFiltersChange({ ...filters, warehouse: value === 'all' ? '' : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os armazéns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os armazéns</SelectItem>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse} value={warehouse}>
                {warehouse}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
