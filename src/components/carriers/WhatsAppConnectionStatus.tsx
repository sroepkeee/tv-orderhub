import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';

export function WhatsAppConnectionStatus() {
  const { connected, status, loading, isAuthorized, refresh } = useWhatsAppStatus();

  if (loading) {
    return (
      <Badge variant="outline" className="gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">Verificando...</span>
      </Badge>
    );
  }

  if (!isAuthorized) {
    return (
      <Badge variant="outline" className="gap-2 bg-muted">
        <span className="text-xs text-muted-foreground">WhatsApp não autorizado</span>
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={connected ? "default" : "destructive"} 
        className="gap-2"
      >
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs">
          WhatsApp {connected ? 'Conectado' : 'Desconectado'}
        </span>
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={refresh}
        title="Atualizar status"
      >
        <RefreshCw className="h-3 w-3" />
      </Button>
    </div>
  );
}
