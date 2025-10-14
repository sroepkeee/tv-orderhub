import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Order } from "@/components/Dashboard";
import { Package } from "lucide-react";

interface ItemSourceMetricsProps {
  orders: Order[];
}

export const ItemSourceMetrics = ({ orders }: ItemSourceMetricsProps) => {
  const allItems = orders.flatMap(o => o.items || []);
  
  const bySource = {
    inStock: allItems.filter(i => i.item_source_type === 'in_stock' || !i.item_source_type).length,
    production: allItems.filter(i => i.item_source_type === 'production').length,
    outOfStock: allItems.filter(i => i.item_source_type === 'out_of_stock').length
  };
  
  const total = bySource.inStock + bySource.production + bySource.outOfStock;
  
  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Origem dos Itens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhum item cadastrado ainda.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          📦 Origem dos Itens
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Estoque Disponível */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">✅ Disponível em Estoque</span>
              <span className="text-sm font-bold text-green-600">
                {bySource.inStock} ({Math.round((bySource.inStock / total) * 100)}%)
              </span>
            </div>
            <Progress value={(bySource.inStock / total) * 100} className="h-2" />
          </div>
          
          {/* Em Produção */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">🏭 Aguardando Produção</span>
              <span className="text-sm font-bold text-blue-600">
                {bySource.production} ({Math.round((bySource.production / total) * 100)}%)
              </span>
            </div>
            <Progress value={(bySource.production / total) * 100} className="h-2" />
          </div>
          
          {/* Sem Estoque */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">⚠️ Sem Controle / Fora de Estoque</span>
              <span className="text-sm font-bold text-red-600">
                {bySource.outOfStock} ({Math.round((bySource.outOfStock / total) * 100)}%)
              </span>
            </div>
            <Progress value={(bySource.outOfStock / total) * 100} className="h-2" />
          </div>
          
          <div className="pt-2 border-t text-xs text-muted-foreground">
            Total: {total} itens cadastrados
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
