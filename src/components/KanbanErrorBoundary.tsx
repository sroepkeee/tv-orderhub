import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface KanbanErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface KanbanErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary específico para o Kanban
 * Captura erros de renderização e exibe UI de fallback amigável
 */
export class KanbanErrorBoundary extends React.Component<
  KanbanErrorBoundaryProps,
  KanbanErrorBoundaryState
> {
  constructor(props: KanbanErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<KanbanErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("💥 [KanbanErrorBoundary] Capturou erro:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    this.setState({ errorInfo });
    
    // Callback opcional para o componente pai
    this.props.onError?.(error, errorInfo);

    // Log para banco de dados (fire-and-forget)
    this.logErrorToDatabase(error, errorInfo);
  }

  private async logErrorToDatabase(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('user_activity_log').insert({
        user_id: user?.id || '00000000-0000-0000-0000-000000000000',
        action_type: 'error',
        table_name: 'kanban_errors',
        description: `Erro no Kanban: ${error.message}`,
        metadata: {
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack?.substring(0, 500),
          component_stack: errorInfo.componentStack?.substring(0, 500),
          url: window.location.href,
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log("✅ [KanbanErrorBoundary] Erro logado no banco");
    } catch (logError) {
      console.error("⚠️ [KanbanErrorBoundary] Falha ao logar erro:", logError);
    }
  }

  private handleRetry = () => {
    console.log("🔄 [KanbanErrorBoundary] Tentando recuperar...");
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleRefreshPage = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="kanban-error-boundary p-6 flex items-center justify-center min-h-[400px]">
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">
              Erro no Quadro Kanban
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-4">
              <p className="text-sm">
                Ocorreu um erro inesperado ao renderizar o quadro Kanban. 
                Isso pode ser causado por dados inconsistentes ou um problema temporário.
              </p>
              
              {this.state.error && (
                <details className="text-xs bg-destructive/10 p-2 rounded">
                  <summary className="cursor-pointer font-medium">
                    Detalhes técnicos
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={this.handleRetry}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Tentar Novamente
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={this.handleRefreshPage}
                >
                  Recarregar Página
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

export default KanbanErrorBoundary;
