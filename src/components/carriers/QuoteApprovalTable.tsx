import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, Trophy, AlertTriangle } from 'lucide-react';
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

  if (quotesWithResponses.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-yellow-500" />
          <p className="text-lg font-semibold">Nenhuma cotação disponível para aprovação</p>
          <p className="text-sm mt-1">Aguarde as transportadoras responderem</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              🎯 Aprovação de Cotações
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Análise comparativa para decisão final
            </p>
          </div>
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
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead>Valor do Frete</TableHead>
                <TableHead>Prazo de Entrega</TableHead>
                <TableHead>Recebido em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotesWithResponses.map((item, index) => {
                const isBest = item === bestQuote;
                const isSelected = item.response?.is_selected;
                const isProcessing = processingId === item.response?.id;
                
                return (
                  <TableRow 
                    key={item.response?.id}
                    className={isBest ? 'bg-green-50 dark:bg-green-950/20' : ''}
                  >
                    <TableCell>
                      {isBest && (
                        <Trophy className="h-5 w-5 text-yellow-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium flex items-center gap-2">
                        {item.quote.carrier?.name}
                        {isBest && (
                          <Badge variant="secondary" className="text-xs">
                            Melhor Preço
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-lg">
                        {formatCurrency(item.response?.freight_value)}
                      </div>
                      {isBest && quotesWithResponses.length > 1 && (
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Economia de {formatCurrency(
                            (quotesWithResponses[1]?.response?.freight_value || 0) - 
                            (item.response?.freight_value || 0)
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.response?.delivery_time_days ? (
                        <span>{item.response.delivery_time_days} dias</span>
                      ) : (
                        <span className="text-muted-foreground">Não informado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.response?.received_at && (
                        <span className="text-sm">
                          {format(new Date(item.response.received_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isSelected ? (
                        <Badge className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Aprovada
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        {!isSelected ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApprove(item.quote.id, item.response?.id || '')}
                              disabled={isProcessing || !hasMinimumQuotes}
                              className="gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(item.quote.id, item.response?.id || '')}
                              disabled={isProcessing}
                              className="gap-1"
                            >
                              <XCircle className="h-3 w-3" />
                              Reprovar
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            ✓ Selecionada
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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
