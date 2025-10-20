import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OrderItem } from "@/components/AddOrderDialog";
import { calculateDaysUntilDeadline, getDeadlineStatus } from "@/lib/metrics";
import { cleanItemDescription } from "@/lib/utils";

interface CompactItemSLATableProps {
  items: OrderItem[];
}

export function CompactItemSLATable({ items }: CompactItemSLATableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'warning':
        return <Badge variant="default" className="bg-yellow-600">Atenção</Badge>;
      case 'good':
        return <Badge variant="secondary">No Prazo</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const getPhaseLabel = (phase: string | null) => {
    const labels: Record<string, string> = {
      'pending': 'Pendente',
      'separating': 'Separação',
      'separated': 'Separado',
      'in_production': 'Produção',
      'produced': 'Produzido',
      'shipped': 'Expedido',
      'delivered': 'Entregue'
    };
    return labels[phase || ''] || phase || 'N/A';
  };

  const getSourceBadge = (source: string | null) => {
    switch (source) {
      case 'in_stock':
        return <Badge variant="secondary" className="text-xs">Estoque</Badge>;
      case 'production':
        return <Badge variant="default" className="text-xs">Produção</Badge>;
      case 'out_of_stock':
        return <Badge variant="destructive" className="text-xs">Sem Estoque</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">N/A</Badge>;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Status SLA</TableHead>
            <TableHead>Dias até Prazo</TableHead>
            <TableHead>Fase Atual</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhum item encontrado
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const daysUntil = calculateDaysUntilDeadline(item.deliveryDate);
              const status = getDeadlineStatus(daysUntil);
              
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.itemCode}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {cleanItemDescription(item.itemDescription)}
                  </TableCell>
                  <TableCell>{getSourceBadge(item.item_source_type)}</TableCell>
                  <TableCell>{getStatusBadge(status)}</TableCell>
                  <TableCell>
                    <span className={
                      status === 'critical' ? 'text-destructive font-semibold' :
                      status === 'warning' ? 'text-yellow-600 font-semibold' :
                      'text-muted-foreground'
                    }>
                      {daysUntil >= 0 ? `${daysUntil} dias` : `${Math.abs(daysUntil)} dias (atraso)`}
                    </span>
                  </TableCell>
                  <TableCell>{getPhaseLabel(item.current_phase)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
