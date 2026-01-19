import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Search, Filter, Package, User, Calendar, 
  ArrowRight, Loader2, RotateCcw
} from 'lucide-react';
import { useReturnProcesses } from '@/hooks/useReturnProcesses';
import { OpenReturnProcessDialog } from './OpenReturnProcessDialog';
import { 
  ReturnProcess, 
  ReturnProcessStatus,
  STATUS_LABELS, 
  STATUS_COLORS, 
  MOTIVO_LABELS 
} from '@/types/returnProcess';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ReturnProcessesTab() {
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { processes, loading, fetchProcesses } = useReturnProcesses();

  const filteredProcesses = processes.filter(p => {
    // Status filter
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const techName = p.technician?.name?.toLowerCase() || '';
      return techName.includes(query);
    }
    
    return true;
  });

  const handleProcessCreated = (processId: string) => {
    navigate(`/return-process/${processId}`);
  };

  const activeProcesses = processes.filter(p => 
    !['finalizado', 'cancelado'].includes(p.status)
  ).length;

  const statusOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Todos os Status' },
    ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por técnico..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => fetchProcesses()}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Processo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-bold">{processes.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ativos</span>
              <span className="text-2xl font-bold text-blue-600">{activeProcesses}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Divergências</span>
              <span className="text-2xl font-bold text-amber-600">
                {processes.filter(p => p.status === 'divergencia').length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Finalizados</span>
              <span className="text-2xl font-bold text-emerald-600">
                {processes.filter(p => p.status === 'finalizado').length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && filteredProcesses.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium">Nenhum processo encontrado</p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Tente ajustar os filtros'
                : 'Crie um novo processo de devolução'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Processo
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Processes List */}
      {!loading && filteredProcesses.length > 0 && (
        <div className="space-y-3">
          {filteredProcesses.map((process) => (
            <Card 
              key={process.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/return-process/${process.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {process.technician?.name || 'Técnico'}
                      </p>
                      <Badge variant="secondary" className="shrink-0">
                        {MOTIVO_LABELS[process.motivo]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(process.created_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>
                      {process.technician?.specialty && (
                        <span>• {process.technician.specialty}</span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <Badge className={`shrink-0 ${STATUS_COLORS[process.status]}`}>
                    {STATUS_LABELS[process.status]}
                  </Badge>

                  {/* Arrow */}
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <OpenReturnProcessDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleProcessCreated}
      />
    </div>
  );
}
