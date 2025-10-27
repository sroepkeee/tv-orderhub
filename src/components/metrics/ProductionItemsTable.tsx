import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { ProductionItem } from "@/types/production";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProductionItemsTableProps {
  items: ProductionItem[];
  onOrderClick?: (orderId: string) => void;
}

type SortField = 'orderNumber' | 'itemCode' | 'deliveryDate' | 'requestedQuantity' | 'item_status';
type SortDirection = 'asc' | 'desc';

const getItemStatusBadge = (status: string) => {
  const variants: Record<string, { label: string; className: string }> = {
    'pending': { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    'in_stock': { label: 'Em Estoque', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    'awaiting_production': { label: 'Aguardando Produção', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    'purchase_required': { label: 'Solicitar Compra', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    'completed': { label: 'Concluído', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
  };
  
  const variant = variants[status] || { label: status, className: '' };
  return <Badge className={variant.className}>{variant.label}</Badge>;
};

export const ProductionItemsTable = ({ items, onOrderClick }: ProductionItemsTableProps) => {
  const [sortField, setSortField] = useState<SortField>('deliveryDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'orderNumber':
          comparison = a.orderNumber.localeCompare(b.orderNumber);
          break;
        case 'itemCode':
          comparison = a.itemCode.localeCompare(b.itemCode);
          break;
        case 'deliveryDate':
          comparison = new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
          break;
        case 'requestedQuantity':
          comparison = a.requestedQuantity - b.requestedQuantity;
          break;
        case 'item_status':
          comparison = a.item_status.localeCompare(b.item_status);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [items, sortField, sortDirection]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedItems, currentPage]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const today = new Date();

  const getDaysRemaining = (deliveryDate: string) => {
    const days = differenceInDays(new Date(deliveryDate), today);
    if (days < 0) return <span className="text-red-600 font-semibold">Atrasado {Math.abs(days)}d</span>;
    if (days === 0) return <span className="text-orange-600 font-semibold">Hoje</span>;
    if (days <= 3) return <span className="text-orange-600">{days} dias</span>;
    return <span className="text-muted-foreground">{days} dias</span>;
  };

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

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum item encontrado
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">
                <SortButton field="orderNumber">Pedido</SortButton>
              </TableHead>
              <TableHead className="w-[120px]">
                <SortButton field="itemCode">Código</SortButton>
              </TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-[60px]">Und</TableHead>
              <TableHead className="w-[100px] text-right">
                <SortButton field="requestedQuantity">Qtd Solic.</SortButton>
              </TableHead>
              <TableHead className="w-[100px] text-right">Qtd Rec.</TableHead>
              <TableHead className="w-[80px] text-right">Saldo</TableHead>
              <TableHead className="w-[180px]">
                <SortButton field="item_status">Situação</SortButton>
              </TableHead>
              <TableHead className="w-[120px]">
                <SortButton field="deliveryDate">Data Entrega</SortButton>
              </TableHead>
              <TableHead className="w-[100px]">Prazo</TableHead>
              <TableHead className="w-[120px]">Armazém</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((item) => {
              const balance = item.requestedQuantity - item.deliveredQuantity;
              const isCritical = differenceInDays(new Date(item.deliveryDate), today) <= 3 && 
                                 differenceInDays(new Date(item.deliveryDate), today) >= 0 &&
                                 item.item_status !== 'completed';
              
              return (
                <TableRow key={item.id} className={isCritical ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                  <TableCell>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => onOrderClick?.(item.orderId)}
                      className="p-0 h-auto font-mono"
                    >
                      {item.orderNumber}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.itemCode}</TableCell>
                  <TableCell className="max-w-[300px] truncate" title={item.itemDescription}>
                    {item.itemDescription}
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{item.requestedQuantity}</TableCell>
                  <TableCell className="text-right">{item.deliveredQuantity}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {balance > 0 ? balance : '-'}
                  </TableCell>
                  <TableCell>{getItemStatusBadge(item.item_status)}</TableCell>
                  <TableCell>
                    {format(new Date(item.deliveryDate), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>{getDaysRemaining(item.deliveryDate)}</TableCell>
                  <TableCell>{item.warehouse}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, sortedItems.length)} de {sortedItems.length} itens
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
