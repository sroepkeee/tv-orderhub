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

  // Combina quotes com suas respostas
  const quotesWithResponses = quotes
    .map(quote => {
      const quoteResponses = responses.filter(r => r.quote_id === quote.id);
      const bestResponse = quoteResponses.reduce((best, current) => {
        if (!best) return current;
        if (!current.freight_value) return best;
        if (!best.freight_value) return current;
        return current.freight_value < best.freight_value ? current : best;
      }, quoteResponses[0]);
      
      return {
        quote,
        response: bestResponse,
        allResponses: quoteResponses,
      };
    })
    .filter(item => item.response && item.response.freight_value) // Apenas cotações com valor
    .sort((a, b) => (a.response?.freight_value || 0) - (b.response?.freight_value || 0));

  // Encontra a melhor cotação (menor valor)
  const bestQuote = quotesWithResponses[0];
  const hasMinimumQuotes = quotesWithResponses.length >= 3;

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
              {showPlaceholder ? 'Aguardando respostas das transportadoras' : 'Análise comparativa para decisão final'}
            </p>
          </div>
          {!showPlaceholder && (
            <>
              {!hasMinimumQuotes && (
                <Badge variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-50">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Mínimo 3 cotações necessárias ({quotesWithResponses.length}/3)
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
                // Placeholder rows quando não há dados
                <>
                  {[1, 2, 3].map((i) => (
                    <TableRow key={`placeholder-${i}`}>
                      <TableCell className="text-xs"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="text-xs"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="text-xs"><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
                          <span className="text-muted-foreground">Aguardando...</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="text-xs"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="text-xs"><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell className="text-xs"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="text-xs"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="text-xs"><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell className="text-xs"><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-xs"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Pendente
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex gap-1 justify-center">
                          <Skeleton className="h-7 w-20" />
                          <Skeleton className="h-7 w-20" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ) : (
                // Dados reais quando houver cotações
                quotesWithResponses.map((item, index) => {
                  const isBest = item === bestQuote;
                  const isSelected = item.response?.is_selected;
                  const isProcessing = processingId === item.response?.id;
                  
                  // Extrair dados do quote_request_data
                  const requestData = item.quote.quote_request_data;
                  const volumes = requestData?.cargo?.volumes || 0;
                  const weight = requestData?.cargo?.total_weight_kg || 0;
                  const origin = requestData?.sender?.address || 'N/A';
                  const originState = requestData?.sender?.address?.split(',').pop()?.trim() || 'N/A';
                  const destinationCity = requestData?.recipient?.city || 'N/A';
                  const destinationState = requestData?.recipient?.state || 'N/A';
                  const productType = requestData?.cargo?.product_description || 'N/A';
                  
                  return (
                    <TableRow 
                      key={item.response?.id}
                      className={isBest ? 'bg-green-50 dark:bg-green-950/20' : ''}
                    >
                      <TableCell className="text-xs font-mono">
                        {item.quote.id.substring(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.response?.received_at && (
                          format(new Date(item.response.received_at), "dd/MM/yy", { locale: ptBR })
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{origin.substring(0, 25)}...</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium flex items-center gap-1">
                          {isBest && <Trophy className="h-3 w-3 text-yellow-500" />}
                          {item.quote.carrier?.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-bold">
                          {formatCurrency(item.response?.freight_value)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.response?.delivery_time_days ? (
                          <span>{item.response.delivery_time_days}d</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-center">{volumes}</TableCell>
                      <TableCell className="text-xs text-center">{weight.toFixed(1)}</TableCell>
                      <TableCell className="text-xs text-center text-muted-foreground">N/A</TableCell>
                      <TableCell className="text-xs">{originState}</TableCell>
                      <TableCell className="text-xs">{destinationCity}/{destinationState}</TableCell>
                      <TableCell className="text-xs">{productType.substring(0, 20)}</TableCell>
                      <TableCell className="text-xs">
                        {isSelected ? (
                          <Badge className="bg-green-600 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Aprovada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
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
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {!hasMinimumQuotes && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>⚠️ Atenção:</strong> É necessário ter pelo menos 3 cotações com valores para prosseguir com a aprovação.
              Aguarde mais respostas das transportadoras ou solicite novas cotações.
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
