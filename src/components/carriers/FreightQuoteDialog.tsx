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
  // Helper para gerar cor do avatar baseado no nome
  const getCarrierColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getCarrierInitials = (name: string) => {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl">
            📦 Solicitar Cotação de Frete - Pedido: {order.orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-[1fr_500px] gap-6 overflow-hidden">
          {/* Coluna Esquerda: Dados do Frete */}
          <div className="overflow-y-auto pr-2 space-y-4">
            {/* Remetente */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">1. Remetente</Label>
                <Badge variant="secondary" className="text-xs">✨ Auto</Badge>
              </div>
              <div className="space-y-3">
                <Select value={selectedSender} onValueChange={handleSenderChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SENDER_OPTIONS.map(sender => <SelectItem key={sender.id} value={sender.id}>
                        {sender.name}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">CNPJ:</span> {quoteData.sender_cnpj}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tel:</span> {quoteData.sender_phone}
                  </div>
                </div>
              </div>
            </Card>

            {/* Destinatário */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">2. Destinatário</Label>
                {order.delivery_address && <Badge variant="secondary" className="text-xs">✨ Auto</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={quoteData.recipient_name} onChange={e => setQuoteData({...quoteData, recipient_name: e.target.value})} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Cidade *</Label>
                  <Input value={quoteData.recipient_city} onChange={e => setQuoteData({...quoteData, recipient_city: e.target.value})} className="h-9" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="text-xs">Estado *</Label>
                  <Select value={quoteData.recipient_state} onValueChange={value => setQuoteData({...quoteData, recipient_state: value})}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="text-xs">Endereço *</Label>
                  <Input value={quoteData.recipient_address} onChange={e => setQuoteData({...quoteData, recipient_address: e.target.value})} className="h-9" />
                </div>
              </div>
            </Card>

            {/* Carga */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">3. Carga</Label>
                {(volumes.length > 0 || order.package_volumes) && <Badge variant="secondary" className="text-xs">✨ Auto</Badge>}
              </div>
              {volumes.length > 0 ? (
                <div className="bg-muted/50 rounded-md p-3 space-y-2">
                  <div className="font-medium text-sm">
                    Total: {totals.total_volumes} volumes • {totals.total_weight_kg.toFixed(2)} kg • {totals.total_cubagem_m3.toFixed(3)} m³
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {volumes.map((vol) => (
                      <div key={vol.id} className="text-xs pl-3 border-l-2 border-primary/30">
                        <div>{vol.quantity > 1 ? `${vol.quantity}x ${vol.weight_kg}kg` : `${vol.weight_kg}kg`} • {vol.length_cm}×{vol.width_cm}×{vol.height_cm}cm</div>
                        {vol.description && <div className="text-muted-foreground italic">{vol.description}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Volumes</Label>
                    <Input type="number" value={quoteData.volumes} onChange={e => setQuoteData({...quoteData, volumes: parseFloat(e.target.value)})} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Peso (kg)</Label>
                    <Input type="number" step="0.01" value={quoteData.weight_kg} onChange={e => setQuoteData({...quoteData, weight_kg: parseFloat(e.target.value)})} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Altura (m)</Label>
                    <Input type="number" step="0.01" value={quoteData.height_m} onChange={e => setQuoteData({...quoteData, height_m: parseFloat(e.target.value)})} className="h-9" />
                  </div>
                </div>
              )}
            </Card>

            {/* Operacional */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">4. Operacional</Label>
                {(totalValue > 0 || order.freight_type) && <Badge variant="secondary" className="text-xs">✨ Auto</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Tomador *</Label>
                  <Select value={quoteData.freight_payer} onValueChange={value => setQuoteData({...quoteData, freight_payer: value})}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CIF">CIF (Remetente)</SelectItem>
                      <SelectItem value="FOB">FOB (Destinatário)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    Valor (R$) {loadingTotal && <Loader2 className="h-3 w-3 animate-spin" />}
                  </Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={quoteData.declared_value || ''} 
                    onChange={e => setQuoteData({...quoteData, declared_value: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    disabled={loadingTotal}
                    className="h-9"
                  />
                </div>
                <div className="flex items-center space-x-2 col-span-2">
                  <Checkbox id="insurance" checked={quoteData.requires_insurance} onCheckedChange={checked => setQuoteData({...quoteData, requires_insurance: checked as boolean})} />
                  <Label htmlFor="insurance" className="text-sm cursor-pointer">Requer Seguro</Label>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={quoteData.observations} onChange={e => setQuoteData({...quoteData, observations: e.target.value})} rows={2} className="text-sm" />
                </div>
              </div>
            </Card>
          </div>

          {/* Coluna Direita: Transportadoras */}
          <div className="flex flex-col overflow-hidden border-l pl-6">
            <div className="flex-shrink-0 mb-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">📋 Transportadoras</Label>
                {selectedCarriers.length > 0 && (
                  <Badge variant="default" className="bg-primary">
                    {selectedCarriers.length} selecionada{selectedCarriers.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              {quoteData.recipient_state && matchingCarriers.length > 0 && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                  ✓ {matchingCarriers.length} atendem {quoteData.recipient_state}
                </Badge>
              )}
            </div>

            {loadingCarriers ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : carriers.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">Nenhuma transportadora cadastrada</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2">
                {/* Transportadoras que atendem */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {matchingCarriers.map(carrier => (
                    <Card 
                      key={carrier.id} 
                      className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                        selectedCarriers.includes(carrier.id) 
                          ? 'border-primary bg-primary/5 border-2' 
                          : 'border-green-200 dark:border-green-900/50 hover:border-primary/50'
                      }`}
                      onClick={() => toggleCarrier(carrier.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-lg ${getCarrierColor(carrier.name)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                          {getCarrierInitials(carrier.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1 mb-2">
                            <h4 className="font-semibold text-sm leading-tight line-clamp-2">{carrier.name}</h4>
                            <Checkbox 
                              checked={selectedCarriers.includes(carrier.id)} 
                              onCheckedChange={() => toggleCarrier(carrier.id)}
                              className="flex-shrink-0"
                            />
                          </div>
                          <div className="space-y-1">
                            {carrier.whatsapp && (
                              <p className="text-xs text-muted-foreground truncate">📱 {carrier.whatsapp}</p>
                            )}
                            {carrier.email && (
                              <p className="text-xs text-muted-foreground truncate">📧 {carrier.email}</p>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="xs" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCarrier(carrier);
                            }} 
                            className="mt-2 h-6 px-2 text-xs w-full"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Transportadoras que não atendem */}
                {nonMatchingCarriers.length > 0 && quoteData.recipient_state && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-md bg-muted/50 hover:bg-muted mb-2">
                      <ChevronDown className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        ⚠️ Outras ({nonMatchingCarriers.length})
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        Não atendem {quoteData.recipient_state}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="grid grid-cols-2 gap-2 mt-2">
                      {nonMatchingCarriers.map(carrier => (
                        <Card 
                          key={carrier.id} 
                          className="p-2 opacity-60 hover:opacity-100 cursor-pointer transition-all"
                          onClick={() => toggleCarrier(carrier.id)}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-8 h-8 rounded ${getCarrierColor(carrier.name)} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                              {getCarrierInitials(carrier.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs line-clamp-2">{carrier.name}</p>
                              <Checkbox 
                                checked={selectedCarriers.includes(carrier.id)}
                                onCheckedChange={() => toggleCarrier(carrier.id)}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
          </div>
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