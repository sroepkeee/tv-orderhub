import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  CheckCircle, 
  XCircle, 
  MessageSquare, 
  Clock, 
  Package,
  MapPin,
  Calendar,
  User,
  Phone,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChangeRequest {
  id: string;
  order_id: string;
  customer_contact_id: string | null;
  requested_by_phone: string;
  requested_by_name: string | null;
  change_type: string;
  description: string;
  original_value: string | null;
  requested_value: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  orders?: {
    order_number: string;
    customer_name: string;
    status: string;
    delivery_date: string | null;
  };
  customer_contacts?: {
    customer_name: string;
  };
}

const changeTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  'delivery_address': { label: 'Alteração de Endereço', icon: <MapPin className="h-4 w-4" /> },
  'delivery_date': { label: 'Alteração de Data', icon: <Calendar className="h-4 w-4" /> },
  'add_item': { label: 'Adicionar Item', icon: <Package className="h-4 w-4" /> },
  'remove_item': { label: 'Remover Item', icon: <Package className="h-4 w-4" /> },
  'change_quantity': { label: 'Alterar Quantidade', icon: <Package className="h-4 w-4" /> },
  'cancel_order': { label: 'Cancelar Pedido', icon: <XCircle className="h-4 w-4" /> },
  'change_contact': { label: 'Alterar Contato', icon: <User className="h-4 w-4" /> },
  'other': { label: 'Outra Solicitação', icon: <MessageSquare className="h-4 w-4" /> },
};

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'pending': { label: 'Pendente', variant: 'secondary' },
  'approved': { label: 'Aprovado', variant: 'default' },
  'rejected': { label: 'Rejeitado', variant: 'destructive' },
  'applied': { label: 'Aplicado', variant: 'outline' },
};

export function ChangeRequestsQueue() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; decision: 'approved' | 'rejected' | null }>({
    open: false,
    decision: null,
  });
  const [activeTab, setActiveTab] = useState('pending');

  // Buscar solicitações
  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ['change-requests', activeTab],
    queryFn: async () => {
      let query = supabase
        .from('customer_change_requests')
        .select(`
          *,
          orders!inner(order_number, customer_name, status, delivery_date),
          customer_contacts(customer_name)
        `)
        .order('created_at', { ascending: false });

      if (activeTab === 'pending') {
        query = query.eq('status', 'pending');
      } else if (activeTab === 'processed') {
        query = query.in('status', ['approved', 'rejected', 'applied']);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as ChangeRequest[];
    },
  });

  // Mutation para processar solicitação
  const processRequest = useMutation({
    mutationFn: async ({ requestId, decision, notes }: { requestId: string; decision: 'approved' | 'rejected'; notes: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.functions.invoke('process-change-request', {
        body: {
          requestId,
          decision,
          reviewNotes: notes,
          userId: user.id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.decision === 'approved' 
          ? 'Solicitação aprovada! Cliente será notificado.'
          : 'Solicitação rejeitada. Cliente será notificado.'
      );
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      setSelectedRequest(null);
      setReviewNotes('');
      setConfirmDialog({ open: false, decision: null });
    },
    onError: (error) => {
      toast.error('Erro ao processar solicitação: ' + error.message);
    },
  });

  const handleDecision = (decision: 'approved' | 'rejected') => {
    if (!selectedRequest) return;
    setConfirmDialog({ open: true, decision });
  };

  const confirmDecision = () => {
    if (!selectedRequest || !confirmDialog.decision) return;
    
    processRequest.mutate({
      requestId: selectedRequest.id,
      decision: confirmDialog.decision,
      notes: reviewNotes,
    });
  };

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Solicitações de Alteração
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie solicitações de alteração feitas por clientes via WhatsApp
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Lista de Solicitações */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pending" className="gap-2">
                    <Clock className="h-3 w-3" />
                    Pendentes
                  </TabsTrigger>
                  <TabsTrigger value="processed" className="gap-2">
                    <CheckCheck className="h-3 w-3" />
                    Processadas
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : requests?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma solicitação {activeTab === 'pending' ? 'pendente' : 'processada'}</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {requests?.map((request) => {
                      const typeInfo = changeTypeLabels[request.change_type] || changeTypeLabels['other'];
                      const statusInfo = statusLabels[request.status] || statusLabels['pending'];
                      
                      return (
                        <div
                          key={request.id}
                          className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedRequest?.id === request.id ? 'bg-muted' : ''
                          }`}
                          onClick={() => setSelectedRequest(request)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {typeInfo.icon}
                              <span className="font-medium text-sm">{typeInfo.label}</span>
                            </div>
                            <Badge variant={statusInfo.variant} className="text-xs">
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Pedido #{request.orders?.order_number}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(request.created_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Detalhes da Solicitação */}
        <div className="lg:col-span-2">
          {selectedRequest ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {changeTypeLabels[selectedRequest.change_type]?.icon}
                      {changeTypeLabels[selectedRequest.change_type]?.label || 'Solicitação'}
                    </CardTitle>
                    <CardDescription>
                      Pedido #{selectedRequest.orders?.order_number} - {selectedRequest.orders?.customer_name}
                    </CardDescription>
                  </div>
                  <Badge variant={statusLabels[selectedRequest.status]?.variant || 'secondary'}>
                    {statusLabels[selectedRequest.status]?.label || selectedRequest.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Informações do Solicitante */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {selectedRequest.requested_by_name || selectedRequest.customer_contacts?.customer_name || 'Cliente'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{selectedRequest.requested_by_phone}</span>
                  </div>
                </div>

                {/* Descrição da Solicitação */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Mensagem do Cliente</h4>
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    "{selectedRequest.description}"
                  </div>
                </div>

                {/* Valores Original e Solicitado */}
                {(selectedRequest.original_value || selectedRequest.requested_value) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedRequest.original_value && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">Valor Atual</h4>
                        <div className="p-2 bg-destructive/10 rounded text-sm">
                          {selectedRequest.original_value}
                        </div>
                      </div>
                    )}
                    {selectedRequest.requested_value && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">Valor Solicitado</h4>
                        <div className="p-2 bg-primary/10 rounded text-sm">
                          {selectedRequest.requested_value}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Ações de Aprovação */}
                {selectedRequest.status === 'pending' && (
                  <>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Observações (opcional)</h4>
                      <Textarea
                        placeholder="Adicione uma observação para o cliente..."
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1"
                        onClick={() => handleDecision('approved')}
                        disabled={processRequest.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Aprovar
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDecision('rejected')}
                        disabled={processRequest.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Rejeitar
                      </Button>
                    </div>
                  </>
                )}

                {/* Histórico de Revisão */}
                {selectedRequest.reviewed_at && (
                  <div className="p-3 border rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Revisão</h4>
                    <div className="text-sm text-muted-foreground">
                      Processado em {new Date(selectedRequest.reviewed_at).toLocaleString('pt-BR')}
                    </div>
                    {selectedRequest.review_notes && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Observação:</span> {selectedRequest.review_notes}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-30" />
                <p>Selecione uma solicitação para ver os detalhes</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Diálogo de Confirmação */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmDialog.decision === 'approved' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              Confirmar {confirmDialog.decision === 'approved' ? 'Aprovação' : 'Rejeição'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.decision === 'approved' 
                ? 'A solicitação será aprovada e o cliente será notificado via WhatsApp.'
                : 'A solicitação será rejeitada e o cliente será notificado via WhatsApp.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processRequest.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDecision}
              disabled={processRequest.isPending}
              className={confirmDialog.decision === 'rejected' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {processRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
