import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { TechnicianDispatch, itemReturnStatusLabels } from '@/types/technicians';

interface DispatchItemsSheetProps {
  dispatch: TechnicianDispatch;
  open: boolean;
  onClose: () => void;
}

export function DispatchItemsSheet({ dispatch, open, onClose }: DispatchItemsSheetProps) {
  const statusLabels: Record<string, string> = {
    pending: 'Pendente', partial: 'Parcial', returned: 'Retornado', lost: 'Perdido', consumed: 'Consumido',
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Itens da Remessa - {dispatch.order?.order_number}</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dispatch.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                  <TableCell className="text-sm">{item.item_description}</TableCell>
                  <TableCell>{item.quantity_returned}/{item.quantity_sent}</TableCell>
                  <TableCell><Badge variant="outline">{statusLabels[item.return_status]}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SheetContent>
    </Sheet>
  );
}
