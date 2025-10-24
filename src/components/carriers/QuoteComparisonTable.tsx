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
import { FreightQuote, FreightQuoteResponse } from '@/types/carriers';
import { Check } from 'lucide-react';

interface QuoteComparisonTableProps {
  quotes: FreightQuote[];
  responses: FreightQuoteResponse[];
  onSelectQuote: (quoteId: string, responseId: string) => void;
}

export function QuoteComparisonTable({ 
  quotes, 
  responses, 
  onSelectQuote 
}: QuoteComparisonTableProps) {
  // Combinar quotes com suas respostas
  const quotesWithResponses = quotes.map(quote => {
    const quoteResponses = responses.filter(r => r.quote_id === quote.id);
    return { quote, responses: quoteResponses };
  }).filter(q => q.responses.length > 0);

  if (quotesWithResponses.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Nenhuma resposta de cotação disponível para comparação
      </div>
    );
  }

  // Encontrar melhor preço e prazo
  const allResponses = quotesWithResponses.flatMap(q => 
    q.responses.map(r => ({ ...r, carrier: q.quote.carrier }))
  );
  
  const bestPrice = Math.min(...allResponses.filter(r => r.freight_value).map(r => r.freight_value!));
  const bestDeliveryTime = Math.min(...allResponses.filter(r => r.delivery_time_days).map(r => r.delivery_time_days!));

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transportadora</TableHead>
            <TableHead>Valor do Frete</TableHead>
            <TableHead>Prazo de Entrega</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotesWithResponses.map(({ quote, responses: quoteResponses }) =>
            quoteResponses.map((response) => {
              const isBestPrice = response.freight_value === bestPrice;
              const isBestTime = response.delivery_time_days === bestDeliveryTime;

              return (
                <TableRow key={response.id}>
                  <TableCell className="font-medium">
                    {quote.carrier?.name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {response.freight_value ? (
                        <>
                          <span>
                            R$ {response.freight_value.toFixed(2)}
                          </span>
                          {isBestPrice && (
                            <Badge variant="default" className="bg-green-500">
                              Melhor Preço
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {response.delivery_time_days ? (
                        <>
                          <span>
                            {response.delivery_time_days} dias
                          </span>
                          {isBestTime && (
                            <Badge variant="default" className="bg-blue-500">
                              Melhor Prazo
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {response.is_selected ? (
                      <Badge variant="default" className="bg-purple-500">
                        <Check className="h-3 w-3 mr-1" />
                        Selecionado
                      </Badge>
                    ) : (
                      <Badge variant="outline">Disponível</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!response.is_selected && (
                      <Button
                        size="sm"
                        onClick={() => onSelectQuote(quote.id, response.id)}
                      >
                        Selecionar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
