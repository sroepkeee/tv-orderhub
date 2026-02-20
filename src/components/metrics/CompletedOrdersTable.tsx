import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ExternalLink, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Order } from "@/components/Dashboard";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CompletedOrdersTableProps {
  orders: Order[];
  onOrderClick?: (order: Order) => void;
}

type SortField = 'orderNumber' | 'client' | 'completedDate' | 'totalTime';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 20;

export const CompletedOrdersTable = ({ orders, onOrderClick }: CompletedOrdersTableProps) => {
  const [sortField, setSortField] = useState<SortField>('completedDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(0);
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'orderNumber':
          comparison = a.orderNumber.localeCompare(b.orderNumber);
          break;
        case 'client':
          comparison = a.client.localeCompare(b.client);
          break;
        case 'completedDate':
          comparison = new Date(a.deliveryDeadline).getTime() - new Date(b.deliveryDeadline).getTime();
          break;
        case 'totalTime': {
          const timeA = differenceInDays(
            parseISO(a.deliveryDeadline),
            a.issueDate ? parseISO(a.issueDate) : parseISO(a.createdDate)
          );
          const timeB = differenceInDays(
            parseISO(b.deliveryDeadline),
            b.issueDate ? parseISO(b.issueDate) : parseISO(b.createdDate)
          );
          comparison = timeA - timeB;
          break;
        }
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [orders, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedOrders.length / PAGE_SIZE);
  const paginatedOrders = sortedOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-8 font-semibold"
    >
      {children}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum pedido concluído encontrado
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">
                <SortButton field="orderNumber">Nº Pedido</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="client">Cliente</SortButton>
              </TableHead>
              <TableHead className="w-[140px]">
                <SortButton field="completedDate">Conclusão</SortButton>
              </TableHead>
              <TableHead className="w-[120px]">
                <SortButton field="totalTime">Tempo Total</SortButton>
              </TableHead>
              <TableHead className="w-[140px]">Status Prazo</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrders.map((order) => {
              const startDate = order.issueDate ? parseISO(order.issueDate) : parseISO(order.createdDate);
              const endDate = parseISO(order.deliveryDeadline);
              const totalDays = differenceInDays(endDate, startDate);
              const isOnTime = totalDays <= 10;
              
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-medium">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[250px] truncate" title={order.client}>
                      {order.client}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{totalDays} dias</span>
                  </TableCell>
                  <TableCell>
                    {isOnTime ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        No prazo
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Atrasou
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOrderClick?.(order)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {/* Paginação */}
      <div className="flex items-center justify-between px-2 text-sm text-muted-foreground">
        <span>{sortedOrders.length} pedido(s) concluído(s)</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Página {page + 1} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};