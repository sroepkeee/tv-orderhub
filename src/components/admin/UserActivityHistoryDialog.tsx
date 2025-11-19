import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, Database, LogIn, LogOut, UserCheck, UserX, Edit, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react";

interface UserActivityHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

interface ActivityLog {
  id: string;
  action_type: string;
  table_name: string | null;
  description: string;
  metadata: any;
  created_at: string;
}

export const UserActivityHistoryDialog = ({ 
  open, 
  onOpenChange, 
  userId, 
  userName 
}: UserActivityHistoryDialogProps) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    if (open && userId) {
      loadActivities();
    }
  }, [open, userId, actionFilter, tableFilter, page]);

  const loadActivities = async () => {
    setLoading(true);
    
    let query = supabase
      .from('user_activity_log')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    // Aplicar filtros
    if (actionFilter !== 'all') {
      query = query.eq('action_type', actionFilter);
    }
    if (tableFilter !== 'all') {
      query = query.eq('table_name', tableFilter);
    }

    // Aplicar paginação
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      setActivities(data);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const resetFilters = () => {
    setActionFilter('all');
    setTableFilter('all');
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'login': return <LogIn className="h-4 w-4" />;
      case 'logout': return <LogOut className="h-4 w-4" />;
      case 'insert': return <Plus className="h-4 w-4" />;
      case 'update': return <Edit className="h-4 w-4" />;
      case 'delete': return <Trash2 className="h-4 w-4" />;
      case 'approve': return <UserCheck className="h-4 w-4" />;
      case 'reject': return <UserX className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'login': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'logout': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      case 'insert': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'update': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'delete': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'approve': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'reject': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'login': 'Login',
      'logout': 'Logout',
      'insert': 'Criação',
      'update': 'Atualização',
      'delete': 'Exclusão',
      'approve': 'Aprovação',
      'reject': 'Rejeição',
    };
    return labels[actionType] || actionType;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Histórico de Atividades - {userName}
          </DialogTitle>
        </DialogHeader>

        {/* Filtros */}
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={actionFilter} onValueChange={(value) => { setActionFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              <SelectItem value="insert">Criações</SelectItem>
              <SelectItem value="update">Atualizações</SelectItem>
              <SelectItem value="delete">Exclusões</SelectItem>
              <SelectItem value="login">Logins</SelectItem>
              <SelectItem value="logout">Logouts</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={tableFilter} onValueChange={(value) => { setTableFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tabela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tabelas</SelectItem>
              <SelectItem value="orders">Pedidos</SelectItem>
              <SelectItem value="order_items">Itens</SelectItem>
              <SelectItem value="order_comments">Comentários</SelectItem>
              <SelectItem value="order_attachments">Anexos</SelectItem>
              <SelectItem value="user_roles">Roles</SelectItem>
            </SelectContent>
          </Select>

          {(actionFilter !== 'all' || tableFilter !== 'all') && (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Limpar Filtros
            </Button>
          )}

          <div className="ml-auto text-sm text-muted-foreground">
            {totalCount} registro{totalCount !== 1 ? 's' : ''}
          </div>
        </div>
        
        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando histórico...
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma atividade registrada para este usuário com os filtros selecionados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Data/Hora</TableHead>
                  <TableHead className="w-32">Ação</TableHead>
                  <TableHead className="w-32">Tabela</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getActionColor(activity.action_type)}>
                        <span className="flex items-center gap-1">
                          {getActionIcon(activity.action_type)}
                          {getActionLabel(activity.action_type)}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {activity.table_name ? (
                        <Badge variant="secondary" className="text-xs">
                          {activity.table_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="space-y-1">
                        <p className="font-medium">{activity.description}</p>
                        
                        {/* Mostrar detalhes de mudança de status */}
                        {activity.metadata?.status_changed && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>Status:</span>
                            <Badge variant="outline" className="text-xs">
                              {activity.metadata.old_status}
                            </Badge>
                            <span>→</span>
                            <Badge variant="outline" className="text-xs">
                              {activity.metadata.new_status}
                            </Badge>
                          </div>
                        )}
                        
                        {/* Mostrar mudança de fase */}
                        {activity.metadata?.old_phase && activity.metadata?.new_phase && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>Fase:</span>
                            <Badge variant="outline" className="text-xs">
                              {activity.metadata.old_phase}
                            </Badge>
                            <span>→</span>
                            <Badge variant="outline" className="text-xs">
                              {activity.metadata.new_phase}
                            </Badge>
                          </div>
                        )}
                        
                        {/* Mostrar dono do pedido se diferente */}
                        {activity.metadata?.order_owner_name && (
                          <p className="text-xs text-muted-foreground">
                            Pedido de: {activity.metadata.order_owner_name}
                          </p>
                        )}

                        {/* Preview de comentário */}
                        {activity.metadata?.comment_preview && (
                          <p className="text-xs text-muted-foreground italic">
                            "{activity.metadata.comment_preview}..."
                          </p>
                        )}

                        {/* Info de arquivo */}
                        {activity.metadata?.file_name && (
                          <p className="text-xs text-muted-foreground">
                            Arquivo: {activity.metadata.file_name}
                            {activity.metadata?.file_size && (
                              <span className="ml-1">
                                ({(activity.metadata.file_size / 1024).toFixed(1)} KB)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Próxima
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
