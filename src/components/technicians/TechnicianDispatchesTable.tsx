import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, RefreshCw, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { CreateDispatchDialog } from './CreateDispatchDialog';
import { LinkExistingDispatchesDialog } from './LinkExistingDispatchesDialog';
import { DispatchItemsSheet } from './DispatchItemsSheet';
import type { TechnicianDispatch, DispatchStatus, dispatchStatusLabels, dispatchStatusColors } from '@/types/technicians';

interface TechnicianDispatchesTableProps {
  dispatches: TechnicianDispatch[];
  loading: boolean;
  onRefresh: () => void;
}

export function TechnicianDispatchesTable({ dispatches, loading, onRefresh }: TechnicianDispatchesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DispatchStatus | 'all'>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [expandedDispatch, setExpandedDispatch] = useState<string | null>(null);
  const [selectedDispatch, setSelectedDispatch] = useState<TechnicianDispatch | null>(null);

  const filteredDispatches = dispatches.filter(dispatch => {
    const matchesSearch = 
      dispatch.technician?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispatch.order?.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispatch.origin_warehouse?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || dispatch.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: DispatchStatus) => {
    const labels: Record<DispatchStatus, string> = {
      dispatched: 'Enviado',
      partial_return: 'Retorno Parcial',
      fully_returned: 'Retornado',
      overdue: 'Atrasado',
      cancelled: 'Cancelado',
    };

    const colors: Record<DispatchStatus, string> = {
      dispatched: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      partial_return: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      fully_returned: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      overdue: 'bg-red-500/10 text-red-500 border-red-500/20',
      cancelled: 'bg-muted text-muted-foreground border-muted',
    };

    return (
      <Badge variant="outline" className={colors[status]}>
        {labels[status]}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Remessas para Técnicos</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowLinkDialog(true)}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Vincular Existentes
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Remessa
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por técnico, NF ou armazém..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DispatchStatus | 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="dispatched">Enviado</SelectItem>
              <SelectItem value="partial_return">Retorno Parcial</SelectItem>
              <SelectItem value="fully_returned">Retornado</SelectItem>
              <SelectItem value="overdue">Atrasado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabela */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>NF/Pedido</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Armazém Origem</TableHead>
                <TableHead>Data Envio</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDispatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma remessa encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredDispatches.map((dispatch) => (
                  <TableRow key={dispatch.id}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setExpandedDispatch(
                          expandedDispatch === dispatch.id ? null : dispatch.id
                        )}
                      >
                        {expandedDispatch === dispatch.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {dispatch.order?.order_number || '-'}
                    </TableCell>
                    <TableCell>{dispatch.technician?.name || '-'}</TableCell>
                    <TableCell>
                      {dispatch.technician?.city && dispatch.technician?.state
                        ? `${dispatch.technician.city}/${dispatch.technician.state}`
                        : '-'}
                    </TableCell>
                    <TableCell>{dispatch.origin_warehouse}</TableCell>
                    <TableCell>
                      {format(new Date(dispatch.dispatch_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{dispatch.items_pending || 0}</span>
                      <span className="text-muted-foreground"> / {dispatch.items_count || 0}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(dispatch.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedDispatch(dispatch)}
                      >
                        Ver itens
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Dialogs */}
      <CreateDispatchDialog 
        open={showCreateDialog} 
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => {
          setShowCreateDialog(false);
          onRefresh();
        }}
      />

      <LinkExistingDispatchesDialog
        open={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        onSuccess={() => {
          setShowLinkDialog(false);
          onRefresh();
        }}
      />

      {selectedDispatch && (
        <DispatchItemsSheet
          dispatch={selectedDispatch}
          open={!!selectedDispatch}
          onClose={() => setSelectedDispatch(null)}
        />
      )}
    </Card>
  );
}
