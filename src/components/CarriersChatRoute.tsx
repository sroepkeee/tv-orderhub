import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePhaseAuthorization } from "@/hooks/usePhaseAuthorization";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquareOff } from "lucide-react";

interface CarriersChatRouteProps {
  children: ReactNode;
}

export const CarriersChatRoute = ({ children }: CarriersChatRouteProps) => {
  const { canViewPhase, loading } = usePhaseAuthorization();

  // Aguardar carregamento das permissões
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Verificar se tem permissão para acessar carriers_chat
  const hasAccess = canViewPhase('carriers_chat');

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <MessageSquareOff className="h-16 w-16 text-muted-foreground" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Acesso Negado</h2>
            <p className="text-muted-foreground max-w-md">
              Você não tem permissão para acessar o módulo de conversas com transportadoras.
              Entre em contato com o administrador do sistema para solicitar acesso.
            </p>
          </div>
        </div>
        <Button onClick={() => window.history.back()} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
