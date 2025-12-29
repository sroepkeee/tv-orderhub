import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, RotateCcw, ArrowLeftRight } from 'lucide-react';
import type { TechnicianDispatch } from '@/types/technicians';

interface TechnicianItemsListProps {
  dispatches: TechnicianDispatch[];
  loading: boolean;
  onStartReturn: (dispatchId: string) => void;
  onStartTransfer: (dispatchId: string) => void;
}

export function TechnicianItemsList({ dispatches, loading, onStartReturn, onStartTransfer }: TechnicianItemsListProps) {
  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  }

  if (dispatches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum item pendente de retorno</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {dispatches.map((dispatch) => (
        <Card key={dispatch.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{dispatch.order?.order_number}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Recebido em {format(new Date(dispatch.dispatch_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <Badge variant="outline">{dispatch.items_pending} itens pendentes</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {dispatch.items?.slice(0, 3).map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.item_code} - {item.item_description}</span>
                  <span className="text-muted-foreground">{item.quantity_sent - item.quantity_returned} un</span>
                </div>
              ))}
              {dispatch.items && dispatch.items.length > 3 && (
                <p className="text-xs text-muted-foreground">+ {dispatch.items.length - 3} itens</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onStartReturn(dispatch.id)}>
                <RotateCcw className="h-4 w-4 mr-2" />Solicitar Retorno
              </Button>
              <Button size="sm" variant="outline" onClick={() => onStartTransfer(dispatch.id)}>
                <ArrowLeftRight className="h-4 w-4 mr-2" />Transferir
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
