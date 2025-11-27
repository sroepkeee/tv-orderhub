import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, TestTube, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SUPABASE_URL = "https://wejkyyjhckdlttieuyku.supabase.co";

export function WhatsAppWebhookCard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastWebhook, setLastWebhook] = useState<Date | null>(null);

  const webhookUrl = `${SUPABASE_URL}/functions/v1/mega-api-webhook`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({
      title: 'URL copiada',
      description: 'A URL do webhook foi copiada para a área de transferência.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-test-webhook');
      
      if (error) throw error;

      if (data?.success) {
        setLastWebhook(new Date());
        toast({
          title: 'Webhook funcionando',
          description: 'O webhook está configurado corretamente e respondendo.',
        });
      } else {
        toast({
          title: 'Webhook não configurado',
          description: 'Configure o webhook no painel da Mega API primeiro.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao testar webhook',
        description: 'Não foi possível testar o webhook. Verifique a configuração.',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            🔗 Webhook URL
          </CardTitle>
          <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
            Webhook Ativo
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure esta URL no painel do seu provedor
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted p-3 rounded-md font-mono text-sm break-all">
            {webhookUrl}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <Button 
          onClick={handleTestWebhook} 
          disabled={testing}
          variant="secondary"
          className="w-full gap-2"
        >
          <TestTube className={`h-4 w-4 ${testing ? 'animate-pulse' : ''}`} />
          {testing ? 'Testando webhook...' : 'Testar Webhook Automaticamente'}
        </Button>

        {lastWebhook && (
          <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
            Último webhook recebido: {format(lastWebhook, "dd/MM/yyyy, HH:mm:ss", { locale: ptBR })}
          </div>
        )}

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
              📋
            </div>
            <h4 className="font-semibold">MEGA API - Configuração Manual</h4>
          </div>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Acesse o painel da MEGA API</li>
            <li>Navegue até as configurações da sua instância</li>
            <li>Procure pela seção 'Webhook' ou 'Notificações'</li>
            <li>Cole a URL do webhook acima</li>
            <li>Selecione os eventos: <code className="bg-muted px-1 rounded">messages.upsert</code> e <code className="bg-muted px-1 rounded">connection.update</code></li>
            <li>Ative o webhook e salve as configurações</li>
          </ol>

          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3 text-sm">
            <p className="text-yellow-800 dark:text-yellow-300">
              ⚠️ <strong>Importante:</strong> O plano Start pode ter limitações de webhook. 
              Considere upgrade para o plano Code se necessário.
            </p>
          </div>

          <Button variant="outline" className="w-full gap-2" asChild>
            <a href="https://docs.mega-api.app.br" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Ver Documentação
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
