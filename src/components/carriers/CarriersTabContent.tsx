import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Loader2, Plus, BarChart3, Package, Truck, CheckCircle } from 'lucide-react';
import { FreightQuoteDialog } from './FreightQuoteDialog';
import { FreightQuoteCard } from './FreightQuoteCard';
import { QuoteComparisonTable } from './QuoteComparisonTable';
import { QuoteSummaryTable } from './QuoteSummaryTable';
import { QuoteApprovalTable } from './QuoteApprovalTable';
import { useFreightQuotes } from '@/hooks/useFreightQuotes';
import { Order } from '@/components/Dashboard';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface CarriersTabContentProps {
  order: Order;
  freightModality: string;
  freightType: string;
  carrierName: string;
  trackingCode: string;
  onFreightChange: (field: string, value: string) => void;
  isSaving?: boolean;
}

export function CarriersTabContent({ 
  order, 
  freightModality, 
  freightType, 
  carrierName, 
  trackingCode, 
  onFreightChange, 
  isSaving 
}: CarriersTabContentProps) {
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const { quotes, responses, loadQuotesByOrder, selectQuote, rejectQuote, deleteQuote, loading } = useFreightQuotes();

  useEffect(() => {
    if (order.id) {
      loadQuotesByOrder(order.id);
    }
  }, [order.id]);

  const respondedQuotes = quotes.filter(q => q.status === 'responded' || q.status === 'accepted');
  const pendingQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'pending');

  return (
    <>
      <div className="space-y-6">
        {/* Informações de Frete e Transporte - TOPO */}
        <Card className="border-2 border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50/50 to-emerald-50/30 dark:from-teal-950/30 dark:to-emerald-950/20">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <h3 className="text-lg font-semibold">Informações de Frete e Transporte</h3>
              {isSaving && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Salvando...
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="freight_modality">Modalidade de Frete</Label>
                <Select 
                  value={freightModality} 
                  onValueChange={(value) => onFreightChange('freight_modality', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="FOB ou CIF" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOB">FOB - Free On Board</SelectItem>
                    <SelectItem value="CIF">CIF - Cost, Insurance and Freight</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="freight_type">Modo de Envio</Label>
                <Select 
                  value={freightType} 
                  onValueChange={(value) => onFreightChange('freight_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aereo">Aéreo</SelectItem>
                    <SelectItem value="transportadora">Transportadora</SelectItem>
                    <SelectItem value="correios">Correios</SelectItem>
                    <SelectItem value="frota_propria">Frota Própria</SelectItem>
                    <SelectItem value="retirada">Retirada no Local</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="carrier_name">Nome da Transportadora/Empresa</Label>
                <Input 
                  value={carrierName}
                  onChange={(e) => onFreightChange('carrier_name', e.target.value)}
                  placeholder="Ex: Azul Cargo, Correios, Jadlog" 
                  maxLength={100}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                />
              </div>

              <div>
                <Label htmlFor="tracking_code">Código de Rastreamento</Label>
                <Input 
                  value={trackingCode}
                  onChange={(e) => onFreightChange('tracking_code', e.target.value)}
                  placeholder="Ex: BR123456789BR" 
                  maxLength={100}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                />
              </div>
            </div>

            {/* Resumo Visual quando preenchido */}
            {(freightType || freightModality) && (
              <Card className="p-3 bg-white/80 dark:bg-gray-900/80 border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  {freightModality && (
                    <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-300">
                      {freightModality}
                    </Badge>
                  )}
                  {freightType && (
                    <>
                      {freightModality && <span className="text-muted-foreground">•</span>}
                      <span className="font-medium">
                        Modo: {freightType === "aereo" ? "Aéreo" : 
                               freightType === "transportadora" ? "Transportadora" : 
                               freightType === "correios" ? "Correios" : 
                               freightType === "frota_propria" ? "Frota Própria" : 
                               "Retirada no Local"}
                      </span>
                    </>
                  )}
                  {carrierName && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <Truck className="h-3.5 w-3.5 text-teal-600" />
                      <span>{carrierName}</span>
                    </>
                  )}
                  {trackingCode && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-mono text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                        {trackingCode}
                      </span>
                    </>
                  )}
                </div>
              </Card>
            )}
          </div>
        </Card>

        {/* Gestão de Frete e Cotações */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🚚 Gestão de Frete e Cotações
          </h3>
          <Button onClick={() => setShowQuoteDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Solicitar Nova Cotação
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : quotes.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <p className="text-lg mb-2">Nenhuma cotação solicitada</p>
            <p className="text-sm">Clique em "Solicitar Nova Cotação" para começar</p>
          </Card>
        ) : (
          <>
            {/* Status Summary */}
            <Card className="p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Cotações</p>
                    <p className="text-2xl font-bold">{quotes.length}</p>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div>
                    <p className="text-sm text-muted-foreground">Respondidas</p>
                    <p className="text-2xl font-bold text-green-600">{respondedQuotes.length}</p>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div>
                    <p className="text-sm text-muted-foreground">Aguardando</p>
                    <p className="text-2xl font-bold text-yellow-600">{pendingQuotes.length}</p>
                  </div>
                </div>
                
                {respondedQuotes.length > 1 && (
                  <Button 
                    variant="outline" 
                    onClick={() => setShowComparison(!showComparison)}
                    className="gap-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    {showComparison ? 'Ocultar' : 'Ver'} Comparação Detalhada
                  </Button>
                )}
              </div>
            </Card>

            {/* Comparison Table */}
            {showComparison && respondedQuotes.length > 0 && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-4">📊 Comparação de Cotações</h4>
                <QuoteComparisonTable
                  quotes={quotes}
                  responses={responses}
                  onSelectQuote={selectQuote}
                />
              </div>
            )}

            {/* Quotes List */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">Cotações Enviadas</h4>
              <ScrollArea className="h-[280px]">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pr-4">
                  {quotes.map((quote) => {
                    const quoteResponses = responses.filter(r => r.quote_id === quote.id);
                    return (
                      <FreightQuoteCard
                        key={quote.id}
                        quote={quote}
                        responses={quoteResponses}
                        onSelectQuote={selectQuote}
                        onDeleteQuote={async (quoteId) => {
                          await deleteQuote(quoteId, order.id);
                        }}
                        orderId={order.id}
                        orderNumber={order.orderNumber}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Approval Table Section - Bottom Area - Always Visible */}
            <div className="space-y-2 pt-2 border-t">
              <h3 className="text-lg font-semibold">📋 Aprovação de Cotações</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Compare as cotações recebidas e aprove a melhor opção para este pedido
              </p>
              <QuoteApprovalTable
                quotes={quotes}
                responses={responses}
                onApprove={async (quoteId, responseId) => {
                  await selectQuote(quoteId, responseId);
                  await loadQuotesByOrder(order.id);
                }}
                onReject={async (quoteId, responseId) => {
                  await rejectQuote(quoteId, responseId);
                  await loadQuotesByOrder(order.id);
                }}
                onDeleteQuote={async (quoteId) => {
                  await deleteQuote(quoteId, order.id);
                }}
              />
            </div>
          </>
        )}
      </div>

      <FreightQuoteDialog
        open={showQuoteDialog}
        onOpenChange={setShowQuoteDialog}
        order={order}
        onQuoteRequested={() => loadQuotesByOrder(order.id)}
      />
    </>
  );
}
