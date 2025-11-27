import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MessageCircle, QrCode, RefreshCw, MoreVertical, Pencil } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export function WhatsAppConnectionCard() {
  const { 
    connected, status, loading, isAuthorized, 
    refresh, getQRCode, startFastPolling, stopFastPolling,
    phoneNumber, connectedAt, instanceName,
    disconnect, updateInstanceName
  } = useWhatsAppStatus();
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
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

  const handleDisconnectClick = () => {
    setDisconnectDialogOpen(true);
  };

  const handleDisconnectConfirm = async () => {
    setIsDisconnecting(true);
    const success = await disconnect();
    setIsDisconnecting(false);
    if (success) {
      setDisconnectDialogOpen(false);
    }
  };

  const handleEditNameClick = () => {
    setEditingName(instanceName || 'Imply Frete');
    setEditNameDialogOpen(true);
  };

  const handleSaveName = async () => {
    if (!editingName.trim()) {
      toast({
        title: 'Nome inválido',
        description: 'Por favor, insira um nome válido.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingName(true);
    const success = await updateInstanceName(editingName.trim());
    setIsSavingName(false);
    
    if (success) {
      setEditNameDialogOpen(false);
    }
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
                <CardTitle className="text-lg">{instanceName || 'Imply Frete'}</CardTitle>
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
                <DropdownMenuItem 
                  onClick={handleDisconnectClick} 
                  disabled={!connected || isDisconnecting}
                >
                  Desconectar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleEditNameClick}>
                  <Pencil className="h-4 w-4 mr-2" />
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
            
            {connected && phoneNumber && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Número</p>
                <p className="text-sm font-medium font-mono">
                  +{phoneNumber.slice(0, 2)} ({phoneNumber.slice(2, 4)}) {phoneNumber.slice(4, 9)}-{phoneNumber.slice(9)}
                </p>
              </div>
            )}
            
            {connected && connectedAt && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Última conexão</p>
                <p className="text-sm font-medium">
                  {format(connectedAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
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

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá desconectar a conta WhatsApp atual ({instanceName || 'Imply Frete'}). 
              Você precisará escanear o QR Code novamente para reconectar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDisconnectConfirm}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editNameDialogOpen} onOpenChange={setEditNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nome da Instância</DialogTitle>
            <DialogDescription>
              Escolha um nome personalizado para identificar esta conexão WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="instance-name" className="text-sm font-medium">
                Nome da Instância
              </label>
              <Input
                id="instance-name"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="Ex: Imply Frete"
                disabled={isSavingName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveName();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditNameDialogOpen(false)}
              disabled={isSavingName}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveName}
              disabled={isSavingName || !editingName.trim()}
            >
              {isSavingName ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
