import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, History, MessageSquare, Mail, CheckCircle2, Clock, XCircle, Eye, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NotificationLog {
  id: string;
  order_id: string | null;
  channel: string;
  recipient: string;
  subject: string | null;
  message_content: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface Props {
  logs: NotificationLog[];
  onRefresh: (limit?: number) => Promise<void>;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; className: string }> = {
  pending: { label: 'Pendente', icon: Clock, className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  generated: { label: 'Gerada', icon: Clock, className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  sent: { label: 'Enviado', icon: CheckCircle2, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  delivered: { label: 'Entregue', icon: CheckCircle2, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  read: { label: 'Lido', icon: CheckCircle2, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  failed: { label: 'Falhou', icon: XCircle, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export function AIAgentLogsTab({ logs, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [resending, setResending] = useState(false);
  const { toast } = useToast();

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const handleResendNotification = async () => {
    if (!selectedLog) return;

    try {
      setResending(true);

      // Chamar edge function para reenviar a notificação
      const { data, error } = await supabase.functions.invoke('ai-agent-notify', {
        body: {
          action: 'resend',
          notificationId: selectedLog.id,
        }
      });

      if (error) throw error;

      toast({
        title: "Notificação reenviada",
        description: "A notificação foi enviada novamente com sucesso",
      });

      // Atualizar lista
      await onRefresh();
      setSelectedLog(null);

    } catch (error) {
      console.error('Error resending notification:', error);
      toast({
        title: "Erro ao reenviar",
        description: error instanceof Error ? error.message : "Não foi possível reenviar a notificação",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const maskRecipient = (recipient: string, channel: string) => {
    if (channel === 'email') {
      const [local, domain] = recipient.split('@');
      if (local.length > 3) {
        return `${local.slice(0, 3)}***@${domain}`;
      }
      return recipient;
    }
    // WhatsApp - mask phone
    const cleaned = recipient.replace(/\D/g, '');
    if (cleaned.length > 6) {
      return `${cleaned.slice(0, 4)}***${cleaned.slice(-2)}`;
    }
    return recipient;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Histórico de Notificações</h3>
          <p className="text-sm text-muted-foreground">
            Últimas {logs.length} notificações enviadas
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{logs.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Enviados</div>
          <div className="text-2xl font-bold text-blue-600">
            {logs.filter(l => l.status === 'sent').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Entregues</div>
          <div className="text-2xl font-bold text-green-600">
            {logs.filter(l => l.status === 'delivered' || l.status === 'read').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Pendentes</div>
          <div className="text-2xl font-bold text-yellow-600">
            {logs.filter(l => l.status === 'pending').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Falhas</div>
          <div className="text-2xl font-bold text-red-600">
            {logs.filter(l => l.status === 'failed').length}
          </div>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(log => {
              const statusConfig = getStatusConfig(log.status);
              const StatusIcon = statusConfig.icon;
              
              return (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="text-sm">{formatDate(log.created_at)}</div>
                    {log.order_id && (
                      <div className="text-xs text-muted-foreground">Pedido associado</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={log.channel === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                      {log.channel === 'whatsapp' 
                        ? <MessageSquare className="h-3 w-3 mr-1" /> 
                        : <Mail className="h-3 w-3 mr-1" />
                      }
                      {log.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {maskRecipient(log.recipient, log.channel)}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig.className}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                    {log.error_message && (
                      <div className="text-xs text-red-600 mt-1 max-w-[200px] truncate">
                        {log.error_message}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(log.sent_at)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {logs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma notificação enviada ainda</p>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Notificação</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Canal</div>
                  <div className="font-medium">{selectedLog.channel}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <Badge className={getStatusConfig(selectedLog.status).className}>
                    {getStatusConfig(selectedLog.status).label}
                  </Badge>
                </div>
                <div>
                  <div className="text-muted-foreground">Destinatário</div>
                  <div className="font-medium font-mono">{selectedLog.recipient}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Criado em</div>
                  <div className="font-medium">{formatDate(selectedLog.created_at)}</div>
                </div>
              </div>

              {selectedLog.subject && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Assunto</div>
                  <div className="p-2 bg-muted rounded font-medium">{selectedLog.subject}</div>
                </div>
              )}

              <div>
                <div className="text-sm text-muted-foreground mb-1">Mensagem</div>
                <div className={`p-3 rounded whitespace-pre-wrap text-sm ${
                  selectedLog.channel === 'whatsapp' 
                    ? 'bg-green-50 dark:bg-green-950/30' 
                    : 'bg-gray-50 dark:bg-gray-900'
                }`}>
                  {selectedLog.message_content}
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Erro</div>
                  <div className="p-2 bg-red-50 dark:bg-red-950/30 text-red-600 rounded text-sm">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              {/* Botão de reenviar para pendentes ou falhas */}
              {(selectedLog.status === 'pending' || selectedLog.status === 'failed') && (
                <DialogFooter>
                  <Button 
                    onClick={handleResendNotification}
                    disabled={resending}
                    className="w-full"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Reenviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Reenviar Notificação
                      </>
                    )}
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
