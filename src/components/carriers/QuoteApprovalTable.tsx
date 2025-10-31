import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, Trophy, AlertTriangle, Clock } from 'lucide-react';
import { FreightQuote, FreightQuoteResponse } from '@/types/carriers';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QuoteApprovalTableProps {
  quotes: FreightQuote[];
  responses: FreightQuoteResponse[];
  onApprove: (quoteId: string, responseId: string) => Promise<void>;
  onReject: (quoteId: string, responseId: string) => Promise<void>;
}

export function QuoteApprovalTable({ 
  quotes, 
  responses,
  onApprove,
  onReject 
}: QuoteApprovalTableProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Combina quotes com suas respostas (inclui cotações sem resposta)
  const quotesWithResponses = quotes
    .map(quote => {
      const quoteResponses = responses.filter(r => r.quote_id === quote.id);
      const bestResponse = quoteResponses.reduce((best, current) => {
        if (!best) return current;
        if (!current.freight_value) return best;
        if (!best.freight_value) return current;
        return current.freight_value < best.freight_value ? current : best;
      }, quoteResponses[0]) || null;
      
      return {
        quote,
        response: bestResponse,
        allResponses: quoteResponses,
      };
    })
    // Ordena: respondidas com valor primeiro (por valor), depois pendentes
    .sort((a, b) => {
      const aValue = a.response?.freight_value || Infinity;
      const bValue = b.response?.freight_value || Infinity;
      return aValue - bValue;
    });

  // Encontra a melhor cotação (menor valor) entre as respondidas
  const respondedQuotes = quotesWithResponses.filter(q => q.response?.freight_value);
  const bestQuote = respondedQuotes[0];
  const hasMinimumQuotes = respondedQuotes.length >= 3;
  const pendingQuotes = quotesWithResponses.filter(q => !q.response?.freight_value);

  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleApprove = async (quoteId: string, responseId: string) => {
    setProcessingId(responseId);
    try {
      await onApprove(quoteId, responseId);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (quoteId: string, responseId: string) => {
    setProcessingId(responseId);
    try {
      await onReject(quoteId, responseId);
    } finally {
      setProcessingId(null);
    }
  };

  // Renderizar placeholder rows se não houver dados
  const showPlaceholder = quotesWithResponses.length === 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              🎯 Tabela de Aprovação de Cotações
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {showPlaceholder 
                ? 'Nenhuma cotação solicitada ainda' 
                : `Análise comparativa • ${respondedQuotes.length} respondida(s) • ${pendingQuotes.length} aguardando`}
            </p>
          </div>
          {!showPlaceholder && (
            <>
              {!hasMinimumQuotes && (
                <Badge variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-50">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Mínimo 3 cotações necessárias ({respondedQuotes.length}/3)
                </Badge>
              )}
              {hasMinimumQuotes && (
                <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Pronto para aprovação
                </Badge>
              )}
            </>
          )}
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-green-600 hover:bg-green-600">
                <TableHead className="text-white font-semibold text-xs">Código</TableHead>
                <TableHead className="text-white font-semibold text-xs">Data</TableHead>
                <TableHead className="text-white font-semibold text-xs">Origem</TableHead>
                <TableHead className="text-white font-semibold text-xs">Transportadora</TableHead>
                <TableHead className="text-white font-semibold text-xs">Valor</TableHead>
                <TableHead className="text-white font-semibold text-xs">Prazo</TableHead>
                <TableHead className="text-white font-semibold text-xs">Vol</TableHead>
                <TableHead className="text-white font-semibold text-xs">Peso/Kg</TableHead>
                <TableHead className="text-white font-semibold text-xs">Valor p/km</TableHead>
                <TableHead className="text-white font-semibold text-xs">Saída</TableHead>
                <TableHead className="text-white font-semibold text-xs">Destino</TableHead>
                <TableHead className="text-white font-semibold text-xs">Tipo</TableHead>
                <TableHead className="text-white font-semibold text-xs">Status</TableHead>
                <TableHead className="text-white font-semibold text-xs text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showPlaceholder ? (
                // Mensagem quando realmente não há nenhuma cotação
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                    Nenhuma cotação solicitada ainda. Clique em "Solicitar Nova Cotação" para começar.
                  </TableCell>
                </TableRow>
              ) : (
                // Dados reais quando houver cotações
                quotesWithResponses.map((item, index) => {
                  const hasResponse = !!item.response?.freight_value;
                  const isBest = hasResponse && item === bestQuote;
                  const isSelected = item.response?.is_selected;
                  const isProcessing = processingId === item.response?.id;
                  
                  // Extrair dados do quote_request_data (sempre disponível)
                  const requestData = item.quote.quote_request_data;
                  const volumes = requestData?.cargo?.volumes || 0;
                  const weight = requestData?.cargo?.total_weight_kg || 0;
                  const origin = requestData?.sender?.address || 'N/A';
                  const originCity = origin.split(',')[1]?.trim() || origin.split(',')[0]?.trim() || 'N/A';
                  const destinationCity = requestData?.recipient?.city || 'N/A';
                  const destinationState = requestData?.recipient?.state || 'N/A';
                  const productType = requestData?.cargo?.product_description || 'N/A';
                  
                  return (
                    <TableRow 
                      key={item.quote.id}
                      className={isBest ? 'bg-green-50 dark:bg-green-950/20' : hasResponse ? '' : 'opacity-60'}
                    >
                      <TableCell className="text-xs font-mono">
                        {item.quote.id.substring(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(item.quote.requested_at), "dd/MM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs">{originCity.substring(0, 25)}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium flex items-center gap-1">
                          {isBest && <Trophy className="h-3 w-3 text-yellow-500" />}
                          {item.quote.carrier?.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {hasResponse ? (
                          <div className="font-bold">
                            {formatCurrency(item.response.freight_value)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Aguardando...</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {hasResponse && item.response?.delivery_time_days ? (
                          <span>{item.response.delivery_time_days}d</span>
                        ) : (
                          <span className="text-muted-foreground">---</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-center">{volumes}</TableCell>
                      <TableCell className="text-xs text-center">{weight.toFixed(1)}</TableCell>
                      <TableCell className="text-xs text-center text-muted-foreground">N/A</TableCell>
                      <TableCell className="text-xs">{originCity}</TableCell>
                      <TableCell className="text-xs">{destinationCity}/{destinationState}</TableCell>
                      <TableCell className="text-xs">{productType.substring(0, 20)}</TableCell>
                      <TableCell className="text-xs">
                        {isSelected ? (
                          <Badge className="bg-green-600 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Aprovada
                          </Badge>
                        ) : hasResponse ? (
                          <Badge variant="outline" className="text-xs">Pendente</Badge>
                        ) : (
                          <Badge variant="outline" className="border-yellow-500 text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Aguardando
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {hasResponse ? (
                          <div className="flex items-center justify-center gap-1">
                            {!isSelected ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleApprove(item.quote.id, item.response?.id || '')}
                                  disabled={isProcessing || !hasMinimumQuotes}
                                  className="gap-1 h-7 text-xs px-2"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(item.quote.id, item.response?.id || '')}
                                  disabled={isProcessing}
                                  className="gap-1 h-7 text-xs px-2"
                                >
                                  <XCircle className="h-3 w-3" />
                                  Reprovar
                                </Button>
                              </>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                                ✓ Selecionada
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <div className="text-center text-xs text-muted-foreground">
                            Sem resposta
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {!hasMinimumQuotes && quotesWithResponses.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>⚠️ Atenção:</strong> É necessário ter pelo menos 3 cotações com valores para prosseguir com a aprovação.
              {pendingQuotes.length > 0 && ` Aguardando resposta de ${pendingQuotes.length} transportadora(s).`}
              {pendingQuotes.length === 0 && ' Solicite mais cotações para prosseguir.'}
            </p>
          </div>
        )}

        {hasMinimumQuotes && quotesWithResponses.some(q => q.response?.is_selected) && (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>✓ Aprovação concluída!</strong> A cotação selecionada foi registrada e pode prosseguir para as próximas etapas do processo.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
