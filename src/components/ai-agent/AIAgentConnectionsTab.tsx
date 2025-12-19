import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { WhatsAppQRCodeDialog } from "@/components/carriers/WhatsAppQRCodeDialog";
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

interface MegaAPICredentials {
  url: string;
  token: string;
  instance: string;
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
  const [savingConfig, setSavingConfig] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  
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

  // Carregar instância do banco
  useEffect(() => {
    loadInstance();
  }, []);

  const loadInstance = async () => {
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setCredentials(prev => ({
        ...prev,
        instance: data.instance_key || ''
      }));
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
      
      // Mostrar link para secrets do Supabase
      window.open('https://supabase.com/dashboard/project/wejkyyjhckdlttieuyku/settings/functions', '_blank');
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast.error('Erro ao salvar credenciais');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
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
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <QrCode className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">WhatsApp não conectado</p>
                <p className="text-sm text-muted-foreground">
                  Escaneie o QR Code para conectar sua conta
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!whatsappConnected && (
              <Button onClick={() => setQrDialogOpen(true)} className="gap-2">
                <QrCode className="h-4 w-4" />
                Gerar QR Code
              </Button>
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
    </div>
  );
}
