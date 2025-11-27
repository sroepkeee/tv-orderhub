import { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { Skeleton } from '@/components/ui/skeleton';

interface WhatsAppAuthGuardProps {
  children: ReactNode;
  adminBypass?: boolean;
}

export function WhatsAppAuthGuard({ children, adminBypass = false }: WhatsAppAuthGuardProps) {
  const { isAuthorized, loading } = useWhatsAppStatus();

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAuthorized && !adminBypass) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Alert className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acesso WhatsApp Não Autorizado</AlertTitle>
          <AlertDescription className="mt-2">
            Você não está autorizado a enviar mensagens via WhatsApp.
            <br />
            <br />
            Apenas usuários autorizados podem enviar mensagens diretamente.
            <br />
            Entre em contato com o administrador do sistema para solicitar acesso.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
