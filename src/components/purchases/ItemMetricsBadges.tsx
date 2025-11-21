import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { TrendingDown, ShoppingCart, Edit } from "lucide-react";
import { ItemPurchaseHistory, ItemConsumptionMetrics } from "@/types/purchases";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ItemMetricsBadgesProps {
  purchaseHistory?: ItemPurchaseHistory[];
  consumptionMetrics?: ItemConsumptionMetrics;
  onEdit?: () => void;
  editable?: boolean;
}

export function ItemMetricsBadges({ purchaseHistory, consumptionMetrics, onEdit, editable = false }: ItemMetricsBadgesProps) {
  // Pegar as últimas 3 compras
  const lastThreePurchases = purchaseHistory?.slice(0, 3) || [];

  // Calcular consumo quadrimestral (120 dias ≈ 90 dias × 1.33)
  const quarterlyConsumption = consumptionMetrics?.consumption_90_days 
    ? Math.round(consumptionMetrics.consumption_90_days * 1.33)
    : null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-4">
        {/* Últimas Compras */}
      <div className="flex items-center gap-2 min-w-[140px]">
        {lastThreePurchases.length > 0 ? (
          <HoverCard>
            <HoverCardTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                <div className="flex gap-1">
                  {lastThreePurchases.map((purchase, index) => (
                    <Badge
                      key={purchase.id}
                      variant="secondary"
                      className="text-xs font-mono px-1.5 py-0"
                    >
                      {purchase.quantity}
                    </Badge>
                  ))}
                </div>
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Histórico de Compras
                </h4>
                <div className="space-y-1">
                  {lastThreePurchases.map((purchase) => (
                    <div key={purchase.id} className="text-xs border-l-2 border-primary/30 pl-2 py-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{purchase.quantity} unidades</span>
                        <span className="text-muted-foreground">
                          {format(new Date(purchase.purchase_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      {purchase.supplier && (
                        <div className="text-muted-foreground">
                          Fornecedor: {purchase.supplier}
                        </div>
                      )}
                      {purchase.unit_price && (
                        <div className="text-muted-foreground">
                          Preço: R$ {purchase.unit_price.toFixed(2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        ) : (
          <span className="text-xs text-muted-foreground">Sem histórico</span>
        )}
      </div>

      {/* Consumo Quadrimestral */}
      <div className="flex items-center gap-2 min-w-[100px]">
        {quarterlyConsumption !== null ? (
          <HoverCard>
            <HoverCardTrigger asChild>
              <div className="flex items-center gap-1.5 cursor-help">
                <TrendingDown className="h-3 w-3 text-orange-500" />
                <span className="text-sm font-medium">{quarterlyConsumption} un.</span>
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-64">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Métricas de Consumo
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">30 dias:</span>
                    <span className="font-medium">{consumptionMetrics?.consumption_30_days || 0} un.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">60 dias:</span>
                    <span className="font-medium">{consumptionMetrics?.consumption_60_days || 0} un.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">90 dias:</span>
                    <span className="font-medium">{consumptionMetrics?.consumption_90_days || 0} un.</span>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-semibold">
                    <span>120 dias (estimado):</span>
                    <span>{quarterlyConsumption} un.</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Média diária:</span>
                    <span>{consumptionMetrics?.average_daily_consumption?.toFixed(1) || 0} un./dia</span>
                  </div>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        ) : (
          <span className="text-xs text-muted-foreground">Sem dados</span>
        )}
      </div>
      </div>

      {/* Botão de Edição */}
      {editable && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-7 w-7 p-0"
          title="Editar métricas"
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
