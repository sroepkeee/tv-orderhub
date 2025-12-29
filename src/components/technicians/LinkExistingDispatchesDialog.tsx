import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { useTechnicians } from '@/hooks/useTechnicians';
import { useTechnicianDispatches } from '@/hooks/useTechnicianDispatches';
import { toast } from 'sonner';
import { Search, Package, Loader2 } from 'lucide-react';

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
  items: Array<{
    id: string;
    item_code: string;
    item_description: string;
    requested_quantity: number;
  }>;
}

export function LinkExistingDispatchesDialog({ open, onClose, onSuccess }: LinkExistingDispatchesDialogProps) {
  const { organizationId } = useOrganizationId();
  const { technicians } = useTechnicians();
  const { createDispatch, dispatches } = useTechnicianDispatches();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Fetch unlinked dispatch orders
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
            items:order_items(id, item_code, item_description, requested_quantity)
          `)
          .eq('organization_id', organizationId)
          .in('order_type', ['remessa_conserto', 'remessa_garantia'])
          .not('status', 'in', '(delivered,completed,cancelled)');
        
        if (linkedOrderIds.length > 0) {
          query = query.not('id', 'in', `(${linkedOrderIds.join(',')})`);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
        
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
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setSelectedItems(order.items.map(i => i.id));
    }
  };

  const handleItemToggle = (itemId: string, checked: boolean) => {
    setSelectedItems(prev => 
      checked ? [...prev, itemId] : prev.filter(id => id !== itemId)
    );
  };

  const handleSubmit = async () => {
    if (!selectedOrderId || !selectedTechnicianId || selectedItems.length === 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSubmitting(true);
    try {
      const selectedOrder = orders.find(o => o.id === selectedOrderId);
      if (!selectedOrder) return;

      const items = selectedOrder.items
        .filter(item => selectedItems.includes(item.id))
        .map(item => ({
          order_item_id: item.id,
          item_code: item.item_code,
          item_description: item.item_description || '',
          unit: 'un',
          quantity_sent: item.requested_quantity,
        }));

      await createDispatch(
        selectedOrderId,
        selectedTechnicianId,
        'imply_rs', // default origin
        null, // no expected return date
        items
      );

      toast.success('Remessa vinculada com sucesso');
      onSuccess();
    } catch (error) {
      console.error('Error linking dispatch:', error);
      toast.error('Erro ao vincular remessa');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedOrderId(null);
    setSelectedTechnicianId('');
    setSelectedItems([]);
    setSearchTerm('');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Vincular Remessas Existentes</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {!selectedOrderId ? (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número do pedido ou cliente..."
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
                    {filteredOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => handleSelectOrder(order.id)}
                        className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{order.order_number}</p>
                            <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {order.order_type === 'remessa_conserto' ? 'Conserto' : 'Garantia'}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {order.items.length} itens
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <>
              {/* Selected Order Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{selectedOrder?.order_number}</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder?.customer_name}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedOrderId(null)}>
                    Trocar
                  </Button>
                </div>

                {/* Technician Selection */}
                <div className="space-y-2">
                  <Label>Técnico Responsável *</Label>
                  <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o técnico..." />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name} - {tech.city}/{tech.state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Items Selection */}
                <div className="space-y-2">
                  <Label>Itens da Remessa</Label>
                  <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                    {selectedOrder?.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3">
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => handleItemToggle(item.id, !!checked)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{item.item_code}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.item_description}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Qtd: {item.requested_quantity}
                        </Badge>
                      </div>
                    ))}
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
              disabled={submitting || !selectedTechnicianId || selectedItems.length === 0}
            >
              {submitting ? 'Vinculando...' : 'Vincular Remessa'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
