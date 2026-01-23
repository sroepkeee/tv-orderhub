import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Link2, 
  KeyRound, 
  Server, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff,
  Copy,
  ExternalLink,
  MessageCircle,
  QrCode,
  Wifi,
  WifiOff,
  RotateCcw,
  Settings,
  Save,
  Loader2,
  AlertTriangle,
  Trash2,
  Zap,
  History,
  Send,
  PhoneOff,
  Phone,
  Filter,
  Database
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { WhatsAppQRCodeDialog } from "@/components/carriers/WhatsAppQRCodeDialog";
import { DiscordWebhooksPanel } from "./DiscordWebhooksPanel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MegaAPICredentials {
  url: string;
  token: string;
  instance: string;
}

interface InstanceDiagnostic {
  dbInstance: string | null;
  dbStatus: string | null;
  dbUpdatedAt: string | null;
  hasMultipleInstances: boolean;
  instanceCount: number;
}

interface EventLog {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  message_content: string;
  error_message: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
}

interface LastDisconnect {
  reason: string;
  cause: string;
  timestamp: string;
  troubleshooting: string[] | null;
}

export function AIAgentConnectionsTab() {
  const [credentials, setCredentials] = useState<MegaAPICredentials>({
    url: '',
    token: '',
    instance: ''
  });
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error'>('unknown');
  const [webhookUrl] = useState(`https://wejkyyjhckdlttieuyku.supabase.co/functions/v1/mega-api-webhook`);
  const [webhookStatus, setWebhookStatus] = useState<{ active: boolean; lastReceived?: string } | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [newConnectionDialogOpen, setNewConnectionDialogOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [cleaningData, setCleaningData] = useState(false);
  const [fixingDatabase, setFixingDatabase] = useState(false);
  const [diagnostic, setDiagnostic] = useState<InstanceDiagnostic>({
    dbInstance: null,
    dbStatus: null,
    dbUpdatedAt: null,
    hasMultipleInstances: false,
    instanceCount: 0
  });
  
  // Event logs state
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'error' | 'connection'>('all');
  
  // Test message state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Teste de envio do sistema Imply. Por favor, ignore.');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; phoneUsed?: string } | null>(null);
  
  // Last disconnect info
  const [lastDisconnect, setLastDisconnect] = useState<LastDisconnect | null>(null);
  const [disconnectCount24h, setDisconnectCount24h] = useState(0);
  
  const {
    connected: whatsappConnected,
    status: whatsappStatus,
    loading: whatsappLoading,
    isAuthorized,
    phoneNumber,
    connectedAt,
    instanceName,
    refresh: refreshWhatsApp,
    getQRCode,
    disconnect,
    restartInstance
  } = useWhatsAppStatus();

  // Load event logs
  const loadEventLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      let query = supabase
        .from('ai_notification_log')
        .select('id, channel, recipient, status, message_content, error_message, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(100);
      
      // Apply filter
      if (logFilter === 'success') {
        query = query.in('status', ['sent', 'delivered', 'connected']);
      } else if (logFilter === 'error') {
        query = query.in('status', ['failed', 'error', 'blocked']);
      } else if (logFilter === 'connection') {
        query = query.eq('channel', 'whatsapp_connection');
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error loading event logs:', error);
        return;
      }
      
      setEventLogs((data || []) as EventLog[]);
    } catch (error) {
      console.error('Error in loadEventLogs:', error);
    } finally {
      setLoadingLogs(false);
    }
  }, [logFilter]);

  // Load last disconnect info
  const loadLastDisconnect = useCallback(async () => {
    try {
      // Get last disconnect event
      const { data: lastEvent } = await supabase
        .from('ai_notification_log')
        .select('*')
        .eq('channel', 'whatsapp_connection')
        .eq('status', 'disconnected')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastEvent) {
        const metadata = lastEvent.metadata as Record<string, any> | null;
        setLastDisconnect({
          reason: lastEvent.message_content,
          cause: metadata?.disconnect_cause || 'unknown',
          timestamp: lastEvent.created_at,
          troubleshooting: metadata?.troubleshooting || null
        });
      }

      // Count disconnects in last 24h
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { count } = await supabase
        .from('ai_notification_log')
        .select('*', { count: 'exact', head: true })
        .eq('channel', 'whatsapp_connection')
        .eq('status', 'disconnected')
        .gte('created_at', yesterday.toISOString());

      setDisconnectCount24h(count || 0);
    } catch (error) {
      console.error('Error loading last disconnect:', error);
    }
  }, []);

  // Carregar instância do banco e diagnóstico
  useEffect(() => {
    loadInstanceDiagnostic();
    loadEventLogs();
    loadLastDisconnect();
  }, [loadEventLogs, loadLastDisconnect]);

  const loadInstanceDiagnostic = async () => {
    try {
      // Buscar apenas instâncias ATIVAS do banco
      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading instances:', error);
        return;
      }

      const instanceCount = instances?.length || 0;
      const latestInstance = instances?.[0];

      setDiagnostic({
        dbInstance: latestInstance?.instance_key || null,
        dbStatus: latestInstance?.status || null,
        dbUpdatedAt: latestInstance?.updated_at || null,
        hasMultipleInstances: instanceCount > 1,
        instanceCount
      });

      if (latestInstance) {
        setCredentials(prev => ({
          ...prev,
          instance: latestInstance.instance_key || ''
        }));
      }
    } catch (error) {
      console.error('Error in loadInstanceDiagnostic:', error);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionStatus('unknown');
    
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-status');
      
      if (error) throw error;
      
      if (data?.status === 'open' || data?.connected) {
        setConnectionStatus('success');
        toast.success('Conexão com Mega API funcionando!');
      } else {
        setConnectionStatus('error');
        toast.error('Mega API não está conectada');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionStatus('error');
      toast.error('Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  const handleTestWebhook = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-test-webhook');
      
      if (error) throw error;
      
      if (data?.success) {
        setWebhookStatus({ active: true, lastReceived: new Date().toISOString() });
        toast.success('Webhook está funcionando!');
      } else {
        setWebhookStatus({ active: false });
        toast.error('Webhook não respondeu corretamente');
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast.error('Erro ao testar webhook');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para área de transferência');
  };

  const handleQrDialogClose = () => {
    setQrDialogOpen(false);
  };

  const handleConnected = () => {
    setQrDialogOpen(false);
    refreshWhatsApp();
    toast.success('WhatsApp conectado com sucesso!');
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      // Primeiro tentar desconectar via API
      const result = await disconnect();
      
      // Forçar atualização do banco mesmo se a API falhar
      const { error: dbError } = await supabase
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          phone_number: null,
          connected_at: null,
          qrcode: null,
          qrcode_updated_at: null,
          updated_at: new Date().toISOString()
        })
        .not('id', 'is', null);

      if (dbError) {
        console.error('Error updating database:', dbError);
      }

      setDisconnectDialogOpen(false);
      toast.success('Instância desconectada. Configure as novas credenciais.');
      
      // Abrir diálogo de configuração
      setConfigDialogOpen(true);
      
      // Refresh status
      refreshWhatsApp();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar, mas você pode configurar novas credenciais');
      setConfigDialogOpen(true);
    } finally {
      setDisconnecting(false);
      setDisconnectDialogOpen(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!credentials.url || !credentials.token || !credentials.instance) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSavingConfig(true);
    try {
      // Atualizar ou inserir na tabela whatsapp_instances
      const { error: upsertError } = await supabase
        .from('whatsapp_instances')
        .upsert({
          instance_key: credentials.instance,
          name: 'Imply Notificações',
          status: 'disconnected',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'instance_key'
        });

      if (upsertError) {
        console.error('Error saving instance:', upsertError);
      }

      toast.success('Credenciais salvas! Agora configure os Secrets no Supabase.');
      toast.info(
        'Configure no Supabase: MEGA_API_URL, MEGA_API_TOKEN, MEGA_API_INSTANCE',
        { duration: 10000 }
      );

      setConfigDialogOpen(false);
      loadInstanceDiagnostic();
      
      // Mostrar link para secrets do Supabase
      window.open('https://supabase.com/dashboard/project/wejkyyjhckdlttieuyku/settings/functions', '_blank');
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast.error('Erro ao salvar credenciais');
    } finally {
      setSavingConfig(false);
    }
  };

  // Limpar todos os dados antigos e preparar para nova conexão
  const handleCleanAndNewConnection = async () => {
    setCleaningData(true);
    try {
      // 1. Deletar todas as instâncias antigas
      const { error: deleteError } = await supabase
        .from('whatsapp_instances')
        .delete()
        .not('id', 'is', null); // Delete all

      if (deleteError) {
        console.error('Error deleting instances:', deleteError);
        toast.error('Erro ao limpar instâncias antigas');
        return;
      }

      // 2. Limpar credenciais locais
      setCredentials({
        url: '',
        token: '',
        instance: ''
      });

      // 3. Resetar diagnóstico
      setDiagnostic({
        dbInstance: null,
        dbStatus: null,
        dbUpdatedAt: null,
        hasMultipleInstances: false,
        instanceCount: 0
      });

      toast.success('Dados antigos removidos! Agora configure a nova instância.');
      setNewConnectionDialogOpen(false);
      setConfigDialogOpen(true);
    } catch (error) {
      console.error('Error cleaning data:', error);
      toast.error('Erro ao limpar dados');
    } finally {
      setCleaningData(false);
    }
  };

  // Corrigir credenciais do banco de dados
  const handleFixDatabaseCredentials = async () => {
    setFixingDatabase(true);
    try {
      // Corrigir instância megastart-MakQlnxoqp9 com token correto
      const { error: updateError } = await supabase
        .from('whatsapp_instances')
        .update({ 
          api_token: 'MakQlnxoqp9',
          status: 'connected',
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('instance_key', 'megastart-MakQlnxoqp9');

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Desativar outras instâncias
      const { error: deactivateError } = await supabase
        .from('whatsapp_instances')
        .update({ is_active: false })
        .neq('instance_key', 'megastart-MakQlnxoqp9');

      if (deactivateError) {
        console.error('Deactivate error:', deactivateError);
      }

      toast.success('Banco de dados corrigido! Token atualizado para MakQlnxoqp9.');
      
      // Recarregar diagnóstico e status
      await loadInstanceDiagnostic();
      await refreshWhatsApp();
    } catch (error) {
      console.error('Error fixing credentials:', error);
      toast.error('Erro ao corrigir banco. Verifique as permissões.');
    } finally {
      setFixingDatabase(false);
    }
  };

  // Função para normalizar telefone no novo padrão (55 + DDD + 8 dígitos)
  const normalizePhoneForTest = (phone: string): string => {
    let digits = phone.replace(/\D/g, '');
    
    if (!digits.startsWith('55')) {
      digits = '55' + digits;
    }
    
    // Remover o 9 se presente (formato antigo)
    if (digits.length === 13 && digits.startsWith('55') && digits.charAt(4) === '9') {
      const ddd = digits.substring(2, 4);
      const numero = digits.substring(5);
      digits = '55' + ddd + numero;
    }
    
    return digits;
  };

  // Função para testar envio de mensagem
  const handleSendTestMessage = async () => {
    if (!testPhone.trim()) {
      toast.error('Informe um número de telefone');
      return;
    }
    
    setSendingTest(true);
    setTestResult(null);
    
    try {
      const normalizedPhone = normalizePhoneForTest(testPhone);
      
      // Buscar um carrier com esse telefone ou criar um virtual
      const { data: carrier } = await supabase
        .from('carriers')
        .select('id, whatsapp')
        .or(`whatsapp.eq.${testPhone},whatsapp.ilike.%${testPhone.slice(-8)}%`)
        .limit(1)
        .maybeSingle();

      if (!carrier) {
        // Criar carrier temporário para teste
        const { data: newCarrier, error: createError } = await supabase
          .from('carriers')
          .insert({
            name: 'Teste de Envio',
            whatsapp: normalizedPhone,
            is_active: true,
            notes: 'Carrier criado para teste de envio'
          })
          .select()
          .single();

        if (createError) {
          throw new Error('Não foi possível criar carrier para teste');
        }

        const { data, error } = await supabase.functions.invoke('mega-api-send', {
          body: {
            carrierId: newCarrier.id,
            message: testMessage,
            conversationType: 'general',
            contactType: 'carrier'
          }
        });

        // Remover carrier de teste
        await supabase.from('carriers').delete().eq('id', newCarrier.id);

        if (error) throw error;

        setTestResult({
          success: true,
          message: `Mensagem enviada com sucesso! ID: ${data?.conversationId}`,
          phoneUsed: normalizedPhone
        });
        toast.success('Mensagem de teste enviada!');
      } else {
        const { data, error } = await supabase.functions.invoke('mega-api-send', {
          body: {
            carrierId: carrier.id,
            message: testMessage,
            conversationType: 'general',
            contactType: 'carrier'
          }
        });

        if (error) throw error;

        setTestResult({
          success: true,
          message: `Mensagem enviada para carrier existente! ID: ${data?.conversationId}`,
          phoneUsed: normalizedPhone
        });
        toast.success('Mensagem de teste enviada!');
      }
    } catch (error) {
      console.error('Error sending test message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setTestResult({
        success: false,
        message: `Erro: ${errorMessage}`
      });
      toast.error('Falha ao enviar mensagem de teste');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Diagnostic Card - Only show if there are issues */}
      {(diagnostic.hasMultipleInstances || (!whatsappConnected && diagnostic.dbInstance)) && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Diagnóstico de Configuração
            </CardTitle>
            <CardDescription>
              Problemas detectados na configuração da instância WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-3 bg-background rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">Instância no Banco</p>
                <p className="font-mono text-sm font-medium">
                  {diagnostic.dbInstance || 'Nenhuma configurada'}
                </p>
                {diagnostic.dbStatus && (
                  <Badge variant={diagnostic.dbStatus === 'connected' ? 'default' : 'secondary'} className="mt-1">
                    {diagnostic.dbStatus}
                  </Badge>
                )}
              </div>
              <div className="p-3 bg-background rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">Secret Configurado</p>
                <p className="font-mono text-sm font-medium text-muted-foreground">
                  MEGA_API_INSTANCE
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Verifique se corresponde ao banco
                </p>
              </div>
            </div>

            {diagnostic.hasMultipleInstances && (
              <div className="p-3 bg-red-100 dark:bg-red-950/30 rounded-lg border border-red-300 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <strong>Múltiplas instâncias detectadas ({diagnostic.instanceCount})</strong>
                </p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                  Recomendamos limpar e criar uma nova conexão.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline"
                onClick={() => setNewConnectionDialogOpen(true)}
                className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-100"
              >
                <Zap className="h-4 w-4" />
                Nova Conexão (Limpar Tudo)
              </Button>
              <Button 
                variant="ghost"
                onClick={loadInstanceDiagnostic}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar Diagnóstico
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Connection */}
      <Card className={whatsappConnected ? 'border-green-500/50' : 'border-muted'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${whatsappConnected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                <MessageCircle className={`h-6 w-6 ${whatsappConnected ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Conexão WhatsApp
                  {whatsappConnected ? (
                    <Badge className="bg-green-500">
                      <Wifi className="h-3 w-3 mr-1" />
                      Conectado
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <WifiOff className="h-3 w-3 mr-1" />
                      Desconectado
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {instanceName || 'Imply Notificações'} via Mega API
                  {diagnostic.dbInstance && !whatsappConnected && (
                    <span className="ml-2 text-xs text-amber-600">
                      (Instance: {diagnostic.dbInstance})
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {whatsappConnected ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Número Conectado</p>
                <p className="font-mono font-medium">
                  +{phoneNumber?.slice(0, 2)} ({phoneNumber?.slice(2, 4)}) {phoneNumber?.slice(4, 9)}-{phoneNumber?.slice(9)}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Conectado em</p>
                <p className="font-medium">
                  {connectedAt ? format(connectedAt, "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Status Técnico</p>
                <p className="font-medium text-green-600">{whatsappStatus || 'Conectado'}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">WhatsApp não conectado</p>
                  <p className="text-sm text-muted-foreground">
                    Escaneie o QR Code para conectar sua conta
                  </p>
                  {!diagnostic.dbInstance && (
                    <p className="text-xs text-amber-600 mt-2">
                      Configure as credenciais primeiro
                    </p>
                  )}
                </div>
              </div>

              {/* Last Disconnect Alert */}
              {lastDisconnect && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-300 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-800 dark:text-amber-400">
                        Última Desconexão
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                        {lastDisconnect.reason}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-600 mt-1">
                        {format(new Date(lastDisconnect.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                      
                      {lastDisconnect.troubleshooting && lastDisconnect.troubleshooting.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-500">
                          {lastDisconnect.troubleshooting.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-amber-500">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Instability Alert - Show if ANY disconnections occurred */}
              {disconnectCount24h > 0 && (
                <div className={`p-4 rounded-lg border ${
                  disconnectCount24h > 3 
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                }`}>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${
                        disconnectCount24h > 3 ? 'text-red-600' : 'text-amber-600'
                      }`} />
                      <div className="flex-1">
                        <p className={`font-medium ${
                          disconnectCount24h > 3 
                            ? 'text-red-800 dark:text-red-400'
                            : 'text-amber-800 dark:text-amber-400'
                        }`}>
                          {disconnectCount24h > 3 ? 'Problema de Estabilidade Crítico' : 'Atenção: Desconexões Recentes'}
                        </p>
                        <p className={`text-sm mt-1 ${
                          disconnectCount24h > 3 
                            ? 'text-red-700 dark:text-red-500'
                            : 'text-amber-700 dark:text-amber-500'
                        }`}>
                          <strong>{disconnectCount24h}</strong> desconexão(ões) nas últimas 24 horas.
                          A MEGA API está desconectando automaticamente.
                        </p>
                      </div>
                    </div>
                    
                    <div className="pl-8 space-y-3">
                      <div className="p-3 bg-white dark:bg-background rounded-md border border-current/20">
                        <p className="font-medium text-sm mb-2">⚠️ Possíveis causas:</p>
                        <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                          <li>WhatsApp Web aberto em outro navegador/dispositivo</li>
                          <li>Múltiplas instâncias na MEGA API usando o mesmo número</li>
                          <li>Configuração de auto-logout na MEGA API</li>
                          <li>Limite de mensagens ou rate limit excedido</li>
                        </ul>
                      </div>
                      
                      <div className="p-3 bg-white dark:bg-background rounded-md border border-current/20">
                        <p className="font-medium text-sm mb-2">✅ Ações recomendadas:</p>
                        <ol className="list-decimal list-inside text-xs space-y-1 text-muted-foreground">
                          <li>Feche TODOS os WhatsApp Web em outros navegadores</li>
                          <li>Acesse o painel da MEGA API e verifique instâncias duplicadas</li>
                          <li>No celular: WhatsApp → Dispositivos Conectados → Remova antigos</li>
                          <li>Reconecte escaneando o QR Code abaixo</li>
                          <li><strong>Aguarde 1 minuto</strong> antes de enviar mensagens</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!whatsappConnected && (
              <>
                <Button onClick={() => setQrDialogOpen(true)} className="gap-2">
                  <QrCode className="h-4 w-4" />
                  Gerar QR Code
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setNewConnectionDialogOpen(true)}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Nova Conexão
                </Button>
              </>
            )}
            <Button 
              variant="outline" 
              onClick={refreshWhatsApp}
              disabled={whatsappLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${whatsappLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button 
              variant="outline" 
              onClick={restartInstance}
              disabled={whatsappLoading}
              className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700"
            >
              <RotateCcw className="h-4 w-4" />
              Forçar Reinício
            </Button>
            <Button 
              variant="outline" 
              onClick={handleFixDatabaseCredentials}
              disabled={fixingDatabase}
              className="gap-2 text-green-600 border-green-300 hover:bg-green-50 hover:text-green-700"
            >
              {fixingDatabase ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              Corrigir Banco
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setConfigDialogOpen(true)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Configurar Credenciais
            </Button>
            {whatsappConnected && (
              <Button 
                variant="destructive" 
                onClick={() => setDisconnectDialogOpen(true)}
                className="gap-2"
              >
                Desconectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Webhook de Recebimento
          </CardTitle>
          <CardDescription>
            Configure este webhook no painel da Mega API para receber mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Webhook</Label>
            <div className="flex gap-2">
              <Input 
                value={webhookUrl} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(webhookUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <p className="text-sm font-medium">Eventos a configurar na Mega API:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">messages.upsert</Badge>
              <Badge variant="secondary">connection.update</Badge>
              <Badge variant="secondary">qrcode.update</Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {webhookStatus?.active ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-green-600">Webhook ativo</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Status desconhecido</span>
                </>
              )}
            </div>
            <Button variant="outline" onClick={handleTestWebhook} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Testar Webhook
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Status da API
          </CardTitle>
          <CardDescription>
            Verifique a conexão com os serviços externos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className={`p-4 rounded-lg border ${connectionStatus === 'success' ? 'border-green-500/50 bg-green-50 dark:bg-green-950/30' : connectionStatus === 'error' ? 'border-red-500/50 bg-red-50 dark:bg-red-950/30' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className={`h-5 w-5 ${connectionStatus === 'success' ? 'text-green-600' : connectionStatus === 'error' ? 'text-red-600' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium">Mega API</p>
                    <p className="text-xs text-muted-foreground">WhatsApp Business</p>
                  </div>
                </div>
                {connectionStatus === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                {connectionStatus === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${whatsappConnected ? 'border-green-500/50 bg-green-50 dark:bg-green-950/30' : 'border-muted bg-muted/30'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className={`h-5 w-5 ${whatsappConnected ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium">WhatsApp</p>
                    <p className="text-xs text-muted-foreground">Instância conectada</p>
                  </div>
                </div>
                {whatsappConnected ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>

          <Button 
            onClick={handleTestConnection} 
            disabled={testing}
            className="w-full gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testando...' : 'Testar Todas as Conexões'}
          </Button>
        </CardContent>
      </Card>

      {/* Test Message Card */}
      <Card className="border-blue-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Teste de Envio de Mensagem
          </CardTitle>
          <CardDescription>
            Teste o envio de mensagem para verificar se a integração está funcionando.
            Formato: 55 + DDD + 8 dígitos (sem o 9)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Telefone de Destino</Label>
              <Input 
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="5551XXXXXXXX (12 dígitos)"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Novo padrão: País (55) + DDD (2) + Número (8 dígitos)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Input 
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Mensagem de teste..."
              />
            </div>
          </div>

          {testResult && (
            <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 dark:bg-green-950/30 border-green-300' : 'bg-red-50 dark:bg-red-950/30 border-red-300'}`}>
              <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {testResult.message}
              </p>
              {testResult.phoneUsed && (
                <p className="text-xs text-muted-foreground mt-1">
                  Número utilizado: <span className="font-mono">{testResult.phoneUsed}</span>
                </p>
              )}
            </div>
          )}

          <Button 
            onClick={handleSendTestMessage}
            disabled={sendingTest || !whatsappConnected}
            className="gap-2"
          >
            {sendingTest ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sendingTest ? 'Enviando...' : 'Enviar Mensagem de Teste'}
          </Button>
          
          {!whatsappConnected && (
            <p className="text-xs text-amber-600">
              Conecte o WhatsApp primeiro para testar o envio.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Event History Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Eventos
              </CardTitle>
              <CardDescription>
                Mensagens enviadas, erros e eventos de conexão
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => loadEventLogs()}
              disabled={loadingLogs}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loadingLogs ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Tabs */}
          <Tabs value={logFilter} onValueChange={(v) => setLogFilter(v as typeof logFilter)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="gap-2">
                <Filter className="h-3 w-3" />
                Todos
              </TabsTrigger>
              <TabsTrigger value="success" className="gap-2">
                <CheckCircle2 className="h-3 w-3" />
                Sucesso
              </TabsTrigger>
              <TabsTrigger value="error" className="gap-2">
                <XCircle className="h-3 w-3" />
                Erros
              </TabsTrigger>
              <TabsTrigger value="connection" className="gap-2">
                <Wifi className="h-3 w-3" />
                Conexão
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Logs Table */}
          <ScrollArea className="h-[300px]">
            {loadingLogs ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : eventLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <History className="h-8 w-8 mb-2" />
                <p className="text-sm">Nenhum evento encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Data/Hora</TableHead>
                    <TableHead className="w-[100px]">Canal</TableHead>
                    <TableHead className="w-[120px]">Destinatário</TableHead>
                    <TableHead className="w-[90px]">Status</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono">
                        {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            log.channel === 'whatsapp_connection' 
                              ? 'border-blue-500 text-blue-600' 
                              : log.channel === 'whatsapp'
                                ? 'border-green-500 text-green-600'
                                : 'border-muted-foreground'
                          }`}
                        >
                          {log.channel === 'whatsapp_connection' && <Wifi className="h-3 w-3 mr-1" />}
                          {log.channel === 'whatsapp' && <Send className="h-3 w-3 mr-1" />}
                          {log.channel === 'whatsapp_connection' 
                            ? 'Conexão' 
                            : log.channel === 'whatsapp'
                              ? 'WhatsApp'
                              : log.channel
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate" title={log.recipient}>
                        {log.recipient === 'system' 
                          ? <span className="text-muted-foreground">Sistema</span>
                          : log.recipient.length > 15 
                            ? `...${log.recipient.slice(-8)}`
                            : log.recipient
                        }
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            ['sent', 'delivered', 'connected'].includes(log.status) 
                              ? 'default' 
                              : ['failed', 'error', 'blocked'].includes(log.status)
                                ? 'destructive'
                                : log.status === 'disconnected'
                                  ? 'secondary'
                                  : 'outline'
                          }
                          className="text-xs"
                        >
                          {log.status === 'connected' && <Phone className="h-3 w-3 mr-1" />}
                          {log.status === 'disconnected' && <PhoneOff className="h-3 w-3 mr-1" />}
                          {log.status === 'sent' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {log.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        <div className="truncate" title={log.message_content}>
                          {log.message_content.length > 50 
                            ? `${log.message_content.slice(0, 50)}...` 
                            : log.message_content
                          }
                        </div>
                        {log.error_message && (
                          <div className="text-destructive text-xs mt-1 truncate" title={log.error_message}>
                            ⚠️ {log.error_message.slice(0, 40)}...
                          </div>
                        )}
                        {/* Show disconnect cause for connection events */}
                        {log.channel === 'whatsapp_connection' && log.metadata?.disconnect_cause && (
                          <Badge variant="outline" className="mt-1 text-xs border-amber-500 text-amber-600">
                            {log.metadata.disconnect_cause === 'session_conflict' && '🔄 Conflito de sessão'}
                            {log.metadata.disconnect_cause === 'manual_logout' && '👆 Logout manual'}
                            {log.metadata.disconnect_cause === 'timeout' && '⏱️ Timeout'}
                            {log.metadata.disconnect_cause === 'connection_closed' && '🔌 Conexão fechada'}
                            {!['session_conflict', 'manual_logout', 'timeout', 'connection_closed'].includes(log.metadata.disconnect_cause) && log.metadata.disconnect_cause}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t">
            <div className="text-center p-2 bg-muted/30 rounded">
              <p className="text-xl font-bold">{eventLogs.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950/30 rounded">
              <p className="text-xl font-bold text-green-600">
                {eventLogs.filter(l => ['sent', 'delivered', 'connected'].includes(l.status)).length}
              </p>
              <p className="text-xs text-muted-foreground">Sucesso</p>
            </div>
            <div className="text-center p-2 bg-red-50 dark:bg-red-950/30 rounded">
              <p className="text-xl font-bold text-red-600">
                {eventLogs.filter(l => ['failed', 'error', 'blocked'].includes(l.status)).length}
              </p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
              <p className="text-xl font-bold text-blue-600">
                {eventLogs.filter(l => l.channel === 'whatsapp_connection').length}
              </p>
              <p className="text-xs text-muted-foreground">Conexão</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Documentação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            <a 
              href="https://doc.megaapi.com.br/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-primary" />
              <span className="text-sm">Documentação Mega API</span>
            </a>
            <a 
              href="https://supabase.com/dashboard/project/wejkyyjhckdlttieuyku/functions" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-primary" />
              <span className="text-sm">Edge Functions (Supabase)</span>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <WhatsAppQRCodeDialog
        open={qrDialogOpen}
        onOpenChange={handleQrDialogClose}
        onConnected={handleConnected}
        getQRCode={getQRCode}
        checkStatus={refreshWhatsApp}
        isConnected={whatsappConnected}
        onRestartInstance={restartInstance}
      />

      {/* Credentials Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Configurar Mega API
            </DialogTitle>
            <DialogDescription>
              Insira as credenciais da sua instância Mega API. 
              Após salvar, configure os Secrets no Supabase.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-url">URL da API</Label>
              <Input
                id="api-url"
                placeholder="https://api.megaapi.com.br"
                value={credentials.url}
                onChange={(e) => setCredentials(prev => ({ ...prev, url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Ex: https://api.megaapi.com.br ou sua URL personalizada
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-token">Token / Bearer</Label>
              <div className="flex gap-2">
                <Input
                  id="api-token"
                  type={showToken ? "text" : "password"}
                  placeholder="Seu token de autenticação"
                  value={credentials.token}
                  onChange={(e) => setCredentials(prev => ({ ...prev, token: e.target.value }))}
                />
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instance-key">Instance Key</Label>
              <Input
                id="instance-key"
                placeholder="sua-instancia-key"
                value={credentials.instance}
                onChange={(e) => setCredentials(prev => ({ ...prev, instance: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Identificador único da sua instância na Mega API
              </p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Importante:</strong> Após salvar aqui, você precisará atualizar os Secrets no Supabase:
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-300 mt-2 space-y-1">
                <li>• MEGA_API_URL</li>
                <li>• MEGA_API_TOKEN</li>
                <li>• MEGA_API_INSTANCE</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCredentials} disabled={savingConfig} className="gap-2">
              {savingConfig ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar e Configurar Secrets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá encerrar a conexão atual com o WhatsApp. 
              Você poderá configurar novas credenciais para conectar outra instância.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desconectando...
                </>
              ) : (
                'Desconectar e Reconfigurar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Connection Dialog - Clean and Start Fresh */}
      <AlertDialog open={newConnectionDialogOpen} onOpenChange={setNewConnectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Nova Conexão WhatsApp
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Esta ação irá limpar todos os dados da instância atual e preparar 
                para uma nova configuração.
              </p>
              
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 text-left">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                  O que será feito:
                </p>
                <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <li className="flex items-center gap-2">
                    <Trash2 className="h-3 w-3" />
                    Remover todas as instâncias do banco de dados
                  </li>
                  <li className="flex items-center gap-2">
                    <Settings className="h-3 w-3" />
                    Abrir configuração para nova instância
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 text-left">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Lembre-se:</strong> Após configurar aqui, você também precisará 
                  atualizar os Secrets no Supabase (MEGA_API_URL, MEGA_API_TOKEN, MEGA_API_INSTANCE)
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaningData}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCleanAndNewConnection}
              disabled={cleaningData}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {cleaningData ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Limpando...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Limpar e Configurar Nova
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discord Webhooks Section */}
      <Separator className="my-6" />
      <DiscordWebhooksPanel />
    </div>
  );
}
