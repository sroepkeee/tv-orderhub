import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OrderItem } from "@/components/AddOrderDialog";
import { calculateDaysUntilDeadline, getDeadlineStatus } from "@/lib/metrics";
import { cleanItemDescription } from "@/lib/utils";

interface CompactItemSLATableProps {
  items: OrderItem[];
}

export function CompactItemSLATable({ items }: CompactItemSLATableProps) {
  // Verificar se o item está concluído
  const isItemCompleted = (itemStatus: string | null | undefined) => {
    return ['completed', 'delivered', 'received', 'shipped'].includes(itemStatus || '');
  };

  const getStatusBadge = (item: OrderItem) => {
    // Se o item está concluído, mostrar badge de concluído
    if (isItemCompleted(item.item_status)) {
      return <Badge variant="secondary" className="bg-green-600 text-white">Concluído</Badge>;
    }
    
    // Calcular status baseado no prazo
    const daysUntil = calculateDaysUntilDeadline(item.deliveryDate);
    const status = getDeadlineStatus(daysUntil);
    
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

  const getPhaseLabel = (item: OrderItem) => {
    // Priorizar item_status sobre current_phase para consistência
    const effectivePhase = item.item_status || item.current_phase;
    
    const labels: Record<string, string> = {
      'pending': 'Pendente',
      'separating': 'Separação',
      'separated': 'Separado',
      'in_production': 'Produção',
      'in_process': 'Em Processo',
      'awaiting_production': 'Aguard. Produção',
      'produced': 'Produzido',
      'quality_check': 'Qualidade',
      'in_stock': 'Em Estoque',
      'purchase_required': 'Requer Compra',
      'purchase_requested': 'Compra Solicitada',
      'shipped': 'Expedido',
      'delivered': 'Entregue',
      'received': 'Recebido',
      'completed': 'Concluído'
    };
    return labels[effectivePhase || ''] || effectivePhase || 'N/A';
  };

  const getDaysDisplay = (item: OrderItem) => {
    // Se o item está concluído, mostrar "Entregue"
    if (isItemCompleted(item.item_status)) {
      return { text: 'Entregue', className: 'text-green-600 font-semibold' };
    }
    
    const daysUntil = calculateDaysUntilDeadline(item.deliveryDate);
    const status = getDeadlineStatus(daysUntil);
    
    if (daysUntil >= 0) {
      return { 
        text: `${daysUntil} dias`, 
        className: status === 'critical' ? 'text-destructive font-semibold' :
                   status === 'warning' ? 'text-yellow-600 font-semibold' :
                   'text-muted-foreground'
      };
    } else {
      return { 
        text: `${Math.abs(daysUntil)} dias (atraso)`, 
        className: 'text-destructive font-semibold' 
      };
    }
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
              const daysDisplay = getDaysDisplay(item);
              
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.itemCode}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {cleanItemDescription(item.itemDescription)}
                  </TableCell>
                  <TableCell>{getSourceBadge(item.item_source_type)}</TableCell>
                  <TableCell>{getStatusBadge(item)}</TableCell>
                  <TableCell>
                    <span className={daysDisplay.className}>
                      {daysDisplay.text}
                    </span>
                  </TableCell>
                  <TableCell>{getPhaseLabel(item)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
