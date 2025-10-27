import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package, Edit, ChevronDown } from 'lucide-react';
import { useCarriers } from '@/hooks/useCarriers';
import { useFreightQuotes } from '@/hooks/useFreightQuotes';
import { PACKAGING_TYPES } from '@/types/volumes';
import { useOrderTotalValue } from '@/hooks/useOrderTotalValue';
import { useOrderVolumes } from '@/hooks/useOrderVolumes';
import { extractCity, extractState } from '@/lib/addressParser';
import { CarrierManagementDialog } from '@/components/carriers/CarrierManagementDialog';
import type { Order } from '@/components/Dashboard';
import type { Carrier } from '@/types/carriers';

// Dados dos remetentes disponíveis
const SENDER_OPTIONS = [{
  id: 'imply_tech',
  name: 'IMPLY TECNOLOGIA ELETRÔNICA LTDA.',
  cnpj: '05.681.400/0001-23',
  address: 'Rodovia Imply Tecnologia, 1111 (RST 287 KM 105), Bairro Renascença, Santa Cruz do Sul/RS',
  phone: '(51) 2106-8000',
  email: 'imply@imply.com'
}, {
  id: 'imply_sp',
  name: 'IMPLY SÃO PAULO',
  cnpj: '05.681.400/0001-23',
  // Mesmo CNPJ, filial
  address: 'Av. Vereador Abel Ferreira, 1844 - Sala 1103, Edifício Anália Business Center, São Paulo/SP, CEP 03340-000',
  phone: '(51) 2106-8000',
  email: 'imply@imply.com'
}, {
  id: 'imply_rental',
  name: 'IMPLY RENTAL LOCAÇÃO DE EQUIPAMENTOS E SERVIÇOS LTDA',
  cnpj: '14.928.256/0001-78',
  address: 'Rodovia Imply Tecnologia, 1111 (RST 287 KM 105), Bairro Renascença, Santa Cruz do Sul/RS',
  phone: '(51) 2106-8000',
  email: 'nfe@imply.com'
}];
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
  onQuoteRequested
}: FreightQuoteDialogProps) => {
  const {
    carriers,
    loading: loadingCarriers,
    loadCarriers
  } = useCarriers();
  const {
    sendQuoteRequest
  } = useFreightQuotes();
  const {
    totalValue,
    loading: loadingTotal
  } = useOrderTotalValue(order.id);
  const {
    volumes,
    loadVolumes,
    totals
  } = useOrderVolumes(order.id);
  const [sending, setSending] = useState(false);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [selectedSender, setSelectedSender] = useState('imply_tech');
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [quoteData, setQuoteData] = useState({
    // Remetente (dados da Imply - padrão)
    sender_cnpj: SENDER_OPTIONS[0].cnpj,
    sender_company: SENDER_OPTIONS[0].name,
    sender_phone: SENDER_OPTIONS[0].phone,
    sender_address: SENDER_OPTIONS[0].address,
    // Destinatário (auto-preenchido do pedido)
    recipient_name: order.client || '',
    recipient_city: extractCity(order.delivery_address),
    recipient_state: extractState(order.delivery_address),
    recipient_address: order.delivery_address || '',
    // Carga
    product_description: order.description || order.item || '',
    package_type: 'Caixa de madeira',
    volumes: order.package_volumes || 1,
    weight_kg: order.package_weight_kg || 0,
    length_m: order.package_length_m || 0,
    width_m: order.package_width_m || 0,
    height_m: order.package_height_m || 0,
    // Operacional
    freight_payer: order.freight_type === 'FOB' ? 'FOB' : 'CIF',
    freight_type: order.freight_type || 'CIF',
    declared_value: 0,
    requires_insurance: false,
    observations: order.deskTicket || ''
  });

  // Atualizar valor declarado quando totalValue carregar
  useEffect(() => {
    if (totalValue > 0 && open) {
      setQuoteData(prev => ({
        ...prev,
        declared_value: totalValue,
        requires_insurance: totalValue > 1000
      }));
    }
  }, [totalValue, open]);

  // Carregar volumes quando dialog abrir
  useEffect(() => {
    if (open) {
      loadVolumes();
    }
  }, [open, loadVolumes]);

  // Pré-selecionar transportadora se já cadastrada no pedido
  useEffect(() => {
    if (order.carrier_name && carriers.length > 0 && open) {
      const matchingCarrier = carriers.find(c => c.name.toLowerCase().includes(order.carrier_name!.toLowerCase()));
      if (matchingCarrier && !selectedCarriers.includes(matchingCarrier.id)) {
        setSelectedCarriers([matchingCarrier.id]);
      }
    }
  }, [order.carrier_name, carriers, open]);

  // Atualizar dados do remetente quando selecionado
  const handleSenderChange = (senderId: string) => {
    const sender = SENDER_OPTIONS.find(s => s.id === senderId);
    if (sender) {
      setSelectedSender(senderId);
      setQuoteData(prev => ({
        ...prev,
        sender_cnpj: sender.cnpj,
        sender_company: sender.name,
        sender_phone: sender.phone,
        sender_address: sender.address
      }));
    }
  };
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
      // Enriquecer quoteData com volumes detalhados
      const enrichedQuoteData = {
        ...quoteData,
        detailed_volumes: volumes.map(vol => ({
          volume_number: vol.volume_number,
          quantity: vol.quantity,
          weight_kg: vol.weight_kg,
          dimensions: {
            length_cm: vol.length_cm,
            width_cm: vol.width_cm,
            height_cm: vol.height_cm,
          },
          cubagem_m3: (vol.length_cm * vol.width_cm * vol.height_cm) / 1000000,
          packaging_type: vol.packaging_type 
            ? PACKAGING_TYPES.find(t => t.value === vol.packaging_type)?.label 
            : 'Não especificado',
          description: vol.description
        })),
        volume_totals: {
          total_volumes: totals.total_volumes,
          total_weight_kg: totals.total_weight_kg,
          total_cubagem_m3: totals.total_cubagem_m3
        }
      };

      await sendQuoteRequest(order.id, selectedCarriers, enrichedQuoteData);
      onQuoteRequested?.();
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };
  const handleEditCarrier = (carrier: Carrier) => {
    setEditingCarrier(carrier);
    setIsEditDialogOpen(true);
  };
  const handleCarrierUpdated = () => {
    loadCarriers();
    setIsEditDialogOpen(false);
  };

  // Separar transportadoras compatíveis e não compatíveis
  const matchingCarriers = quoteData.recipient_state ? carriers.filter(carrier => carrier.service_states?.includes(quoteData.recipient_state)) : carriers;
  const nonMatchingCarriers = quoteData.recipient_state ? carriers.filter(carrier => !carrier.service_states?.includes(quoteData.recipient_state)) : [];
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            📦 Solicitar Cotação de Frete
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Pedido: {order.orderNumber}
          </p>
        </DialogHeader>

        {/* Resumo do Pedido */}
        {totalValue > 0 || order.package_volumes}

        <Accordion type="multiple" defaultValue={['sender', 'recipient', 'cargo', 'operational']}>
          <AccordionItem value="sender">
            <AccordionTrigger>
              1. Dados do Remetente
              <Badge variant="secondary" className="ml-2 text-xs">
                ✨ Auto-preenchido
              </Badge>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="space-y-2">
                <Label>Selecionar Remetente *</Label>
                <Select value={selectedSender} onValueChange={handleSenderChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SENDER_OPTIONS.map(sender => <SelectItem key={sender.id} value={sender.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{sender.name}</span>
                          <span className="text-xs text-muted-foreground">
                            CNPJ: {sender.cnpj}
                          </span>
                        </div>
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input value={quoteData.sender_cnpj} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={quoteData.sender_phone} disabled className="bg-muted" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Razão Social</Label>
                  <Input value={quoteData.sender_company} disabled className="bg-muted" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Endereço</Label>
                  <Textarea value={quoteData.sender_address} disabled className="bg-muted resize-none" rows={2} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="recipient">
            <AccordionTrigger>
              2. Dados do Destinatário
              {order.delivery_address && <Badge variant="secondary" className="ml-2 text-xs">
                  ✨ Auto-preenchido
                </Badge>}
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={quoteData.recipient_name} onChange={e => setQuoteData({
                  ...quoteData,
                  recipient_name: e.target.value
                })} />
                </div>
                <div className="space-y-2">
                  <Label>Cidade *</Label>
                  <Input value={quoteData.recipient_city} onChange={e => setQuoteData({
                  ...quoteData,
                  recipient_city: e.target.value
                })} />
                </div>
                <div className="space-y-2">
                  <Label>Estado *</Label>
                  <Select value={quoteData.recipient_state} onValueChange={value => setQuoteData({
                  ...quoteData,
                  recipient_state: value
                })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Endereço *</Label>
                  <Input value={quoteData.recipient_address} onChange={e => setQuoteData({
                  ...quoteData,
                  recipient_address: e.target.value
                })} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cargo">
            <AccordionTrigger>
              3. Dados da Carga
              {(volumes.length > 0 || order.package_volumes || order.package_weight_kg) && <Badge variant="secondary" className="ml-2 text-xs">
                  ✨ Auto-preenchido
                </Badge>}
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              {/* Exibir volumes detalhados se existirem */}
              {volumes.length > 0 ? <Card className="p-4 bg-muted/50">
                  <Label className="font-semibold mb-2 block">📦 Volumes Detalhados</Label>
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">
                      Total: {totals.total_volumes} volumes - {totals.total_weight_kg.toFixed(2)} kg
                    </div>
                    {volumes.map((vol, idx) => {
                  const packagingLabel = vol.packaging_type ? PACKAGING_TYPES.find(t => t.value === vol.packaging_type)?.label : 'Não especificado';
                  return <div key={vol.id} className="pl-4 border-l-2 border-primary/30">
                          <div>
                            • {vol.quantity > 1 ? `${vol.quantity} volumes - ${vol.weight_kg}kg cada` : `1 volume - ${vol.weight_kg}kg`}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {vol.length_cm}cm x {vol.width_cm}cm x {vol.height_cm}cm 
                            ({(vol.length_cm * vol.width_cm * vol.height_cm / 1000000).toFixed(3)} m³)
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Embalagem: {packagingLabel}
                          </div>
                          {vol.description && <div className="text-muted-foreground text-xs italic">
                              {vol.description}
                            </div>}
                        </div>;
                })}
                    <div className="pt-2 border-t text-muted-foreground">
                      Cubagem Total: {totals.total_cubagem_m3.toFixed(3)} m³
                    </div>
                  </div>
                </Card> :
            // Formulário original para volumes resumidos
            <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2 col-span-2">
                    <Label>Produto *</Label>
                    <Input value={quoteData.product_description} onChange={e => setQuoteData({
                  ...quoteData,
                  product_description: e.target.value
                })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Embalagem *</Label>
                    <Select value={quoteData.package_type} onValueChange={value => setQuoteData({
                  ...quoteData,
                  package_type: value
                })}>
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
                    <Input type="number" value={quoteData.volumes} onChange={e => setQuoteData({
                  ...quoteData,
                  volumes: parseFloat(e.target.value)
                })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Peso (kg) *</Label>
                    <Input type="number" step="0.01" value={quoteData.weight_kg} onChange={e => setQuoteData({
                  ...quoteData,
                  weight_kg: parseFloat(e.target.value)
                })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Comprimento (m) *</Label>
                    <Input type="number" step="0.01" value={quoteData.length_m} onChange={e => setQuoteData({
                  ...quoteData,
                  length_m: parseFloat(e.target.value)
                })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Largura (m) *</Label>
                    <Input type="number" step="0.01" value={quoteData.width_m} onChange={e => setQuoteData({
                  ...quoteData,
                  width_m: parseFloat(e.target.value)
                })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Altura (m) *</Label>
                    <Input type="number" step="0.01" value={quoteData.height_m} onChange={e => setQuoteData({
                  ...quoteData,
                  height_m: parseFloat(e.target.value)
                })} />
                  </div>
                </div>}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="operational">
            <AccordionTrigger>
              4. Informações Operacionais
              {(totalValue > 0 || order.freight_type) && <Badge variant="secondary" className="ml-2 text-xs">
                  ✨ Auto-preenchido
                </Badge>}
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tomador do Frete *</Label>
                  <Select value={quoteData.freight_payer} onValueChange={value => setQuoteData({
                  ...quoteData,
                  freight_payer: value
                })}>
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
                  <Input type="number" step="0.01" value={quoteData.declared_value} onChange={e => setQuoteData({
                  ...quoteData,
                  declared_value: parseFloat(e.target.value)
                })} />
                </div>
                <div className="flex items-center space-x-2 col-span-2">
                  <Checkbox id="insurance" checked={quoteData.requires_insurance} onCheckedChange={checked => setQuoteData({
                  ...quoteData,
                  requires_insurance: checked as boolean
                })} />
                  <Label htmlFor="insurance" className="cursor-pointer">
                    Requer Seguro
                  </Label>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={quoteData.observations} onChange={e => setQuoteData({
                  ...quoteData,
                  observations: e.target.value
                })} rows={3} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label>📋 Selecione as Transportadoras</Label>
            {selectedCarriers.length > 0 && <Badge variant="secondary">
                {selectedCarriers.length} selecionada(s)
              </Badge>}
          </div>

          {loadingCarriers ? <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div> : carriers.length === 0 ? <p className="text-sm text-muted-foreground">
              Nenhuma transportadora cadastrada.
            </p> : <div className="space-y-4">
              {/* Transportadoras que atendem o estado - expandidas */}
              {matchingCarriers.length > 0 && <div className="space-y-2">
                  {quoteData.recipient_state && <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                        ✓ Atendem {quoteData.recipient_state}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {matchingCarriers.length} transportadora(s)
                      </span>
                    </div>}
                  {matchingCarriers.map(carrier => <Card key={carrier.id} className={`p-4 transition-all ${selectedCarriers.includes(carrier.id) ? 'border-primary bg-primary/5 border-2' : 'border-green-200 dark:border-green-900'}`}>
                      <div className="flex items-start gap-3">
                        <Checkbox checked={selectedCarriers.includes(carrier.id)} onCheckedChange={() => toggleCarrier(carrier.id)} className="mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="font-semibold text-base">{carrier.name}</p>
                            <Button variant="ghost" size="sm" onClick={e => {
                      e.stopPropagation();
                      handleEditCarrier(carrier);
                    }} className="shrink-0">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {carrier.whatsapp && <p>📱 WhatsApp: {carrier.whatsapp}</p>}
                            {carrier.email && <p>📧 Email: {carrier.email}</p>}
                            <p className="text-xs">
                              Estados: {carrier.service_states?.join(', ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>)}
                </div>}

              {/* Transportadoras que NÃO atendem - minimizadas */}
              {nonMatchingCarriers.length > 0 && quoteData.recipient_state && <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-md bg-muted/50 hover:bg-muted">
                    <ChevronDown className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      ⚠️ Outras transportadoras ({nonMatchingCarriers.length})
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      Não atendem {quoteData.recipient_state}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
                    {nonMatchingCarriers.map(carrier => <Card key={carrier.id} className="p-3 opacity-50 hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-3">
                          <Checkbox checked={selectedCarriers.includes(carrier.id)} onCheckedChange={() => toggleCarrier(carrier.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm">{carrier.name}</p>
                              <Button variant="ghost" size="sm" onClick={e => {
                        e.stopPropagation();
                        handleEditCarrier(carrier);
                      }}>
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Estados: {carrier.service_states?.join(', ')}
                            </p>
                          </div>
                        </div>
                      </Card>)}
                  </CollapsibleContent>
                </Collapsible>}
            </div>}
        </div>

        {/* Dialog de edição inline */}
        <CarrierManagementDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} carrier={editingCarrier} onCarrierUpdated={handleCarrierUpdated} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={sending || selectedCarriers.length === 0} className="gap-2">
            {sending ? <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando para {selectedCarriers.length} transportadora(s)...
              </> : <>
                📤 Enviar Cotação ({selectedCarriers.length})
              </>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>;
};