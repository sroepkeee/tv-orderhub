import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Order } from "@/components/Dashboard";
import { Package } from "lucide-react";

interface ItemSourceMetricsProps {
  orders: Order[];
}

export const ItemSourceMetrics = ({ orders }: ItemSourceMetricsProps) => {
  const allItems = orders.flatMap(o => o.items || []);
  
  const byStatus = {
    inStock: allItems.filter(i => i.item_status === 'in_stock' || (!i.item_status && i.item_source_type === 'in_stock') || (!i.item_status && !i.item_source_type)).length,
    awaitingProduction: allItems.filter(i => i.item_status === 'awaiting_production' || (!i.item_status && i.item_source_type === 'production')).length,
    purchaseRequired: allItems.filter(i => i.item_status === 'purchase_required' || (!i.item_status && i.item_source_type === 'out_of_stock')).length,
    completed: allItems.filter(i => i.item_status === 'completed').length
  };
  
  const total = byStatus.inStock + byStatus.awaitingProduction + byStatus.purchaseRequired + byStatus.completed;
  
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
          📦 Situação dos Itens
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Disponível em Estoque */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">✅ Disponível em Estoque</span>
              <span className="text-sm font-bold text-green-600">
                {byStatus.inStock} ({Math.round((byStatus.inStock / total) * 100)}%)
              </span>
            </div>
            <Progress value={(byStatus.inStock / total) * 100} className="h-2" />
          </div>
          
          {/* Aguardando Produção */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">🏭 Aguardando Produção</span>
              <span className="text-sm font-bold text-blue-600">
                {byStatus.awaitingProduction} ({Math.round((byStatus.awaitingProduction / total) * 100)}%)
              </span>
            </div>
            <Progress value={(byStatus.awaitingProduction / total) * 100} className="h-2" />
          </div>
          
          {/* Solicitar Compra */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">🛒 Solicitar Compra</span>
              <span className="text-sm font-bold text-orange-600">
                {byStatus.purchaseRequired} ({Math.round((byStatus.purchaseRequired / total) * 100)}%)
              </span>
            </div>
            <Progress value={(byStatus.purchaseRequired / total) * 100} className="h-2" />
          </div>
          
          {/* Concluído */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">✓ Concluído</span>
              <span className="text-sm font-bold text-emerald-700">
                {byStatus.completed} ({Math.round((byStatus.completed / total) * 100)}%)
              </span>
            </div>
            <Progress value={(byStatus.completed / total) * 100} className="h-2" />
          </div>
          
          <div className="pt-2 border-t text-xs text-muted-foreground">
            Total: {total} itens cadastrados
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
