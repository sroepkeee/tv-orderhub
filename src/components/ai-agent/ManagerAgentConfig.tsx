import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Terminal, Bell, BarChart3, AlertTriangle, Clock, 
  Package, TrendingUp, FileText, Truck, History,
  ExternalLink, Send, CheckCircle, Activity, RefreshCw,
  Wifi, WifiOff, MessageSquare, Bug
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ManagerAgentDashboard } from '@/components/admin/ManagerAgentDashboard';
import { ManagerRecipientsManager } from './ManagerRecipientsManager';

interface ManagerAgentConfigProps {
  agentId?: string;
}

interface DiagnosticResult {
  whatsappConnected: boolean;
  instanceKey?: string;
  instanceStatus?: string;
  connectedAt?: string;
  managerFound: boolean;
  managerName?: string;
  managerWhatsapp?: string;
  megaApiConfigured: boolean;
  testMessageSent: boolean;
  error?: string;
}

const MANAGER_COMMANDS = [
  { command: 'status [número]', description: 'Consultar status de um pedido', icon: Package },
  { command: 'métricas', description: 'Ver dashboard de performance', icon: BarChart3 },
  { command: 'atrasados', description: 'Listar pedidos atrasados', icon: AlertTriangle },
  { command: 'risco semana', description: 'Previsão de atrasos 7d', icon: AlertTriangle },
  { command: 'valor por fase', description: 'Distribuição financeira', icon: TrendingUp },
  { command: 'lead time', description: 'Tempo médio de ciclo', icon: Clock },
  { command: 'top clientes', description: 'Ranking por valor', icon: TrendingUp },
  { command: 'capacidade', description: 'Carga vs capacidade', icon: BarChart3 },
  { command: 'gargalos', description: 'Identificar bottlenecks', icon: Clock },
  { command: 'tendência', description: 'Comparativo semanal', icon: TrendingUp },
  { command: 'itens críticos', description: 'Importados/urgentes', icon: AlertTriangle },
  { command: 'performance transportadora', description: 'Ranking carriers', icon: Truck },
  { command: 'custo frete', description: 'Análise de custos', icon: FileText },
];

const DEFAULT_ALERT_CONFIG = {
  delayThresholdDays: 3,
  slaWarningPercent: 80,
  volumeAnomalyPercent: 20,
  enableDailyDigest: true,
  digestTime: '08:00',
};

