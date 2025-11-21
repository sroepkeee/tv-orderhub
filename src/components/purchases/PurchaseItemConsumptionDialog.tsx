import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ItemConsumptionMetrics } from "@/types/purchases";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface PurchaseItemConsumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCode: string;
  itemDescription: string;
}

export const PurchaseItemConsumptionDialog = ({
  open,
  onOpenChange,
  itemCode,
  itemDescription,
}: PurchaseItemConsumptionDialogProps) => {
  const [metrics, setMetrics] = useState<ItemConsumptionMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && itemCode) {
      loadMetrics();
    }
  }, [open, itemCode]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('item_consumption_metrics')
        .select('*')
        .eq('item_code', itemCode)
        .maybeSingle();

      if (error) throw error;
      setMetrics(data);
    } catch (error) {
      console.error('Error loading consumption metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const quarterProjection = metrics
    ? Math.round((metrics.average_daily_consumption || 0) * 120) // ~4 meses = 120 dias
    : 0;

  const maxConsumption = metrics
    ? Math.max(
        metrics.consumption_30_days || 0,
        metrics.consumption_60_days || 0,
        metrics.consumption_90_days || 0
      )
    : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>📊 Análise de Consumo</DialogTitle>
          <DialogDescription>
            Item: {itemCode} - {itemDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : !metrics ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma métrica de consumo disponível
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Consumo nos últimos 30 dias:</span>
                    <span className="font-medium">{metrics.consumption_30_days || 0} unid.</span>
                  </div>
                  <Progress
                    value={((metrics.consumption_30_days || 0) / maxConsumption) * 100}
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Consumo nos últimos 60 dias:</span>
                    <span className="font-medium">{metrics.consumption_60_days || 0} unid.</span>
                  </div>
                  <Progress
                    value={((metrics.consumption_60_days || 0) / maxConsumption) * 100}
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Consumo nos últimos 90 dias:</span>
                    <span className="font-medium">{metrics.consumption_90_days || 0} unid.</span>
                  </div>
                  <Progress
                    value={((metrics.consumption_90_days || 0) / maxConsumption) * 100}
                    className="h-2"
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Média diária:</span>
                  <span>{(metrics.average_daily_consumption || 0).toFixed(2)} unid/dia</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Projeção próximo quadrimestre:</span>
                  <span className="text-primary font-semibold">~{quarterProjection} unid.</span>
                </div>
              </div>

              {metrics.average_daily_consumption && metrics.average_daily_consumption > 0 && (
                <div className="bg-muted rounded-lg p-4 text-sm">
                  <div className="font-medium mb-1">💡 Análise:</div>
                  <div className="text-muted-foreground">
                    {metrics.average_daily_consumption > 1
                      ? `Alto consumo (${metrics.average_daily_consumption.toFixed(2)} unid/dia). Recomenda-se manter estoque de segurança.`
                      : metrics.average_daily_consumption > 0.5
                      ? `Consumo moderado. Monitorar regularmente.`
                      : `Consumo baixo. Item pode ter uso eventual.`}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
