import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Factory, Package, ShoppingCart, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { useProductionData } from "@/hooks/useProductionData";
import { useProductionExport } from "@/hooks/useProductionExport";
import { ProductionFilters } from "@/components/metrics/ProductionFilters";
import { ProductionItemsTable } from "@/components/metrics/ProductionItemsTable";
import { ProductionFilters as Filters } from "@/types/production";
import { MetricCard } from "@/components/metrics/MetricCard";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Production() {
  const navigate = useNavigate();
  const { items, stats, isLoading, error } = useProductionData();
  const { exportToExcel } = useProductionExport();
  
  const [filters, setFilters] = useState<Filters>({
    orderNumber: '',
    itemStatus: 'all',
    warehouse: '',
    searchTerm: '',
  });

  // Extrair armazéns únicos
  const warehouses = useMemo(() => {
    return Array.from(new Set(items.map(item => item.warehouse))).sort();
  }, [items]);

  // Aplicar filtros
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Filtro de número do pedido
      if (filters.orderNumber && !item.orderNumber.toLowerCase().includes(filters.orderNumber.toLowerCase())) {
        return false;
      }

      // Filtro de situação
      if (filters.itemStatus && filters.itemStatus !== 'all' && item.item_status !== filters.itemStatus) {
        return false;
      }

      // Filtro de armazém
      if (filters.warehouse && item.warehouse !== filters.warehouse) {
        return false;
      }

      // Filtro de busca (código ou descrição)
      if (filters.searchTerm) {
        const search = filters.searchTerm.toLowerCase();
        return (
          item.itemCode.toLowerCase().includes(search) ||
          item.itemDescription.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [items, filters]);

  const handleExport = () => {
    if (filteredItems.length === 0) {
      toast.error('Nenhum item para exportar');
      return;
    }
    exportToExcel(filteredItems, stats);
  };

  const handleOrderClick = (orderId: string) => {
    navigate(`/?orderId=${orderId}`);
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-destructive">Erro ao carregar dados de produção</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/metrics')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Factory className="h-8 w-8" />
              Controle de Produção
            </h1>
            <p className="text-muted-foreground mt-1">
              Visão completa de todos os itens em produção e estoque
            </p>
          </div>
        </div>
        <Button onClick={handleExport} size="lg" className="gap-2">
          <Download className="h-5 w-5" />
          Exportar Excel
        </Button>
      </div>

      {/* Métricas */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <MetricCard
            title="Em Produção"
            value={stats.awaiting_production}
            icon={Factory}
            status="warning"
          />
          <MetricCard
            title="Pendentes"
            value={stats.pending}
            icon={Clock}
          />
          <MetricCard
            title="Solicitar Compra"
            value={stats.purchase_required}
            icon={ShoppingCart}
            status="warning"
          />
          <MetricCard
            title="Concluídos"
            value={stats.completed}
            icon={CheckCircle}
            status="good"
          />
          <MetricCard
            title="Total de Itens"
            value={stats.total}
            icon={Package}
          />
          <MetricCard
            title="Itens Críticos"
            value={stats.critical}
            subtitle="Prazo < 3 dias"
            icon={AlertTriangle}
            status={stats.critical > 0 ? "critical" : "good"}
          />
        </div>
      )}

      {/* Filtros */}
      <ProductionFilters
        filters={filters}
        onFiltersChange={setFilters}
        warehouses={warehouses}
      />

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              Itens de Produção ({filteredItems.length})
            </span>
            {filters.itemStatus !== 'all' && (
              <span className="text-sm font-normal text-muted-foreground">
                Filtrando por situação
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <ProductionItemsTable
              items={filteredItems}
              onOrderClick={handleOrderClick}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
