import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, ArrowLeft } from "lucide-react";
import { PurchaseMetricsCards } from "@/components/purchases/PurchaseMetricsCards";
import { PurchaseRequestsTable } from "@/components/purchases/PurchaseRequestsTable";
import { usePurchaseRequests } from "@/hooks/usePurchaseRequests";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { PurchaseRequest } from "@/types/purchases";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Purchases = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAdminAuth();
  const {
    requests,
    loading,
    metrics,
    createAutomaticRequest,
    updateRequestStatus,
    deleteRequest,
  } = usePurchaseRequests();

  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);

  const handleCreateAutomatic = async () => {
    const request = await createAutomaticRequest();
    if (request) {
      // TODO: Abrir dialog de edição
      toast.info('Solicitação criada! Dialog de edição em desenvolvimento.');
    }
  };

  const handleView = (request: PurchaseRequest) => {
    setSelectedRequest(request);
    // TODO: Abrir dialog de visualização
    toast.info('Dialog de visualização em desenvolvimento.');
  };

  const handleEdit = (request: PurchaseRequest) => {
    setSelectedRequest(request);
    // TODO: Abrir dialog de edição
    toast.info('Dialog de edição em desenvolvimento.');
  };

  const handleDelete = async (requestId: string) => {
    if (confirm('Tem certeza que deseja excluir esta solicitação?')) {
      await deleteRequest(requestId);
    }
  };

  const handleApprove = (request: PurchaseRequest) => {
    setSelectedRequest(request);
    // TODO: Abrir dialog de aprovação
    toast.info('Dialog de aprovação em desenvolvimento.');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">🛒 Módulo de Compras</h1>
              <p className="text-muted-foreground">
                Gerencie solicitações de compra e acompanhe aprovações
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleCreateAutomatic}
              disabled={loading || metrics.items_awaiting_request === 0}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Gerar Solicitação Automática
              {metrics.items_awaiting_request > 0 && (
                <span className="ml-1 bg-primary-foreground text-primary px-2 py-0.5 rounded-full text-xs font-semibold">
                  {metrics.items_awaiting_request}
                </span>
              )}
            </Button>
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Solicitação Manual
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <PurchaseMetricsCards metrics={metrics} />

        {/* Requests Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">📋 Solicitações de Compra</h2>
            {/* TODO: Add filters */}
          </div>

          <PurchaseRequestsTable
            requests={requests}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onApprove={handleApprove}
            canApprove={isAdmin}
          />
        </div>
      </div>
    </div>
  );
};

export default Purchases;