export function ManagerAgentConfig({ agentId }: ManagerAgentConfigProps) {
  const navigate = useNavigate();
  const [showDashboard, setShowDashboard] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState(DEFAULT_ALERT_CONFIG);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [sendingTestMessage, setSendingTestMessage] = useState(false);

  const handleTestAlert = async () => {
    setTestingAlert(true);
    try {
      const { error } = await supabase.functions.invoke('manager-smart-alerts', {
        body: { test: true }
      });
      
      if (error) throw error;
      toast.success('Alerta de teste enviado!');
    } catch (error) {
      console.error('Error testing alert:', error);
      toast.error('Erro ao enviar alerta de teste');
    } finally {
      setTestingAlert(false);
    }
  };

  const runDiagnostic = async () => {
    setRunningDiagnostic(true);
    setDiagnosticResult(null);
    
    try {
      const result: DiagnosticResult = {
        whatsappConnected: false,
        managerFound: false,
        megaApiConfigured: false,
        testMessageSent: false,
      };

      // 1. Verificar instância WhatsApp conectada
      const { data: instance, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('instance_key, status, phone_number, connected_at')
        .eq('status', 'connected')
        .order('connected_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (instanceError) {
        console.error('Diagnostic: Instance error', instanceError);
      }

      if (instance) {
        result.whatsappConnected = true;
        result.instanceKey = instance.instance_key;
        result.instanceStatus = instance.status;
        result.connectedAt = instance.connected_at;
      } else {
        // Buscar todas as instâncias para mostrar status
        const { data: allInstances } = await supabase
          .from('whatsapp_instances')
          .select('instance_key, status, updated_at')
          .order('updated_at', { ascending: false })
          .limit(1);
        
        if (allInstances?.[0]) {
          result.instanceKey = allInstances[0].instance_key;
          result.instanceStatus = allInstances[0].status;
        }
      }

      // 2. Verificar gestor atual (usuário logado)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, is_manager, whatsapp')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.is_manager) {
          result.managerFound = true;
          result.managerName = profile.full_name;
          result.managerWhatsapp = profile.whatsapp;
        }
      }

      // 3. Verificar se há gestores cadastrados
      if (!result.managerFound) {
        const { data: managers } = await supabase
          .from('profiles')
          .select('full_name, whatsapp')
          .eq('is_manager', true)
          .limit(1);

        if (managers?.[0]) {
          result.managerFound = true;
          result.managerName = managers[0].full_name;
          result.managerWhatsapp = managers[0].whatsapp;
        }
      }

      // 4. Verificar configuração Mega API (através de status check)
      try {
        const { data: statusData, error: statusError } = await supabase.functions.invoke('mega-api-status');
        if (!statusError && statusData) {
          result.megaApiConfigured = true;
        }
      } catch {
        result.megaApiConfigured = false;
      }

      setDiagnosticResult(result);
      
      if (result.whatsappConnected && result.managerFound) {
        toast.success('Diagnóstico: Sistema funcionando corretamente!');
      } else if (!result.whatsappConnected) {
        toast.error('Diagnóstico: WhatsApp desconectado!');
      } else if (!result.managerFound) {
        toast.warning('Diagnóstico: Nenhum gestor configurado');
      }
    } catch (error) {
      console.error('Diagnostic error:', error);
      toast.error('Erro ao executar diagnóstico');
      setDiagnosticResult({
        whatsappConnected: false,
        managerFound: false,
        megaApiConfigured: false,
        testMessageSent: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      setRunningDiagnostic(false);
    }
  };

  const sendTestMessage = async () => {
    if (!diagnosticResult?.managerWhatsapp) {
      toast.error('Nenhum WhatsApp de gestor encontrado');
      return;
    }

    setSendingTestMessage(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-agent-manager-query', {
        body: {
          message: 'resumo',
          senderPhone: diagnosticResult.managerWhatsapp.replace(/\D/g, ''),
          carrierId: null,
          isTest: true,
        }
      });

      if (error) throw error;

      if (data?.error === 'NO_WHATSAPP_INSTANCE') {
        toast.error('WhatsApp não está conectado. Reconecte primeiro.');
        return;
      }

      toast.success('Mensagem de teste enviada! Verifique seu WhatsApp.');
      setDiagnosticResult(prev => prev ? { ...prev, testMessageSent: true } : null);
    } catch (error) {
      console.error('Error sending test message:', error);
      toast.error('Erro ao enviar mensagem de teste');
    } finally {
      setSendingTestMessage(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Diagnóstico do Sistema */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bug className="h-5 w-5 text-blue-500" />
            Diagnóstico do Agente IA Gerencial
          </CardTitle>
          <CardDescription>
            Verifique se o sistema está configurado corretamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runDiagnostic} 
              disabled={runningDiagnostic}
              variant="outline"
            >
              <Activity className={`h-4 w-4 mr-2 ${runningDiagnostic ? 'animate-pulse' : ''}`} />
              {runningDiagnostic ? 'Executando...' : 'Executar Diagnóstico'}
            </Button>
            
            {diagnosticResult?.whatsappConnected && diagnosticResult?.managerWhatsapp && (
              <Button 
                onClick={sendTestMessage}
                disabled={sendingTestMessage}
                variant="default"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {sendingTestMessage ? 'Enviando...' : 'Enviar Teste'}
              </Button>
            )}
          </div>

          {diagnosticResult && (
            <div className="space-y-3 mt-4">
              {/* Status WhatsApp */}
              <div className={`flex items-center justify-between p-3 rounded-lg ${
                diagnosticResult.whatsappConnected 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-destructive/10 border border-destructive/20'
              }`}>
                <div className="flex items-center gap-2">
                  {diagnosticResult.whatsappConnected ? (
                    <Wifi className="h-5 w-5 text-green-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium text-sm">WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                      {diagnosticResult.instanceKey || 'Nenhuma instância'}
                      {diagnosticResult.instanceStatus && ` (${diagnosticResult.instanceStatus})`}
                    </p>
                  </div>
                </div>
                <Badge variant={diagnosticResult.whatsappConnected ? 'default' : 'destructive'}>
                  {diagnosticResult.whatsappConnected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </div>

              {/* Status Gestor */}
              <div className={`flex items-center justify-between p-3 rounded-lg ${
                diagnosticResult.managerFound 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-amber-500/10 border border-amber-500/20'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`h-5 w-5 ${diagnosticResult.managerFound ? 'text-green-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="font-medium text-sm">Gestor Configurado</p>
                    <p className="text-xs text-muted-foreground">
                      {diagnosticResult.managerName || 'Nenhum gestor encontrado'}
                      {diagnosticResult.managerWhatsapp && ` - ${diagnosticResult.managerWhatsapp}`}
                    </p>
                  </div>
                </div>
                <Badge variant={diagnosticResult.managerFound ? 'default' : 'secondary'}>
                  {diagnosticResult.managerFound ? 'OK' : 'Não configurado'}
                </Badge>
              </div>

              {/* Ações de correção */}
              {!diagnosticResult.whatsappConnected && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>WhatsApp Desconectado</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>O WhatsApp não está conectado. Mensagens de gestores não serão respondidas.</p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate('/settings/whatsapp')}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reconectar WhatsApp
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {!diagnosticResult.managerFound && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Nenhum Gestor Configurado</AlertTitle>
                  <AlertDescription>
                    Configure um gestor no card abaixo para receber respostas via WhatsApp.
                  </AlertDescription>
                </Alert>
              )}

              {diagnosticResult.testMessageSent && (
                <Alert className="bg-green-500/10 border-green-500/20">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertTitle>Teste Enviado</AlertTitle>
                  <AlertDescription>
                    Verifique seu WhatsApp. Você deve receber o resumo do dia.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gestores Cadastrados */}
      <ManagerRecipientsManager />

      {/* Comandos Disponíveis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-5 w-5 text-indigo-500" />
            Comandos Disponíveis via WhatsApp
          </CardTitle>
          <CardDescription>
            Gestores podem enviar estes comandos para receber informações em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {MANAGER_COMMANDS.map((cmd) => (
              <div 
                key={cmd.command}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="p-2 rounded-md bg-indigo-500/10">
                  <cmd.icon className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">
                    {cmd.command}
                  </code>
                  <p className="text-xs text-muted-foreground truncate">
                    {cmd.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuração de Alertas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-amber-500" />
            Configuração de Alertas Inteligentes
          </CardTitle>
          <CardDescription>
            Defina thresholds para alertas automáticos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Atraso crítico (dias)</Label>
              <Input
                type="number"
                value={alertConfig.delayThresholdDays}
                onChange={(e) => setAlertConfig({ 
                  ...alertConfig, 
                  delayThresholdDays: parseInt(e.target.value) || 3 
                })}
                min={1}
                max={30}
              />
              <p className="text-xs text-muted-foreground">
                Alertar quando pedido atrasar mais que X dias
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Aviso de SLA (%)</Label>
              <Input
                type="number"
                value={alertConfig.slaWarningPercent}
                onChange={(e) => setAlertConfig({ 
                  ...alertConfig, 
                  slaWarningPercent: parseInt(e.target.value) || 80 
                })}
                min={50}
                max={100}
              />
              <p className="text-xs text-muted-foreground">
                Alertar quando SLA atingir X% do limite
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <div>
                <span className="text-sm font-medium">Resumo Diário</span>
                <p className="text-xs text-muted-foreground">
                  Receber métricas consolidadas às {alertConfig.digestTime}
                </p>
              </div>
            </div>
            <Switch
              checked={alertConfig.enableDailyDigest}
              onCheckedChange={(checked) => setAlertConfig({ 
                ...alertConfig, 
                enableDailyDigest: checked 
              })}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleTestAlert}
              disabled={testingAlert}
            >
              <Send className="h-4 w-4 mr-2" />
              {testingAlert ? 'Enviando...' : 'Testar Alertas'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Resumidas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-green-500" />
            Dashboard de Métricas
          </CardTitle>
          <CardDescription>
            Acesse o painel completo de métricas gerenciais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                <TrendingUp className="h-6 w-6 text-indigo-500" />
              </div>
              <div>
                <h4 className="font-medium">Dashboard Gerencial Completo</h4>
                <p className="text-sm text-muted-foreground">
                  Métricas em tempo real, gargalos e tendências
                </p>
              </div>
            </div>
            <Button onClick={() => setShowDashboard(true)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Dashboard
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Comandos</p>
              <p className="text-lg font-bold">{MANAGER_COMMANDS.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <Bell className="h-5 w-5 text-amber-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Alertas</p>
              <Badge variant="secondary">Ativos</Badge>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <Clock className="h-5 w-5 text-blue-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Digest</p>
              <p className="text-sm font-medium">{alertConfig.digestTime}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Modal */}
      <Dialog open={showDashboard} onOpenChange={setShowDashboard}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Dashboard Gerencial
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <ManagerAgentDashboard />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ManagerAgentConfig;