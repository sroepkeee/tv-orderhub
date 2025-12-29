import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, RotateCcw, AlertCircle, LogOut, FileText, ChevronDown, ChevronUp, FlaskConical, X } from 'lucide-react';
import { useTechnicianPortal, TechnicianOrder } from '@/hooks/useTechnicianPortal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OrderReturnForm } from '@/components/technicians/OrderReturnForm';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function TechnicianPortal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizationId } = useOrganizationId();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<TechnicianOrder | null>(null);

  const { 
    userProfile, 
    orders, 
    loading, 
    totalItems,
    fetchOrders,
    isTestMode,
    testingAsDocument,
    exitTestMode
  } = useTechnicianPortal();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const toggleOrderExpanded = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const handleRequestReturn = (order: TechnicianOrder) => {
    setSelectedOrder(order);
    setReturnDialogOpen(true);
  };

  const handleReturnSuccess = () => {
    setReturnDialogOpen(false);
    setSelectedOrder(null);
    fetchOrders();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando suas remessas...</p>
        </div>
      </div>
    );
  }

  // Se não tem perfil ou não é técnico com orders
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Não foi possível carregar seu perfil. 
              Por favor, faça login novamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSignOut} className="w-full">
              Fazer Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getOrderTypeBadge = (orderType: string) => {
    switch (orderType) {
      case 'remessa_conserto':
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">Conserto</Badge>;
      case 'remessa_garantia':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Garantia</Badge>;
      default:
        return <Badge variant="outline">{orderType}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_transit':
        return <Badge className="bg-blue-500">Em Trânsito</Badge>;
      case 'received':
        return <Badge className="bg-green-500">Recebido</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500">Em Andamento</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Banner de modo teste */}
      {isTestMode && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-yellow-500/10 border-yellow-500/30">
          <FlaskConical className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span className="text-yellow-700 dark:text-yellow-400">
              <strong>Modo Teste</strong> — Visualizando remessas do documento: <code className="bg-yellow-500/20 px-1.5 py-0.5 rounded">{testingAsDocument}</code>
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exitTestMode}
              className="border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/20"
            >
              <X className="h-4 w-4 mr-1" />
              Sair do Modo Teste
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header simplificado */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Portal do Técnico</h1>
              <p className="text-sm text-muted-foreground">
                {isTestMode ? `Testando como: ${testingAsDocument}` : userProfile.full_name}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{totalItems} itens</p>
                <p className="text-xs text-muted-foreground">em {orders.length} remessa(s)</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Itens em Posse</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
              <p className="text-xs text-muted-foreground">
                em {orders.length} remessa(s) ativa(s)
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
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
        </div>

        {/* Lista de remessas */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Suas Remessas
          </h2>

          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma remessa encontrada vinculada ao seu cadastro.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Verifique se seu nome ou documento está correto nas notas fiscais.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Collapsible
                  key={order.id}
                  open={expandedOrders.has(order.id)}
                  onOpenChange={() => toggleOrderExpanded(order.id)}
                >
                  <Card>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{order.order_number}</span>
                                {getOrderTypeBadge(order.order_type)}
                                {getStatusBadge(order.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-medium">{order.items_count} itens</p>
                            </div>
                            {expandedOrders.has(order.id) ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead className="text-center">Qtd</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {order.items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-mono text-sm">
                                    {item.item_code}
                                  </TableCell>
                                  <TableCell>{item.item_description}</TableCell>
                                  <TableCell className="text-center">{item.quantity}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        
                        <div className="flex justify-end mt-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRequestReturn(order)}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Solicitar Retorno
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Return Dialog */}
      {selectedOrder && userProfile && (
        <OrderReturnForm
          order={selectedOrder}
          userProfileId={userProfile.id}
          organizationId={organizationId}
          open={returnDialogOpen}
          onClose={() => {
            setReturnDialogOpen(false);
            setSelectedOrder(null);
          }}
          onSuccess={handleReturnSuccess}
        />
      )}
    </div>
  );
}