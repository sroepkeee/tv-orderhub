import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, CheckCircle2, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppQRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
  getQRCode: () => Promise<{ qrcode: string; expiresIn: number } | null>;
  checkStatus: () => Promise<void>;
  isConnected: boolean;
}

export function WhatsAppQRCodeDialog({
  open,
  onOpenChange,
  onConnected,
  getQRCode,
  checkStatus,
  isConnected,
}: WhatsAppQRCodeDialogProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expiresIn, setExpiresIn] = useState(60);
  const [status, setStatus] = useState<'loading' | 'waiting' | 'available' | 'scanning' | 'connected' | 'expired' | 'error'>('loading');
  const { toast } = useToast();

  const loadQRCode = async () => {
    setLoading(true);
    setStatus('loading');
    try {
      const data = await getQRCode();
      
      // Verificar se é status 'waiting' (aguardando QR code do servidor)
      if ((data as any)?.status === 'waiting') {
        setStatus('waiting');
        // Iniciar polling para buscar o QR code
        startWaitingPolling();
      } else if (data?.qrcode) {
        setQrCode(data.qrcode);
        setExpiresIn(data.expiresIn);
        setStatus('available');
        
        // Iniciar polling rápido para detectar conexão
        startConnectionPolling();
      } else {
        setStatus('error');
        toast({
          title: 'Erro ao gerar QR Code',
          description: 'Não foi possível obter o QR Code. Tente novamente.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading QR code:', error);
      setStatus('error');
      toast({
        title: 'Erro',
        description: 'Erro ao carregar QR Code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const startWaitingPolling = () => {
    let attempts = 0;
    const maxAttempts = 10; // 10 tentativas x 3s = 30 segundos

    const pollForQRCode = async () => {
      attempts++;
      console.log(`Polling for QR code (attempt ${attempts}/${maxAttempts})`);
      
      try {
        const data = await getQRCode();
        if (data?.qrcode) {
          console.log('QR code received!');
          setQrCode(data.qrcode);
          setExpiresIn(data.expiresIn);
          setStatus('available');
          startConnectionPolling();
          return true; // Parar polling
        }
      } catch (error) {
        console.error('Error polling for QR code:', error);
      }

      if (attempts >= maxAttempts) {
        console.log('Polling timeout - max attempts reached');
        setStatus('error');
        toast({
          title: 'Timeout',
          description: 'QR Code não foi recebido a tempo. Tente novamente.',
          variant: 'destructive',
        });
        return true; // Parar polling
      }

      return false; // Continuar polling
    };

    const pollInterval = setInterval(async () => {
      const shouldStop = await pollForQRCode();
      if (shouldStop) {
        clearInterval(pollInterval);
      }
    }, 3000); // Polling a cada 3 segundos
  };

  const startConnectionPolling = () => {
    const pollInterval = setInterval(async () => {
      await checkStatus();
    }, 2000); // Polling rápido a cada 2 segundos

    // Limpar após 60 segundos (expiração do QR)
    setTimeout(() => {
      clearInterval(pollInterval);
      if (status === 'available') {
        setStatus('expired');
      }
    }, 60000);

    return () => clearInterval(pollInterval);
  };

  // Countdown de expiração
  useEffect(() => {
    if (status !== 'available') return;

    const countdown = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          setStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [status]);

  // Detectar quando conectou
  useEffect(() => {
    if (isConnected && status !== 'connected') {
      setStatus('connected');
      toast({
        title: 'WhatsApp Conectado!',
        description: 'Sua conta foi conectada com sucesso.',
      });
      
      // Fechar dialog após 2 segundos
      setTimeout(() => {
        onConnected();
        onOpenChange(false);
      }, 2000);
    }
  }, [isConnected, status, onConnected, onOpenChange, toast]);

  // Carregar QR quando dialog abre
  useEffect(() => {
    if (open && !isConnected) {
      loadQRCode();
    }
  }, [open, isConnected]);

  const handleRefresh = () => {
    setQrCode(null);
    loadQRCode();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Conectar WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-6">
          {/* QR Code ou estados */}
          <div className="relative w-64 h-64 flex items-center justify-center bg-muted rounded-lg border-2 border-border">
            {status === 'loading' && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}

            {status === 'waiting' && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Solicitando QR Code...</p>
                <p className="text-xs text-muted-foreground">
                  Aguarde, o QR será gerado em instantes
                </p>
              </div>
            )}

            {status === 'available' && qrCode && (
              <img 
                src={qrCode} 
                alt="WhatsApp QR Code" 
                className="w-full h-full object-contain p-4"
              />
            )}

            {status === 'scanning' && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Conectando...</p>
              </div>
            )}

            {status === 'connected' && (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Conectado com sucesso!
                </p>
              </div>
            )}

            {status === 'expired' && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-destructive font-medium">QR Code expirado</p>
                <Button onClick={handleRefresh} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Gerar novo QR Code
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
                  <RefreshCw className="h-8 w-8 text-destructive" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">Não foi possível gerar o QR Code</p>
                  <p className="text-xs text-muted-foreground">
                    Verifique se o webhook está configurado no painel Mega API
                  </p>
                  <div className="mt-4 p-3 bg-muted rounded-lg text-left space-y-2">
                    <div>
                      <p className="text-xs font-medium mb-1">URL do Webhook:</p>
                      <code className="text-xs break-all block bg-background p-2 rounded border">
                        https://wejkyyjhckdlttieuyku.supabase.co/functions/v1/mega-api-webhook
                      </code>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1">Eventos necessários:</p>
                      <div className="flex gap-2">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">qrcode</span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">connection.update</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button onClick={handleRefresh} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
            )}
          </div>

          {/* Instruções */}
          {status === 'available' && (
            <>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="h-5 w-5" />
                <p className="text-sm">Escaneie com o WhatsApp do celular</p>
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Status: Aguardando escaneamento...
                </p>
                <p className="text-xs text-muted-foreground">
                  QR expira em: <span className="font-mono font-semibold">{expiresIn}s</span>
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar QR Code
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
