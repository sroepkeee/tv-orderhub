import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, QrCode } from 'lucide-react';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { WhatsAppQRCodeDialog } from './WhatsAppQRCodeDialog';

export function WhatsAppConnectionStatus() {
  const { connected, status, loading, isAuthorized, refresh, getQRCode, startFastPolling, stopFastPolling } = useWhatsAppStatus();
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

  const handleConnect = () => {
    setQrDialogOpen(true);
    startFastPolling();
  };

  const handleQrDialogClose = (open: boolean) => {
    setQrDialogOpen(open);
    if (!open) {
      stopFastPolling();
    }
  };

  const handleConnected = () => {
    stopFastPolling();
    refresh();
  };

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
    <>
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
        
        {!connected && isAuthorized && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleConnect}
          >
            <QrCode className="h-3 w-3 mr-1" />
            Conectar
          </Button>
        )}
        
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

      <WhatsAppQRCodeDialog
        open={qrDialogOpen}
        onOpenChange={handleQrDialogClose}
        onConnected={handleConnected}
        getQRCode={getQRCode}
        checkStatus={refresh}
        isConnected={connected}
      />
    </>
  );
}
