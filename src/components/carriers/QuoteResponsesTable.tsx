import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useFreightQuotes } from '@/hooks/useFreightQuotes';

interface QuoteResponsesTableProps {
  orderId: string;
  onSelectQuote?: (quoteId: string, responseId: string) => void;
}

export function QuoteResponsesTable({ orderId, onSelectQuote }: QuoteResponsesTableProps) {
  const { loadQuoteResponsesForOrder, selectQuote } = useFreightQuotes();
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [orderId]);

  const loadData = async () => {
    setLoading(true);
    const data = await loadQuoteResponsesForOrder(orderId);
    setResponses(data);
    setLoading(false);
  };

  const handleSelectQuote = async (quoteId: string, responseId: string) => {
    setSelecting(responseId);
    const success = await selectQuote(quoteId, responseId);
    if (success) {
      await loadData();
    }
    setSelecting(null);
    onSelectQuote?.(quoteId, responseId);
  };

  const calculateVolume = (quoteData: any) => {
    const dims = quoteData?.cargo?.dimensions;
    if (!dims?.length_m || !dims?.width_m || !dims?.height_m) return 0;
    return dims.length_m * dims.width_m * dims.height_m;
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando cotações...</span>
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">Nenhuma cotação recebida ainda</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cotação</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Solicitante</TableHead>
            <TableHead>Transportadora</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Prazo</TableHead>
            <TableHead className="text-right">Vol.</TableHead>
            <TableHead className="text-right">Peso</TableHead>
            <TableHead className="text-right">Valor/m³</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {responses.map((response) => {
            const volume = calculateVolume(response.quote_request_data);
            const valuePerM3 = volume > 0 && response.freight_value 
              ? response.freight_value / volume 
              : null;
            const weight = response.quote_request_data?.cargo?.total_weight_kg;
            const volumes = response.quote_request_data?.cargo?.volumes;

            return (
              <TableRow key={response.id} className={response.is_selected ? 'bg-primary/5' : ''}>
                <TableCell className="font-mono text-xs">
                  #{response.quote_id?.slice(0, 8)}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(response.received_at), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell className="text-sm">
                  {response.requester_name || '-'}
                </TableCell>
                <TableCell className="font-medium text-sm">
                  {response.carrier_name || 'Transportadora'}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(response.freight_value)}
                </TableCell>
                <TableCell className="text-right">
                  {response.delivery_time_days ? `${response.delivery_time_days} dias` : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {volumes || '-'}
                </TableCell>
                <TableCell className="text-right">
                  {weight ? `${weight.toFixed(2)} kg` : '-'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(valuePerM3)}
                </TableCell>
                <TableCell className="text-center">
                  {response.is_selected ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Selecionada
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {!response.is_selected && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSelectQuote(response.quote_id, response.id)}
                      disabled={selecting === response.id}
                    >
                      {selecting === response.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Selecionar'
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
