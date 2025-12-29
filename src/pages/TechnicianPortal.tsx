import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, RotateCcw, ArrowLeftRight, AlertCircle } from 'lucide-react';
import { TechnicianItemsList } from '@/components/technicians/TechnicianItemsList';
import { TechnicianReturnForm } from '@/components/technicians/TechnicianReturnForm';
import { TechnicianTransferDialog } from '@/components/technicians/TechnicianTransferDialog';
import { useTechnicianPortal } from '@/hooks/useTechnicianPortal';

export default function TechnicianPortal() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);

  const { 
    technicianInfo, 
    pendingItems, 
    loading, 
    fetchPendingItems 
  } = useTechnicianPortal();

  const handleStartReturn = (dispatchId: string) => {
    setSelectedDispatchId(dispatchId);
    setShowReturnForm(true);
  };

  const handleStartTransfer = (dispatchId: string) => {
    setSelectedDispatchId(dispatchId);
    setShowTransferDialog(true);
  };

  const handleReturnSuccess = () => {
    setShowReturnForm(false);
    setSelectedDispatchId(null);
    fetchPendingItems();
  };

  const handleTransferSuccess = () => {
    setShowTransferDialog(false);
    setSelectedDispatchId(null);
    fetchPendingItems();
  };

  // Se não for técnico nem admin, mostrar mensagem de acesso negado
  if (!loading && !technicianInfo && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Você não está cadastrado como técnico no sistema. 
              Entre em contato com o administrador.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const totalPendingItems = pendingItems.reduce(
    (acc, dispatch) => acc + (dispatch.items_pending || 0), 
    0
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header simplificado */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Portal do Técnico</h1>
              {technicianInfo && (
                <p className="text-sm text-muted-foreground">
                  {technicianInfo.name} • {technicianInfo.city}/{technicianInfo.state}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-medium">{totalPendingItems} itens</p>
                <p className="text-xs text-muted-foreground">em sua posse</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Itens em Posse</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPendingItems}</div>
              <p className="text-xs text-muted-foreground">
                em {pendingItems.length} remessa(s)
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => pendingItems[0] && handleStartReturn(pendingItems[0].id)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solicitar Retorno</CardTitle>
              <RotateCcw className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Devolver materiais para o armazém
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => pendingItems[0] && handleStartTransfer(pendingItems[0].id)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transferir para Técnico</CardTitle>
              <ArrowLeftRight className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Enviar para outro técnico
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de itens pendentes */}
        <TechnicianItemsList 
          dispatches={pendingItems}
          loading={loading}
          onStartReturn={handleStartReturn}
          onStartTransfer={handleStartTransfer}
        />
      </main>

      {/* Formulário de retorno */}
      {showReturnForm && selectedDispatchId && (
        <TechnicianReturnForm 
          dispatchId={selectedDispatchId}
          open={showReturnForm}
          onClose={() => setShowReturnForm(false)}
          onSuccess={handleReturnSuccess}
        />
      )}

      {/* Dialog de transferência */}
      {showTransferDialog && selectedDispatchId && (
        <TechnicianTransferDialog 
          dispatchId={selectedDispatchId}
          open={showTransferDialog}
          onClose={() => setShowTransferDialog(false)}
          onSuccess={handleTransferSuccess}
        />
      )}
    </div>
  );
}
