import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Calendar, User, FileText, CheckCircle, XCircle, Clock, History, Edit, Plus, Trash2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Order } from "./Dashboard";
import { OrderItem } from "./AddOrderDialog";
import { supabase } from "@/integrations/supabase/client";

interface HistoryEvent {
  id: string;
  changed_at: string;
  old_status: string;
  new_status: string;
  user_id: string;
}

interface EditOrderDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (order: Order) => void;
}

export const EditOrderDialog = ({ order, open, onOpenChange, onSave }: EditOrderDialogProps) => {
  const { register, handleSubmit, setValue, reset } = useForm<Order>();
  const [activeTab, setActiveTab] = useState("edit");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load history from database
  const loadHistory = async () => {
    if (!order?.id) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('order_history')
        .select('*')
        .eq('order_id', order.id)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      setHistoryEvents(data || []);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (open && order) {
      reset(order);
      setItems(order.items || []);
      setActiveTab("edit");
      loadHistory();
    }
  }, [open, order, reset]);

  // Real-time subscription for history updates
  useEffect(() => {
    if (!open || !order?.id) return;

    const channel = supabase
      .channel(`order_history_${order.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_history',
          filter: `order_id=eq.${order.id}`
        },
        () => {
          loadHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, order?.id]);

  const addItem = () => {
    setItems([...items, {
      itemCode: "",
      itemDescription: "",
      unit: "UND",
      requestedQuantity: 0,
      warehouse: "",
      deliveryDate: "",
      deliveredQuantity: 0
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const onSubmit = (data: Order) => {
    const updatedOrder = { ...data, id: order.id, items };
    onSave(updatedOrder);
    onOpenChange(false);
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "Pendente",
      planned: "Planejado",
      in_production: "Em Produção",
      in_transit: "Em Trânsito",
      delivered: "Entregue",
      completed: "Concluído",
      cancelled: "Cancelado",
      in_analysis: "Em Análise",
      awaiting_approval: "Aguardando Aprovação",
      separation_started: "Separação Iniciada",
      awaiting_material: "Aguardando Material",
      separation_completed: "Separação Concluída",
      production_completed: "Produção Concluída",
      in_quality_check: "Em Conferência de Qualidade",
      in_packaging: "Em Embalagem",
      ready_for_shipping: "Pronto para Expedição",
      released_for_shipping: "Liberado para Expedição",
      in_expedition: "Em Expedição",
      pickup_scheduled: "Coleta Agendada",
      awaiting_pickup: "Aguardando Coleta",
      collected: "Coletado",
      on_hold: "Em Espera",
      delayed: "Atrasado",
      returned: "Devolvido"
    };
    return statusMap[status] || status;
  };

  const getEventIcon = (oldStatus: string, newStatus: string) => {
    if (newStatus === "cancelled") return <XCircle className="h-4 w-4 text-red-500" />;
    if (newStatus === "completed" || newStatus === "delivered") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (newStatus === "pending") return <FileText className="h-4 w-4 text-blue-500" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getEventBadgeVariant = (status: string): "default" | "destructive" | "secondary" => {
    if (status === "completed" || status === "delivered") return "default";
    if (status === "cancelled") return "destructive";
    return "secondary";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Pedido #{order?.orderNumber}</DialogTitle>
          <DialogDescription>
            Visualize e edite os detalhes do pedido ou acompanhe seu histórico de movimentações
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Editar
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-4">
            <ScrollArea className="h-[600px] pr-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Tipo</Label>
                    <Select onValueChange={(value) => setValue("type", value as any)} defaultValue={order?.type}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Produção</SelectItem>
                        <SelectItem value="sales">Vendas</SelectItem>
                        <SelectItem value="materials">Materiais</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Prioridade</Label>
                    <Select onValueChange={(value) => setValue("priority", value as any)} defaultValue={order?.priority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="client">Cliente</Label>
                    <Input {...register("client", { required: true })} />
                  </div>
                  <div>
                    <Label htmlFor="deskTicket">Nº Chamado Desk</Label>
                    <Input {...register("deskTicket", { required: true })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select onValueChange={(value) => setValue("status", value as any)} defaultValue={order?.status}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="planned">Planejado</SelectItem>
                        <SelectItem value="in_production">Em Produção</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="deliveryDeadline">Prazo de Entrega</Label>
                    <Input {...register("deliveryDeadline", { required: true })} type="date" />
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">Itens do Pedido</Label>
                    <Button type="button" onClick={addItem} size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Adicionar Item
                    </Button>
                  </div>

                  {items.length === 0 ? (
                    <Card className="p-6 text-center text-muted-foreground">
                      Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {items.map((item, index) => (
                        <Card key={index} className="p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="font-semibold">Item {index + 1}</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Código</Label>
                              <Input
                                value={item.itemCode}
                                onChange={(e) => updateItem(index, "itemCode", e.target.value)}
                                placeholder="Ex: ITEM-001"
                              />
                            </div>
                            <div>
                              <Label>UND</Label>
                              <Input
                                value={item.unit}
                                onChange={(e) => updateItem(index, "unit", e.target.value)}
                                placeholder="Ex: UND, KG, M"
                              />
                            </div>
                          </div>

                          <div>
                            <Label>Descrição</Label>
                            <Input
                              value={item.itemDescription}
                              onChange={(e) => updateItem(index, "itemDescription", e.target.value)}
                              placeholder="Descrição do item"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Quantidade Solicitada</Label>
                              <Input
                                type="number"
                                value={item.requestedQuantity}
                                onChange={(e) => updateItem(index, "requestedQuantity", parseInt(e.target.value) || 0)}
                                min="0"
                              />
                            </div>
                            <div>
                              <Label>Armazém</Label>
                              <Input
                                value={item.warehouse}
                                onChange={(e) => updateItem(index, "warehouse", e.target.value)}
                                placeholder="Local de armazenamento"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Data de Entrega</Label>
                              <Input
                                type="date"
                                value={item.deliveryDate}
                                onChange={(e) => updateItem(index, "deliveryDate", e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Quantidade Entregue</Label>
                              <Input
                                type="number"
                                value={item.deliveredQuantity}
                                onChange={(e) => updateItem(index, "deliveredQuantity", parseInt(e.target.value) || 0)}
                                min="0"
                              />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Cliente</p>
                  <p className="text-sm text-muted-foreground">{order?.client}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Chamado Desk</p>
                  <p className="text-sm text-muted-foreground">{order?.deskTicket}</p>
                </div>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center h-[400px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : historyEvents.length === 0 ? (
                <Card className="p-8 text-center">
                  <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhuma movimentação registrada ainda
                  </p>
                </Card>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {historyEvents.map((event) => (
                      <div key={event.id} className="flex gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0">
                          {getEventIcon(event.old_status, event.new_status)}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Mudança de Status</h4>
                            <Badge variant={getEventBadgeVariant(event.new_status)} className="text-xs">
                              {getStatusLabel(event.new_status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            De <span className="font-medium">{getStatusLabel(event.old_status)}</span> para{" "}
                            <span className="font-medium">{getStatusLabel(event.new_status)}</span>
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(event.changed_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};