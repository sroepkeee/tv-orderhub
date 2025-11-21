import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Package, Clock, CheckCircle, DollarSign } from "lucide-react";
import { PurchaseMetrics } from "@/types/purchases";

interface PurchaseMetricsCardsProps {
  metrics: PurchaseMetrics;
}

export const PurchaseMetricsCards = ({ metrics }: PurchaseMetricsCardsProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Solicitações Ativas</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.total_active_requests}</div>
          <p className="text-xs text-muted-foreground">
            Em rascunho, pendentes ou aprovadas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Aguardando Solicitação</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.items_awaiting_request}</div>
          <p className="text-xs text-muted-foreground">
            Itens marcados para compra
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendentes de Aprovação</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.pending_approvals}</div>
          <p className="text-xs text-muted-foreground">
            Aguardando revisão da direção
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Aprovadas Este Mês</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.approved_this_month}</div>
          <p className="text-xs text-muted-foreground">
            Liberadas para compra
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Valor Total Estimado</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(metrics.total_estimated_value)}
          </div>
          <p className="text-xs text-muted-foreground">
            Soma de todas as solicitações
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
