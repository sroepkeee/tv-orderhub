import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useCarriers } from '@/hooks/useCarriers';
import { useFreightQuotes } from '@/hooks/useFreightQuotes';
import type { Order } from '@/components/Dashboard';

interface FreightQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onQuoteRequested?: () => void;
}

export const FreightQuoteDialog = ({
  open,
  onOpenChange,
  order,
  onQuoteRequested,
}: FreightQuoteDialogProps) => {
  const { carriers, loading: loadingCarriers } = useCarriers();
  const { sendQuoteRequest } = useFreightQuotes();
  const [sending, setSending] = useState(false);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);

  const [quoteData, setQuoteData] = useState({
    // Remetente
    sender_cnpj: '',
    sender_company: 'SSM EQUIPAMENTOS',
    sender_phone: '',
    sender_address: '',
    
    // Destinatário (auto-preenchido do pedido)
    recipient_name: order.client,
    recipient_city: '',
    recipient_state: '',
    recipient_address: order.deliveryDeadline || '',
    
    // Carga
    product_description: order.description || '',
    package_type: 'Caixa de madeira',
    volumes: order.package_volumes || 1,
    weight_kg: order.package_weight_kg || 0,
    length_m: order.package_length_m || 0,
    width_m: order.package_width_m || 0,
    height_m: order.package_height_m || 0,
    
    // Operacional
    freight_payer: 'CIF',
    freight_type: 'CIF',
    declared_value: 0,
    requires_insurance: false,
    observations: '',
  });

  useEffect(() => {
    if (order && open) {
      // Carregar transportadoras que atendem o estado
      if (quoteData.recipient_state) {
        // Filtrar automaticamente
      }
    }
  }, [order, open, quoteData.recipient_state]);

  const toggleCarrier = (carrierId: string) => {
    if (selectedCarriers.includes(carrierId)) {
      setSelectedCarriers(selectedCarriers.filter(id => id !== carrierId));
    } else {
      setSelectedCarriers([...selectedCarriers, carrierId]);
    }
  };

  const handleSubmit = async () => {
    if (selectedCarriers.length === 0) {
      return;
    }

    setSending(true);
    try {
      await sendQuoteRequest(order.id, selectedCarriers, quoteData);
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  const filteredCarriers = carriers.filter(carrier => 
    !quoteData.recipient_state || carrier.service_states?.includes(quoteData.recipient_state)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            📦 Solicitar Cotação de Frete
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Pedido: {order.orderNumber}
          </p>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={['sender', 'recipient', 'cargo', 'operational']}>
          <AccordionItem value="sender">
            <AccordionTrigger>1. Dados do Remetente</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>CNPJ *</Label>
                  <Input
                    value={quoteData.sender_cnpj}
                    onChange={(e) => setQuoteData({ ...quoteData, sender_cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Razão Social *</Label>
                  <Input
                    value={quoteData.sender_company}
                    onChange={(e) => setQuoteData({ ...quoteData, sender_company: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone *</Label>
                  <Input
                    value={quoteData.sender_phone}
                    onChange={(e) => setQuoteData({ ...quoteData, sender_phone: e.target.value })}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Endereço *</Label>
                  <Input
                    value={quoteData.sender_address}
                    onChange={(e) => setQuoteData({ ...quoteData, sender_address: e.target.value })}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="recipient">
            <AccordionTrigger>2. Dados do Destinatário</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={quoteData.recipient_name}
                    onChange={(e) => setQuoteData({ ...quoteData, recipient_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade *</Label>
                  <Input
                    value={quoteData.recipient_city}
                    onChange={(e) => setQuoteData({ ...quoteData, recipient_city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado *</Label>
                  <Select
                    value={quoteData.recipient_state}
                    onValueChange={(value) => setQuoteData({ ...quoteData, recipient_state: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Endereço *</Label>
                  <Input
                    value={quoteData.recipient_address}
                    onChange={(e) => setQuoteData({ ...quoteData, recipient_address: e.target.value })}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cargo">
            <AccordionTrigger>3. Dados da Carga</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label>Produto *</Label>
                  <Input
                    value={quoteData.product_description}
                    onChange={(e) => setQuoteData({ ...quoteData, product_description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Embalagem *</Label>
                  <Select
                    value={quoteData.package_type}
                    onValueChange={(value) => setQuoteData({ ...quoteData, package_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Caixa de papelão">Caixa de papelão</SelectItem>
                      <SelectItem value="Caixa de madeira">Caixa de madeira</SelectItem>
                      <SelectItem value="Palete">Palete</SelectItem>
                      <SelectItem value="Container">Container</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Volumes *</Label>
                  <Input
                    type="number"
                    value={quoteData.volumes}
                    onChange={(e) => setQuoteData({ ...quoteData, volumes: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Peso (kg) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quoteData.weight_kg}
                    onChange={(e) => setQuoteData({ ...quoteData, weight_kg: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Comprimento (m) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quoteData.length_m}
                    onChange={(e) => setQuoteData({ ...quoteData, length_m: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Largura (m) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quoteData.width_m}
                    onChange={(e) => setQuoteData({ ...quoteData, width_m: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Altura (m) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quoteData.height_m}
                    onChange={(e) => setQuoteData({ ...quoteData, height_m: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="operational">
            <AccordionTrigger>4. Informações Operacionais</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tomador do Frete *</Label>
                  <Select
                    value={quoteData.freight_payer}
                    onValueChange={(value) => setQuoteData({ ...quoteData, freight_payer: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CIF">CIF (Remetente)</SelectItem>
                      <SelectItem value="FOB">FOB (Destinatário)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor Declarado (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quoteData.declared_value}
                    onChange={(e) => setQuoteData({ ...quoteData, declared_value: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="flex items-center space-x-2 col-span-2">
                  <Checkbox
                    id="insurance"
                    checked={quoteData.requires_insurance}
                    onCheckedChange={(checked) =>
                      setQuoteData({ ...quoteData, requires_insurance: checked as boolean })
                    }
                  />
                  <Label htmlFor="insurance" className="cursor-pointer">
                    Requer Seguro
                  </Label>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={quoteData.observations}
                    onChange={(e) => setQuoteData({ ...quoteData, observations: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="border-t pt-4 space-y-3">
          <Label>📋 Selecione as Transportadoras</Label>
          {quoteData.recipient_state && (
            <p className="text-sm text-muted-foreground">
              Filtradas por estado: {quoteData.recipient_state}
            </p>
          )}

          {loadingCarriers ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredCarriers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma transportadora encontrada{quoteData.recipient_state && ' para este estado'}.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredCarriers.map((carrier) => (
                <Card
                  key={carrier.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedCarriers.includes(carrier.id)
                      ? 'border-primary bg-primary/5'
                      : ''
                  }`}
                  onClick={() => toggleCarrier(carrier.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        checked={selectedCarriers.includes(carrier.id)}
                        onCheckedChange={() => toggleCarrier(carrier.id)}
                      />
                      <div>
                        <p className="font-medium">{carrier.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {carrier.service_states?.join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={sending || selectedCarriers.length === 0}
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar para {selectedCarriers.length} Transportadora(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
