import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Loader2, Plus, BarChart3 } from 'lucide-react';
import { FreightQuoteDialog } from './FreightQuoteDialog';
import { FreightQuoteCard } from './FreightQuoteCard';
import { QuoteComparisonTable } from './QuoteComparisonTable';
import { QuoteSummaryTable } from './QuoteSummaryTable';
import { QuoteApprovalTable } from './QuoteApprovalTable';
import { useFreightQuotes } from '@/hooks/useFreightQuotes';
import { Order } from '@/components/Dashboard';

interface CarriersTabContentProps {
  order: Order;
}

export function CarriersTabContent({ order }: CarriersTabContentProps) {
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const { quotes, responses, loadQuotesByOrder, selectQuote, rejectQuote, loading } = useFreightQuotes();

  useEffect(() => {
    if (order.id) {
      loadQuotesByOrder(order.id);
    }
  }, [order.id]);

  const respondedQuotes = quotes.filter(q => q.status === 'responded' || q.status === 'accepted');
  const pendingQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'pending');

  return (
    <>
      <div className="space-y-4">
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
            {/* Quote Summary Table */}
            {respondedQuotes.length > 0 && (
              <QuoteSummaryTable 
                quotes={quotes}
                responses={responses}
                onSelectQuote={selectQuote}
              />
            )}

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

            {/* Approval Table Section */}
            {respondedQuotes.length > 0 && (
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
              />
            )}

            {/* Quotes List */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {quotes.map((quote) => {
                  const quoteResponses = responses.filter(r => r.quote_id === quote.id);
                  return (
                    <FreightQuoteCard
                      key={quote.id}
                      quote={quote}
                      responses={quoteResponses}
                      onSelectQuote={selectQuote}
                      orderId={order.id}
                    />
                  );
                })}
              </div>
            </ScrollArea>
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
