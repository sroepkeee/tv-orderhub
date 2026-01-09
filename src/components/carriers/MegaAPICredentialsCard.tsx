import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings, Eye, EyeOff, Check, X, Loader2, ExternalLink, AlertTriangle, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';

interface CredentialStatus {
  configured: boolean;
  valid: boolean | null;
  value?: string;
}

interface APIStatus {
  url: CredentialStatus;
  instance: CredentialStatus;
  token: CredentialStatus;
  apiConnection: boolean | null;
  lastCheck: Date | null;
}

export function MegaAPICredentialsCard() {
  const [status, setStatus] = useState<APIStatus>({
    url: { configured: false, valid: null },
    instance: { configured: false, valid: null },
    token: { configured: false, valid: null },
    apiConnection: null,
    lastCheck: null,
  });
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [credentials, setCredentials] = useState({
    url: '',
    instance: '',
    token: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadStatus = async () => {
    setLoading(true);
    try {
      // Buscar status da API via edge function
      const { data, error } = await supabase.functions.invoke('mega-api-status');
      
      if (error) {
        console.error('Error checking status:', error);
        setStatus(prev => ({
          ...prev,
          lastCheck: new Date(),
        }));
        return;
      }

      // A edge function retorna dados sobre a configuração
      setStatus({
        url: { 
          configured: !!data?.apiUrl, 
          valid: data?.connected !== undefined ? true : null,
          value: data?.apiUrl ? maskUrl(data.apiUrl) : undefined,
        },
        instance: { 
          configured: !!data?.instanceKey, 
          valid: data?.connected !== undefined ? true : null,
          value: data?.instanceKey,
        },
        token: { 
          configured: !!data?.tokenConfigured, 
          valid: data?.connected !== undefined ? true : null,
        },
        apiConnection: data?.connected ?? null,
        lastCheck: new Date(),
      });

      // Preencher credenciais atuais para edição
      if (data?.instanceKey) {
        setCredentials(prev => ({
          ...prev,
          instance: data.instanceKey,
        }));
      }
    } catch (err) {
      console.error('Error loading status:', err);
    } finally {
      setLoading(false);
    }
  };

  const maskUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.hostname}`;
    } catch {
      return url;
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-status', {
        body: { forceCheck: true },
      });

      if (error) throw error;

      setStatus(prev => ({
        ...prev,
        apiConnection: data?.connected ?? false,
        lastCheck: new Date(),
      }));

      toast({
        title: data?.connected ? 'Conexão OK' : 'Falha na conexão',
        description: data?.connected 
          ? 'API Mega está respondendo corretamente.' 
          : `Erro: ${data?.error || 'Não foi possível conectar'}`,
        variant: data?.connected ? 'default' : 'destructive',
      });
    } catch (err) {
      console.error('Error testing connection:', err);
      toast({
        title: 'Erro ao testar',
        description: 'Não foi possível testar a conexão.',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!credentials.url.trim() || !credentials.instance.trim() || !credentials.token.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos para salvar.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Salvar no banco de dados para referência
      const { error: dbError } = await supabase
        .from('whatsapp_instances')
        .upsert({
          instance_key: credentials.instance.trim(),
          status: 'pending_config',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'instance_key',
        });

      if (dbError) {
        console.error('Error saving to database:', dbError);
      }

      toast({
        title: 'Credenciais Salvas Localmente',
        description: 'Agora atualize os Secrets no Supabase Dashboard.',
      });

      setDialogOpen(false);
      
      // Mostrar instruções
      toast({
        title: '⚠️ Ação Necessária',
        description: 'Atualize os secrets MEGA_API_URL, MEGA_API_TOKEN e MEGA_API_INSTANCE no Supabase.',
        duration: 10000,
      });

    } catch (err) {
      console.error('Error saving credentials:', err);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as credenciais.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência.`,
    });
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const StatusBadge = ({ configured, valid }: CredentialStatus) => {
    if (!configured) {
      return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Não configurado</Badge>;
    }
    if (valid === true) {
      return <Badge className="bg-green-500 gap-1"><Check className="h-3 w-3" /> OK</Badge>;
    }
    if (valid === false) {
      return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Inválido</Badge>;
    }
    return <Badge variant="secondary" className="gap-1">Configurado</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Credenciais Mega API</CardTitle>
                <CardDescription>Configure as credenciais de acesso à API</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="text-sm font-medium">MEGA_API_URL</p>
                    {status.url.value && (
                      <p className="text-xs text-muted-foreground font-mono">{status.url.value}</p>
                    )}
                  </div>
                  <StatusBadge {...status.url} />
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="text-sm font-medium">MEGA_API_INSTANCE</p>
                    {status.instance.value && (
                      <p className="text-xs text-muted-foreground font-mono">{status.instance.value}</p>
                    )}
                  </div>
                  <StatusBadge {...status.instance} />
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="text-sm font-medium">MEGA_API_TOKEN</p>
                    <p className="text-xs text-muted-foreground">••••••••</p>
                  </div>
                  <StatusBadge {...status.token} />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Conexão com API</p>
                    {status.lastCheck && (
                      <p className="text-xs text-muted-foreground">
                        Verificado: {status.lastCheck.toLocaleTimeString('pt-BR')}
                      </p>
                    )}
                  </div>
                  {status.apiConnection === true ? (
                    <Badge className="bg-green-500 gap-1"><Check className="h-3 w-3" /> Online</Badge>
                  ) : status.apiConnection === false ? (
                    <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Offline</Badge>
                  ) : (
                    <Badge variant="outline">Não verificado</Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={testConnection}
                  disabled={testing}
                  className="gap-2"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Testar Conexão
                </Button>
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                  <Settings className="h-4 w-4" />
                  Configurar Credenciais
                </Button>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  As credenciais são gerenciadas via{' '}
                  <a 
                    href="https://supabase.com/dashboard/project/wejkyyjhckdlttieuyku/settings/functions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-1"
                  >
                    Supabase Secrets <ExternalLink className="h-3 w-3" />
                  </a>
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar Credenciais Mega API</DialogTitle>
            <DialogDescription>
              Insira as credenciais obtidas no painel da Mega API. Após salvar, você precisará atualizar os Secrets no Supabase.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mega-url">URL da API</Label>
              <div className="flex gap-2">
                <Input
                  id="mega-url"
                  value={credentials.url}
                  onChange={(e) => setCredentials(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://apistart02.megaapi.com.br"
                />
                {credentials.url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(credentials.url, 'URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Exemplo: https://apistart02.megaapi.com.br
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mega-instance">Nome da Instância</Label>
              <div className="flex gap-2">
                <Input
                  id="mega-instance"
                  value={credentials.instance}
                  onChange={(e) => setCredentials(prev => ({ ...prev, instance: e.target.value }))}
                  placeholder="megastart-XXXXXXXX"
                />
                {credentials.instance && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(credentials.instance, 'Instância')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Nome exato da instância no painel Mega API
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mega-token">Token/API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="mega-token"
                    type={showToken ? 'text' : 'password'}
                    value={credentials.token}
                    onChange={(e) => setCredentials(prev => ({ ...prev, token: e.target.value }))}
                    placeholder="Seu token de acesso"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {credentials.token && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(credentials.token, 'Token')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Importante:</strong> Após clicar em Salvar, copie os valores e atualize manualmente os Secrets no Supabase Dashboard:
                <ul className="list-disc ml-4 mt-1">
                  <li>MEGA_API_URL</li>
                  <li>MEGA_API_INSTANCE</li>
                  <li>MEGA_API_TOKEN</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => window.open('https://supabase.com/dashboard/project/wejkyyjhckdlttieuyku/settings/functions', '_blank')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Supabase Secrets
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSaveCredentials} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar e Copiar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
