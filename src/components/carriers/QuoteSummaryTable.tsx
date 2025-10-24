import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, DollarSign } from 'lucide-react';
import type { FreightQuote, FreightQuoteResponse } from '@/types/carriers';

interface QuoteSummaryTableProps {
  quotes: FreightQuote[];
  responses: FreightQuoteResponse[];
  onSelectQuote?: (quoteId: string, responseId: string) => void;
}

export function QuoteSummaryTable({ quotes, responses, onSelectQuote }: QuoteSummaryTableProps) {
  const summary = useMemo(() => {
    return quotes.map(quote => {
      const quoteResponses = responses.filter(r => r.quote_id === quote.id);
      const bestResponse = quoteResponses.sort((a, b) => {
        if (!a.freight_value) return 1;
        if (!b.freight_value) return -1;
        return a.freight_value - b.freight_value;
      })[0];

      return {
        quote,
        response: bestResponse,
        hasResponse: quoteResponses.length > 0
      };
    }).sort((a, b) => {
      if (!a.response?.freight_value) return 1;
      if (!b.response?.freight_value) return -1;
      return a.response.freight_value - b.response.freight_value;
    });
  }, [quotes, responses]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (summary.length === 0) return null;

  const lowestValue = summary.find(s => s.response?.freight_value)?.response?.freight_value;

  return (
    <Card className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-lg">Resumo de Cotações Recebidas</h4>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transportadora</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Prazo</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summary.map(({ quote, response, hasResponse }) => {
            const isLowest = response?.freight_value && response.freight_value === lowestValue;
            const isSelected = response?.is_selected;
            
            return (
              <TableRow 
                key={quote.id}
                className={isLowest ? 'bg-primary/5 hover:bg-primary/10' : ''}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    {isLowest && !isSelected && (
                      <Trophy className="h-4 w-4 text-yellow-600 animate-pulse" />
                    )}
                    <span className="font-medium">{quote.carrier?.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {response?.freight_value ? (
                    <span className={`font-semibold ${isLowest ? 'text-primary text-lg' : ''}`}>
                      {formatCurrency(response.freight_value)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {response?.delivery_time_days ? (
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{response.delivery_time_days} dias</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {isSelected ? (
                    <Badge className="bg-green-600 hover:bg-green-700">
                      ✓ Selecionada
                    </Badge>
                  ) : hasResponse ? (
                    <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                      ✓ Respondida
                    </Badge>
                  ) : quote.status === 'sent' ? (
                    <Badge variant="secondary">
                      ⏳ Aguardando
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      {quote.status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {response && !isSelected && onSelectQuote && (
                    <Button
                      size="sm"
                      variant={isLowest ? 'default' : 'outline'}
                      onClick={() => onSelectQuote(quote.id, response.id)}
                      className="gap-1"
                    >
                      <DollarSign className="h-3 w-3" />
                      Selecionar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      
      {lowestValue && (
        <div className="mt-3 p-3 bg-primary/10 rounded-md border border-primary/20">
          <p className="text-sm text-center">
            <Trophy className="h-4 w-4 inline mr-1 text-yellow-600" />
            <span className="font-semibold">Melhor cotação: </span>
            <span className="text-primary font-bold">{formatCurrency(lowestValue)}</span>
          </p>
        </div>
      )}
    </Card>
  );
}
