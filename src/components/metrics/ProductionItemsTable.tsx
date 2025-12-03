import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { ProductionItem } from "@/types/production";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProductionItemsTableProps {
  items: ProductionItem[];
  onOrderClick?: (orderId: string) => void;
}

type SortField = 'orderNumber' | 'itemCode' | 'deliveryDate' | 'requestedQuantity' | 'item_status' | 'createdAt' | 'daysInSystem' | 'productionOrderNumber' | 'productionReleasedAt';
type SortDirection = 'asc' | 'desc';

const getItemStatusBadge = (status: string) => {
  const variants: Record<string, { label: string; className: string }> = {
    'pending': { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    'in_stock': { label: 'Em Estoque', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    'awaiting_production': { label: 'Aguardando Produção', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    'purchase_required': { label: 'Solicitar Compra', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    'purchase_requested': { label: 'Solicitado Compra', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
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
  const today = new Date();

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
        case 'createdAt':
          const dateA = a.orderIssueDate ? new Date(a.orderIssueDate) : new Date(a.created_at);
          const dateB = b.orderIssueDate ? new Date(b.orderIssueDate) : new Date(b.created_at);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'productionReleasedAt':
          const releasedA = a.production_released_at ? new Date(a.production_released_at) : new Date(0);
          const releasedB = b.production_released_at ? new Date(b.production_released_at) : new Date(0);
          comparison = releasedA.getTime() - releasedB.getTime();
          break;
        case 'daysInSystem':
          const refDateA = a.orderIssueDate ? new Date(a.orderIssueDate) : new Date(a.created_at);
          const refDateB = b.orderIssueDate ? new Date(b.orderIssueDate) : new Date(b.created_at);
          const daysA = differenceInDays(today, refDateA);
          const daysB = differenceInDays(today, refDateB);
          comparison = daysA - daysB;
          break;
        case 'productionOrderNumber':
          const opA = a.production_order_number || '';
          const opB = b.production_order_number || '';
          comparison = opA.localeCompare(opB);
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
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[1600px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">
                <SortButton field="orderNumber">Pedido</SortButton>
              </TableHead>
              <TableHead className="w-[110px]">
                <SortButton field="itemCode">Código</SortButton>
              </TableHead>
              <TableHead className="min-w-[250px] w-[30%]">Descrição</TableHead>
              <TableHead className="w-[70px]">Und</TableHead>
              <TableHead className="w-[90px] text-right">
                <SortButton field="requestedQuantity">Qtd Solic.</SortButton>
              </TableHead>
              <TableHead className="w-[90px] text-right">Qtd Rec.</TableHead>
              <TableHead className="w-[80px] text-right">Saldo</TableHead>
              <TableHead className="w-[140px]">
                <SortButton field="item_status">Situação</SortButton>
              </TableHead>
              <TableHead className="w-[120px]">
                <SortButton field="createdAt">Data Pedido</SortButton>
              </TableHead>
              <TableHead className="w-[120px]">
                <SortButton field="productionReleasedAt">Data Liberação</SortButton>
              </TableHead>
              <TableHead className="w-[100px]">
                <SortButton field="daysInSystem">Dias Sistema</SortButton>
              </TableHead>
              <TableHead className="w-[120px]">
                <SortButton field="deliveryDate">Data Entrega</SortButton>
              </TableHead>
              <TableHead className="w-[100px]">
                <SortButton field="productionOrderNumber">Nº OP</SortButton>
              </TableHead>
              <TableHead className="w-[130px]">Data Est. Produção</TableHead>
              <TableHead className="w-[80px]">Prazo</TableHead>
              <TableHead className="w-[100px]">Compra OK?</TableHead>
              <TableHead className="w-[100px]">Armazém</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((item) => {
              const balance = item.requestedQuantity - item.deliveredQuantity;
              const isCritical = differenceInDays(new Date(item.deliveryDate), today) <= 3 && 
                                 differenceInDays(new Date(item.deliveryDate), today) >= 0 &&
                                 item.item_status !== 'completed';
              const orderDate = item.orderIssueDate ? new Date(item.orderIssueDate) : new Date(item.created_at);
              // Prioridade: phase_started_at do item (quando entrou em produção) > production_released_at do pedido > data do pedido
              const startDate = item.phase_started_at && item.item_status === 'awaiting_production'
                ? new Date(item.phase_started_at)
                : item.production_released_at 
                  ? new Date(item.production_released_at)
                  : orderDate;
              const daysInSystem = differenceInDays(today, startDate);
              
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
                  <TableCell className="max-w-[250px] truncate" title={item.itemDescription}>
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
                    <span className="text-sm">
                      {item.orderIssueDate 
                        ? format(new Date(item.orderIssueDate), 'dd/MM/yyyy', { locale: ptBR })
                        : format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ptBR })
                      }
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.production_released_at ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">
                          {format(new Date(item.production_released_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.production_released_at), 'HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs text-orange-600">
                        Não liberado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`font-semibold ${
                      daysInSystem > 30 ? 'text-red-600' : 
                      daysInSystem > 15 ? 'text-orange-600' : 
                      'text-muted-foreground'
                    }`}>
                      {daysInSystem} dias
                    </span>
                  </TableCell>
                  <TableCell>
                    {format(new Date(item.deliveryDate), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {item.production_order_number ? (
                      <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {item.production_order_number}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.production_estimated_date ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {format(new Date(item.production_estimated_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        {(() => {
                          const estimatedDate = new Date(item.production_estimated_date);
                          const deliveryDate = new Date(item.deliveryDate);
                          const diffDays = differenceInDays(deliveryDate, estimatedDate);
                          
                          if (diffDays < 0) {
                            return <span className="text-xs text-red-600 font-medium">Atrasará {Math.abs(diffDays)}d</span>;
                          } else if (diffDays === 0) {
                            return <span className="text-xs text-orange-600">Mesmo dia</span>;
                          } else if (diffDays <= 2) {
                            return <span className="text-xs text-yellow-600">{diffDays}d antes</span>;
                          } else {
                            return <span className="text-xs text-green-600">{diffDays}d antes</span>;
                          }
                        })()}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Não definida
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{getDaysRemaining(item.deliveryDate)}</TableCell>
                  <TableCell>
                    {item.item_status === 'purchase_required' && (
                      <div className="flex items-center gap-1.5">
                        {item.purchase_action_started ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Sim</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            <span className="text-xs text-orange-600 dark:text-orange-400">Não</span>
                          </>
                        )}
                      </div>
                    )}
                  </TableCell>
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
