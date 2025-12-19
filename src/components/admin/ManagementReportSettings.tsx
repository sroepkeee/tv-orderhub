import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart3, 
  Plus, 
  Trash2, 
  Send, 
  Clock, 
  Users, 
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  FileText,
  Image,
  MessageSquare,
  HelpCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Recipient {
  id: string;
  user_id: string;
  whatsapp: string;
  report_types: string[];
  is_active: boolean;
  preferred_time: string;
  last_report_sent_at: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface ReportLog {
  id: string;
  report_type: string;
  recipient_whatsapp: string;
  chart_sent: boolean;
  sent_at: string;
  status: string;
  metrics_snapshot: any;
}

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
}

export function ManagementReportSettings() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [reportLogs, setReportLogs] = useState<ReportLog[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [preferredTime, setPreferredTime] = useState('08:00');
  const [reportTypes, setReportTypes] = useState<string[]>(['daily']);
  const [includeChart, setIncludeChart] = useState(true);

  // Test send state
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load recipients with profile info
      const { data: recipientsData, error: recipientsError } = await supabase
        .from('management_report_recipients')
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (recipientsError) throw recipientsError;
      setRecipients(recipientsData || []);

      // Load recent report logs
      const { data: logsData, error: logsError } = await supabase
        .from('management_report_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20);

      if (logsError) throw logsError;
      setReportLogs(logsData || []);

      // Load admin users for adding recipients
      const { data: adminData, error: adminError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (!adminError && adminData) {
        const userIds = adminData.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        setAdminUsers(profiles || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function addRecipient() {
    if (!selectedUserId || !whatsapp) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const { error } = await supabase
        .from('management_report_recipients')
        .insert({
          user_id: selectedUserId,
          whatsapp: whatsapp.replace(/\D/g, ''),
          preferred_time: preferredTime,
          report_types: reportTypes,
          is_active: true,
        });

      if (error) throw error;

      toast.success('Destinatário adicionado com sucesso');
      setAddDialogOpen(false);
      setSelectedUserId('');
      setWhatsapp('');
      setPreferredTime('08:00');
      setReportTypes(['daily']);
      loadData();
    } catch (error) {
      console.error('Error adding recipient:', error);
      toast.error('Erro ao adicionar destinatário');
    }
  }

  async function toggleRecipient(id: string, isActive: boolean) {
    try {
      const { error } = await supabase
        .from('management_report_recipients')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      toast.success(isActive ? 'Destinatário desativado' : 'Destinatário ativado');
      loadData();
    } catch (error) {
      console.error('Error toggling recipient:', error);
      toast.error('Erro ao atualizar destinatário');
    }
  }

  async function deleteRecipient(id: string) {
    if (!confirm('Remover este destinatário?')) return;

    try {
      const { error } = await supabase
        .from('management_report_recipients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Destinatário removido');
      loadData();
    } catch (error) {
      console.error('Error deleting recipient:', error);
      toast.error('Erro ao remover destinatário');
    }
  }

  async function sendReportNow() {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-management-report', {
        body: { includeChart },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Relatório enviado para ${data.sentCount} destinatários`);
        loadData();
      } else {
        toast.error(data.error || 'Erro ao enviar relatório');
      }
    } catch (error) {
      console.error('Error sending report:', error);
      toast.error('Erro ao enviar relatório');
    } finally {
      setSending(false);
    }
  }

  async function sendTestReport() {
    if (!testPhone) {
      toast.error('Informe o número de WhatsApp para teste');
      return;
    }

    setTestSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-management-report', {
        body: { 
          testMode: true, 
          testPhone: testPhone.replace(/\D/g, ''),
          includeChart 
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Relatório de teste enviado');
      } else {
        toast.error(data.error || 'Erro ao enviar teste');
      }
    } catch (error) {
      console.error('Error sending test:', error);
      toast.error('Erro ao enviar teste');
    } finally {
      setTestSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeRecipients = recipients.filter(r => r.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Destinatários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRecipients}</div>
            <p className="text-xs text-muted-foreground">de {recipients.length} cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Relatórios Enviados</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportLogs.length}</div>
            <p className="text-xs text-muted-foreground">últimos 20 registros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Gráfico</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportLogs.filter(l => l.chart_sent).length}
            </div>
            <p className="text-xs text-muted-foreground">relatórios com imagem</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horário Padrão</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">08:00</div>
            <p className="text-xs text-muted-foreground">segunda a sexta</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Ações do Relatório
          </CardTitle>
          <CardDescription>
            Envie relatórios manualmente ou faça testes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeChart"
                checked={includeChart}
                onCheckedChange={(checked) => setIncludeChart(checked === true)}
              />
              <Label htmlFor="includeChart">Incluir gráfico (IA)</Label>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={sendReportNow} 
              disabled={sending || activeRecipients === 0}
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar Agora para Todos ({activeRecipients})
            </Button>

            <div className="flex gap-2">
              <Input
                placeholder="WhatsApp para teste (ex: 5511999999999)"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-64"
              />
              <Button 
                variant="outline" 
                onClick={sendTestReport}
                disabled={testSending || !testPhone}
              >
                {testSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Teste
              </Button>
            </div>

            <Button variant="ghost" onClick={loadData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manager Commands Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comandos via WhatsApp
          </CardTitle>
          <CardDescription>
            Gestores cadastrados podem consultar informações enviando mensagens para o WhatsApp conectado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-xl">📦</span>
                <div>
                  <p className="font-medium">Status de Pedido</p>
                  <p className="text-sm text-muted-foreground">"status 12345" ou "#12345"</p>
                  <p className="text-xs text-muted-foreground mt-1">Retorna detalhes completos do pedido</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-xl">📊</span>
                <div>
                  <p className="font-medium">Resumo do Dia</p>
                  <p className="text-sm text-muted-foreground">"resumo" ou "dashboard" ou "hoje"</p>
                  <p className="text-xs text-muted-foreground mt-1">Visão geral de todos os pedidos ativos</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-medium">Pedidos Atrasados</p>
                  <p className="text-sm text-muted-foreground">"atrasados" ou "atraso"</p>
                  <p className="text-xs text-muted-foreground mt-1">Lista pedidos fora do prazo de entrega</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-xl">🔧</span>
                <div>
                  <p className="font-medium">Pedidos por Fase</p>
                  <p className="text-sm text-muted-foreground">"pedidos em produção", "expedição", "faturamento"</p>
                  <p className="text-xs text-muted-foreground mt-1">Filtra pedidos por fase específica</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-xl">💰</span>
                <div>
                  <p className="font-medium">Maiores Pedidos</p>
                  <p className="text-sm text-muted-foreground">"top pedidos" ou "maiores"</p>
                  <p className="text-xs text-muted-foreground mt-1">Top 5 pedidos por valor</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-xl">👤</span>
                <div>
                  <p className="font-medium">Buscar Cliente</p>
                  <p className="text-sm text-muted-foreground">"cliente NOME"</p>
                  <p className="text-xs text-muted-foreground mt-1">Busca pedidos por nome do cliente</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 rounded-lg border border-dashed">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HelpCircle className="h-4 w-4" />
              <span>Gestores podem enviar "ajuda" ou "comandos" para ver todos os comandos disponíveis</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipients List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Destinatários do Relatório
            </CardTitle>
            <CardDescription>
              Gestores que receberão o relatório diário no WhatsApp
            </CardDescription>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Destinatário</DialogTitle>
                <DialogDescription>
                  Selecione um administrador para receber relatórios gerenciais
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Administrador</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {adminUsers.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    placeholder="5511999999999"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário Preferido</Label>
                  <Input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipos de Relatório</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="daily"
                        checked={reportTypes.includes('daily')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setReportTypes([...reportTypes, 'daily']);
                          } else {
                            setReportTypes(reportTypes.filter(t => t !== 'daily'));
                          }
                        }}
                      />
                      <Label htmlFor="daily">Diário</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="weekly"
                        checked={reportTypes.includes('weekly')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setReportTypes([...reportTypes, 'weekly']);
                          } else {
                            setReportTypes(reportTypes.filter(t => t !== 'weekly'));
                          }
                        }}
                      />
                      <Label htmlFor="weekly">Semanal</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="alerts"
                        checked={reportTypes.includes('alerts')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setReportTypes([...reportTypes, 'alerts']);
                          } else {
                            setReportTypes(reportTypes.filter(t => t !== 'alerts'));
                          }
                        }}
                      />
                      <Label htmlFor="alerts">Alertas</Label>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={addRecipient}>Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum destinatário cadastrado</p>
              <p className="text-sm">Adicione administradores para receber relatórios</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Tipos</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Último Envio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map(recipient => (
                  <TableRow key={recipient.id}>
                    <TableCell className="font-medium">
                      {recipient.profiles?.full_name || 'Sem nome'}
                    </TableCell>
                    <TableCell>{recipient.whatsapp}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {recipient.report_types.map(type => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {type === 'daily' ? 'Diário' : type === 'weekly' ? 'Semanal' : 'Alertas'}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{recipient.preferred_time?.substring(0, 5) || '08:00'}</TableCell>
                    <TableCell>
                      {recipient.last_report_sent_at ? (
                        <span className="text-sm">
                          {format(new Date(recipient.last_report_sent_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={recipient.is_active}
                        onCheckedChange={() => toggleRecipient(recipient.id, recipient.is_active)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRecipient(recipient.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Report Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Histórico de Envios
          </CardTitle>
          <CardDescription>
            Últimos relatórios enviados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reportLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum relatório enviado ainda</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Gráfico</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Métricas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {format(new Date(log.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.report_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.recipient_whatsapp}
                      </TableCell>
                      <TableCell>
                        {log.chart_sent ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                          {log.status === 'sent' ? 'Enviado' : 'Falhou'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.metrics_snapshot && (
                          <span className="text-xs text-muted-foreground">
                            {log.metrics_snapshot.totalActive} pedidos
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
