import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, QrCode, RefreshCw, MoreVertical } from 'lucide-react';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { WhatsAppQRCodeDialog } from './WhatsAppQRCodeDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

export function WhatsAppConnectionCard() {
  const { connected, status, loading, isAuthorized, refresh, getQRCode, startFastPolling, stopFastPolling } = useWhatsAppStatus();
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    setQrDialogOpen(true);
  };

  const handleQrDialogClose = () => {
    setQrDialogOpen(false);
    stopFastPolling();
  };

  const handleConnected = () => {
    setQrDialogOpen(false);
    stopFastPolling();
    refresh();
    toast({
      title: 'WhatsApp Conectado',
      description: 'Sua conexão WhatsApp está ativa e funcionando.',
    });
  };

  const handleDisconnect = () => {
    toast({
      title: 'Função em desenvolvimento',
      description: 'A função de desconectar está em desenvolvimento.',
      variant: 'default',
    });
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Imply Frete</CardTitle>
                <Badge variant="secondary" className="mt-1">
                  MEGA API
                </Badge>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDisconnect} disabled={!connected}>
                  Desconectar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({ title: 'Em desenvolvimento' })}>
                  Editar nome
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <div className="flex items-center gap-2">
                {loading ? (
                  <Badge variant="outline">Verificando...</Badge>
                ) : connected ? (
                  <Badge className="bg-green-500 hover:bg-green-600">
                    🟢 Conectado
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    🔴 Desconectado
                  </Badge>
                )}
              </div>
            </div>
            {connected && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Última conexão</p>
                <p className="text-sm font-medium">
                  {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!connected && (
              <Button onClick={handleConnect} className="gap-2">
                <QrCode className="h-4 w-4" />
                Gerar QR Code
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={refresh}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar Status
            </Button>
          </div>

          {status && (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              Status técnico: {status}
            </div>
          )}
        </CardContent>
      </Card>

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
