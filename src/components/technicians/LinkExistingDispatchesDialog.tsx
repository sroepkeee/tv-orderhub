import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { useTechnicians } from '@/hooks/useTechnicians';
import { useTechnicianDispatches } from '@/hooks/useTechnicianDispatches';
import { useReturnTickets } from '@/hooks/useReturnTickets';
import { toast } from 'sonner';
import { Search, Package, Loader2, MapPin, Calendar, FileText, ArrowRight, Ticket, CheckCircle2, UserPlus } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReturnTicketDialog } from './ReturnTicketDialog';
import type { ReturnTicket, ReturnTicketItem } from '@/types/technicians';

interface LinkExistingDispatchesDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  order_type: string;
  status: string;
  created_at: string;
  issue_date?: string;
  municipality?: string;
  totvs_order_number?: string;
  executive_name?: string;
  delivery_address?: string;
  items: Array<{
    id: string;
    item_code: string;
    item_description: string;
    requested_quantity: number;
    unit?: string;
  }>;
}

interface ItemSelection {
  id: string;
  item_code: string;
  item_description: string;
  max_quantity: number;
  quantity_to_dispatch: number;
  unit: string;
  selected: boolean;
}

export function LinkExistingDispatchesDialog({ open, onClose, onSuccess }: LinkExistingDispatchesDialogProps) {
  const { organizationId } = useOrganizationId();
  const { technicians, createTechnician, fetchTechnicians } = useTechnicians();
  const { createDispatch, dispatches } = useTechnicianDispatches();
  const { createTicket, updateTicketStatus } = useReturnTickets();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
  const [itemSelections, setItemSelections] = useState<ItemSelection[]>([]);
  const [autoCreatingTechnician, setAutoCreatingTechnician] = useState(false);
  const [wasAutoCreated, setWasAutoCreated] = useState(false);
  
  // Return ticket state
  const [createdTicket, setCreatedTicket] = useState<ReturnTicket | null>(null);
  const [showTicketDialog, setShowTicketDialog] = useState(false);

  // Filter unique technicians by ID to avoid duplicates
  const uniqueTechnicians = useMemo(() => {
    const seen = new Set<string>();
    return technicians.filter(tech => {
      if (seen.has(tech.id)) return false;
      seen.add(tech.id);
      return true;
    });
  }, [technicians]);

  // Fetch unlinked dispatch orders with more details
  useEffect(() => {
    if (!open || !organizationId) return;
    
    const fetchOrders = async () => {
      setLoading(true);
      try {
        // Get order IDs already linked to dispatches
        const linkedOrderIds = dispatches.map(d => d.order_id);
        
        let query = supabase
          .from('orders')
          .select(`
            id, order_number, customer_name, order_type, status, created_at,
            issue_date, municipality, totvs_order_number, executive_name, delivery_address,
            items:order_items(id, item_code, item_description, requested_quantity, unit)
          `)
          .eq('organization_id', organizationId)
          .in('order_type', ['remessa_conserto', 'remessa_garantia'])
          .not('status', 'in', '(delivered,completed,cancelled)');
        
        if (linkedOrderIds.length > 0) {
          query = query.not('id', 'in', `(${linkedOrderIds.join(',')})`);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
        
        if (error) throw error;
        setOrders((data || []) as Order[]);
      } catch (error) {
        console.error('Error fetching orders:', error);
        toast.error('Erro ao buscar pedidos');
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [open, organizationId, dispatches]);

  const filteredOrders = orders.filter(order => 
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.municipality?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.totvs_order_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  // Check if technician is auto-matched
  const autoMatchedTechnician = useMemo(() => {
    if (!selectedOrderId) return null;
    const order = orders.find(o => o.id === selectedOrderId);
    if (!order) return null;
    
    return uniqueTechnicians.find(
      tech => tech.name.toLowerCase().trim() === order.customer_name.toLowerCase().trim()
    );
  }, [selectedOrderId, orders, uniqueTechnicians]);

  const handleSelectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setWasAutoCreated(false);
    const order = orders.find(o => o.id === orderId);
    if (order) {
      // Initialize item selections with quantities
      setItemSelections(order.items.map(item => ({
        id: item.id,
        item_code: item.item_code,
        item_description: item.item_description || '',
        max_quantity: item.requested_quantity,
        quantity_to_dispatch: item.requested_quantity,
        unit: item.unit || 'un',
        selected: true,
      })));
      
      // Auto-select technician if customer name matches
      let matchingTechnician = uniqueTechnicians.find(
        tech => tech.name.toLowerCase().trim() === order.customer_name.toLowerCase().trim()
      );
      
      // If no matching technician, auto-create one
      if (!matchingTechnician && order.customer_name) {
        setAutoCreatingTechnician(true);
        try {
          const newTechnician = await createTechnician({
            name: order.customer_name,
            is_active: true,
          });
          if (newTechnician) {
            setSelectedTechnicianId(newTechnician.id);
            setWasAutoCreated(true);
            await fetchTechnicians(); // Refresh list
          }
        } catch (error) {
          console.error('Error auto-creating technician:', error);
        } finally {
          setAutoCreatingTechnician(false);
        }
      } else if (matchingTechnician) {
        setSelectedTechnicianId(matchingTechnician.id);
      }
    }
  };

  const handleItemToggle = (itemId: string, checked: boolean) => {
    setItemSelections(prev => 
      prev.map(item => 
        item.id === itemId ? { ...item, selected: checked } : item
      )
    );
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setItemSelections(prev =>
      prev.map(item => {
        if (item.id === itemId) {
          const validQuantity = Math.min(Math.max(1, quantity), item.max_quantity);
          return { ...item, quantity_to_dispatch: validQuantity };
        }
        return item;
      })
    );
  };

  const handleSubmit = async () => {
    const selectedItems = itemSelections.filter(i => i.selected);
    
    if (!selectedOrderId || !selectedTechnicianId || selectedItems.length === 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSubmitting(true);
    try {
      const selectedOrder = orders.find(o => o.id === selectedOrderId);
      if (!selectedOrder) return;

      const selectedTechnician = uniqueTechnicians.find(t => t.id === selectedTechnicianId);

      const items = selectedItems.map(item => ({
        order_item_id: item.id,
        item_code: item.item_code,
        item_description: item.item_description,
        unit: item.unit,
        quantity_sent: item.quantity_to_dispatch,
      }));

      // Create the dispatch
      await createDispatch(
        selectedOrderId,
        selectedTechnicianId,
        'imply_rs',
        null,
        items
      );

      // Create return ticket for TOTVS
      const ticketItems: ReturnTicketItem[] = selectedItems.map(item => ({
        item_code: item.item_code,
        item_description: item.item_description,
        quantity: item.quantity_to_dispatch,
        unit: item.unit,
      }));

      const newTicket = await createTicket({
        dispatch_id: undefined, // Will be linked later if needed
        totvs_order_number: selectedOrder.totvs_order_number || undefined,
        technician_id: selectedTechnicianId,
        technician_name: selectedTechnician?.name,
        customer_name: selectedOrder.customer_name,
        order_number: selectedOrder.order_number,
        origin_warehouse: 'tecnico',
        destination_warehouse: 'imply_rs',
        items: ticketItems,
        total_items: ticketItems.length,
        total_quantity: ticketItems.reduce((sum, item) => sum + item.quantity, 0),
      });

      if (newTicket) {
        setCreatedTicket(newTicket);
        setShowTicketDialog(true);
        toast.success('Remessa vinculada e ticket de retorno gerado!');
      } else {
        toast.success('Remessa vinculada com sucesso');
        onSuccess();
      }
    } catch (error) {
      console.error('Error linking dispatch:', error);
      toast.error('Erro ao vincular remessa');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTicketProcessed = async (ticketId: string, totvsNumber: string) => {
    await updateTicketStatus(ticketId, 'processed', totvsNumber);
  };

  const handleCloseTicketDialog = () => {
    setShowTicketDialog(false);
    setCreatedTicket(null);
    onSuccess();
  };

  const resetForm = () => {
    setSelectedOrderId(null);
    setSelectedTechnicianId('');
    setItemSelections([]);
    setSearchTerm('');
    setCreatedTicket(null);
    setWasAutoCreated(false);
  };

  const getDaysSinceCreation = (dateString: string) => {
    return differenceInDays(new Date(), new Date(dateString));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { resetForm(); onClose(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Vincular Remessas Existentes
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {!selectedOrderId ? (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número, cliente, cidade ou TOTVS..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Orders List */}
                <ScrollArea className="flex-1 border rounded-lg">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mb-2" />
                      <p className="text-sm">Nenhum pedido de remessa encontrado</p>
                      <p className="text-xs">Pedidos já vinculados não aparecem aqui</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredOrders.map((order) => {
                        const daysSince = getDaysSinceCreation(order.issue_date || order.created_at);
                        
                        return (
                          <button
                            key={order.id}
                            onClick={() => handleSelectOrder(order.id)}
                            className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium">{order.order_number}</p>
                                  <Badge variant="outline" className="text-xs">
                                    {order.order_type === 'remessa_conserto' ? 'Conserto' : 'Garantia'}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {order.items.length} itens
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground truncate mt-0.5">
                                  {order.customer_name}
                                </p>
                                
                                {/* Additional Details Row */}
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                                  {order.municipality && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {order.municipality}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(order.issue_date || order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                  {order.totvs_order_number && (
                                    <span className="flex items-center gap-1">
                                      <FileText className="h-3 w-3" />
                                      TOTVS: {order.totvs_order_number}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <Badge 
                                  variant={daysSince > 7 ? "destructive" : daysSince > 3 ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {daysSince}d
                                </Badge>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <>
                {/* Selected Order Details */}
                <div className="space-y-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{selectedOrder?.order_number}</p>
                          <Badge variant="outline" className="text-xs">
                            {selectedOrder?.order_type === 'remessa_conserto' ? 'Conserto' : 'Garantia'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{selectedOrder?.customer_name}</p>
                        {selectedOrder?.municipality && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {selectedOrder.municipality}
                          </p>
                        )}
                        {selectedOrder?.totvs_order_number && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            TOTVS: {selectedOrder.totvs_order_number}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedOrderId(null)}>
                        Trocar
                      </Button>
                    </div>
                  </div>

                  {/* Technician Selection - Auto-created/matched or manual */}
                  <div className="space-y-2">
                    <Label>Técnico Responsável *</Label>
                    
                    {autoCreatingTechnician ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                        <p className="text-sm text-blue-700">Cadastrando técnico automaticamente...</p>
                      </div>
                    ) : selectedTechnicianId ? (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <div>
                            <p className="font-medium text-sm">
                              {uniqueTechnicians.find(t => t.id === selectedTechnicianId)?.name || selectedOrder?.customer_name}
                            </p>
                            <p className="text-xs text-emerald-600">
                              {wasAutoCreated ? 'Técnico cadastrado automaticamente' : 'Técnico identificado automaticamente'}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedTechnicianId('')}
                        >
                          Alterar
                        </Button>
                      </div>
                    ) : (
                      <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o técnico..." />
                        </SelectTrigger>
                        <SelectContent>
                          {uniqueTechnicians.map((tech) => (
                            <SelectItem key={tech.id} value={tech.id}>
                              {tech.name} {tech.city && tech.state ? `- ${tech.city}/${tech.state}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <Separator />

                  {/* Items Selection with Quantity */}
                  <div className="space-y-2">
                    <Label>Itens da Remessa (edite as quantidades se necessário)</Label>
                    <div className="border rounded-lg divide-y max-h-56 overflow-auto">
                      {itemSelections.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-3">
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={(checked) => handleItemToggle(item.id, !!checked)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.item_code}</p>
                            <p className="text-xs text-muted-foreground truncate">{item.item_description}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Input
                              type="number"
                              min={1}
                              max={item.max_quantity}
                              value={item.quantity_to_dispatch}
                              onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                              className="w-20 h-8 text-center"
                              disabled={!item.selected}
                            />
                            <span className="text-xs text-muted-foreground">
                              / {item.max_quantity} {item.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {itemSelections.filter(i => i.selected).length} de {itemSelections.length} itens selecionados
                    </p>
                  </div>

                  {/* Return Ticket Info */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Ticket className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-700">Ticket de Retorno TOTVS</p>
                        <p className="text-amber-600 text-xs mt-0.5">
                          Um ticket será gerado automaticamente para registro do retorno no TOTVS Protheus.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>
              Cancelar
            </Button>
            {selectedOrderId && (
              <Button 
                onClick={handleSubmit} 
                disabled={submitting || !selectedTechnicianId || itemSelections.filter(i => i.selected).length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Vinculando...
                  </>
                ) : (
                  <>
                    <Ticket className="h-4 w-4 mr-2" />
                    Vincular e Gerar Ticket
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Ticket Dialog */}
      <ReturnTicketDialog
        open={showTicketDialog}
        onClose={handleCloseTicketDialog}
        ticket={createdTicket}
        onMarkProcessed={handleTicketProcessed}
      />
    </>
  );
}
