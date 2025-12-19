import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  RefreshCw, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Play,
  Pause,
  Trash2,
  MessageSquare,
  TrendingUp,
  Shield
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QueueMessage {
  id: string;
  recipient_whatsapp: string;
  recipient_name: string | null;
  message_type: string;
  message_content: string;
  priority: number;
  status: string;
  scheduled_for: string;
  attempts: number;
  max_attempts: number;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface QueueStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}

const priorityLabels: Record<number, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  1: { label: "Crítico", variant: "destructive" },
  2: { label: "Alto", variant: "default" },
  3: { label: "Normal", variant: "secondary" },
};

const statusLabels: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "text-yellow-500" },
  processing: { label: "Enviando", icon: RefreshCw, color: "text-blue-500" },
  sent: { label: "Enviado", icon: CheckCircle, color: "text-green-500" },
  failed: { label: "Falhou", icon: XCircle, color: "text-red-500" },
  cancelled: { label: "Cancelado", icon: Pause, color: "text-muted-foreground" },
};

const typeLabels: Record<string, string> = {
  daily_report: "Relatório Diário",
  weekly_report: "Relatório Semanal",
  alert: "Alerta",
  delayed_order: "Pedido Atrasado",
  critical_sla: "SLA Crítico",
  large_order: "Grande Pedido",
  manual: "Manual",
  general: "Geral",
};

export function MessageQueueDashboard() {
  const [messages, setMessages] = useState<QueueMessage[]>([]);
  const [stats, setStats] = useState<QueueStats>({ pending: 0, processing: 0, sent: 0, failed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('message_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (messagesError) throw messagesError;
      setMessages(messagesData || []);

      // Calculate stats
      const pending = messagesData?.filter(m => m.status === 'pending').length || 0;
      const processing = messagesData?.filter(m => m.status === 'processing').length || 0;
      const sent = messagesData?.filter(m => m.status === 'sent').length || 0;
      const failed = messagesData?.filter(m => m.status === 'failed').length || 0;

      setStats({
        pending,
        processing,
        sent,
        failed,
        total: messagesData?.length || 0,
      });

    } catch (error) {
      console.error('Error fetching queue data:', error);
      toast.error('Erro ao carregar dados da fila');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-message-queue');
      
      if (error) throw error;

      toast.success(`Processado: ${data.sent} enviadas, ${data.failed} falharam`);
      fetchData();
    } catch (error: any) {
      console.error('Error processing queue:', error);
      toast.error('Erro ao processar fila');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('message_queue')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Mensagem cancelada');
      fetchData();
    } catch (error) {
      console.error('Error cancelling message:', error);
      toast.error('Erro ao cancelar mensagem');
    }
  };

  const handleRetryMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('message_queue')
        .update({ 
          status: 'pending',
          attempts: 0,
          error_message: null,
          scheduled_for: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Mensagem reagendada');
      fetchData();
    } catch (error) {
      console.error('Error retrying message:', error);
      toast.error('Erro ao reenviar mensagem');
    }
  };

  const handleClearSent = async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('message_queue')
        .delete()
        .eq('status', 'sent')
        .lt('sent_at', oneDayAgo);

      if (error) throw error;
      
      toast.success('Mensagens antigas removidas');
      fetchData();
    } catch (error) {
      console.error('Error clearing sent messages:', error);
      toast.error('Erro ao limpar mensagens');
    }
  };

  const filteredMessages = messages.filter(m => {
    if (activeTab === "all") return true;
    return m.status === activeTab;
  });

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <RefreshCw className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.processing}</p>
                <p className="text-xs text-muted-foreground">Processando</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sent}</p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">Falharam</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">3-5s</p>
                <p className="text-xs text-muted-foreground">Delay/msg</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Limit Info */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">
                <strong>Proteção anti-bloqueio:</strong> Máximo 15 msg/min, 200 msg/hora, delay de 3-5 seg entre mensagens
              </span>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button 
                size="sm"
                onClick={handleProcessQueue}
                disabled={processing || stats.pending === 0}
              >
                <Play className={`h-4 w-4 mr-1 ${processing ? 'animate-pulse' : ''}`} />
                Processar Fila
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Fila de Mensagens
              </CardTitle>
              <CardDescription>
                Mensagens WhatsApp aguardando envio ou já processadas
              </CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClearSent}
              className="text-muted-foreground"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar Antigas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending" className="gap-1">
                <Clock className="h-3 w-3" />
                Pendentes ({stats.pending})
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Enviados ({stats.sent})
              </TabsTrigger>
              <TabsTrigger value="failed" className="gap-1">
                <XCircle className="h-3 w-3" />
                Falhas ({stats.failed})
              </TabsTrigger>
              <TabsTrigger value="all">
                Todos ({stats.total})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Destinatário</TableHead>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead className="w-[80px]">Prioridade</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[120px]">Agendado</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMessages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma mensagem {activeTab !== 'all' ? `com status "${statusLabels[activeTab]?.label}"` : ''}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMessages.map((message) => {
                      const statusInfo = statusLabels[message.status] || statusLabels.pending;
                      const StatusIcon = statusInfo.icon;
                      const priorityInfo = priorityLabels[message.priority] || priorityLabels[3];

                      return (
                        <TableRow key={message.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {message.recipient_name || 'Desconhecido'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatPhone(message.recipient_whatsapp)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {typeLabels[message.message_type] || message.message_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={priorityInfo.variant} className="text-xs">
                              {priorityInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground line-clamp-2 max-w-[300px]">
                              {message.message_content.substring(0, 100)}...
                            </p>
                            {message.error_message && (
                              <p className="text-xs text-red-500 mt-1">
                                ⚠️ {message.error_message}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                              <span className="text-xs">{statusInfo.label}</span>
                            </div>
                            {message.attempts > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ({message.attempts}/{message.max_attempts})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              {message.sent_at ? (
                                <span className="text-green-600">
                                  {format(new Date(message.sent_at), "dd/MM HH:mm")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {formatDistanceToNow(new Date(message.scheduled_for), { 
                                    addSuffix: true,
                                    locale: ptBR 
                                  })}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {message.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleCancelMessage(message.id)}
                                  title="Cancelar"
                                >
                                  <Pause className="h-3 w-3" />
                                </Button>
                              )}
                              {message.status === 'failed' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleRetryMessage(message.id)}
                                  title="Tentar novamente"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
