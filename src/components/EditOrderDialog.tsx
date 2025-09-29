import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, User, FileText, CheckCircle, XCircle, Clock, History, Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { Order } from "./Dashboard";

interface HistoryEvent {
  id: string;
  date: string;
  time: string;
  action: string;
  description: string;
  user: string;
  type: "created" | "updated" | "approved" | "cancelled" | "completed" | "attachment";
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

  React.useEffect(() => {
    if (open && order) {
      reset(order);
      setActiveTab("edit"); // Reset to edit tab when opening
    }
  }, [open, order, reset]);

  const onSubmit = (data: Order) => {
    onSave({ ...data, id: order.id });
    onOpenChange(false);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "production": return "Produção";
      case "sales": return "Vendas";
      case "materials": return "Materiais";
      default: return type;
    }
  };

  // Mock history data - in real app this would come from API
  const historyEvents: HistoryEvent[] = [
    {
      id: "1",
      date: order?.createdDate || "2024-01-15",
      time: "14:30",
      action: "Pedido Criado",
      description: `Pedido ${order?.orderNumber} criado com prioridade ${order?.priority}`,
      user: "João Silva",
      type: "created"
    },
    {
      id: "2",
      date: order?.createdDate || "2024-01-15",
      time: "14:45",
      action: "Documento Anexado",
      description: "Especificações técnicas anexadas",
      user: "Maria Santos",
      type: "attachment"
    },
    {
      id: "3",
      date: order?.createdDate || "2024-01-16",
      time: "09:15",
      action: "Pedido Atualizado",
      description: "Quantidade alterada",
      user: "Carlos Oliveira",
      type: "updated"
    },
    {
      id: "4",
      date: order?.createdDate || "2024-01-16",
      time: "11:20",
      action: "Status Alterado",
      description: `Status alterado para ${order?.status}`,
      user: "Ana Costa",
      type: "approved"
    },
  ];

  const getEventIcon = (type: HistoryEvent["type"]) => {
    switch (type) {
      case "created":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "updated":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "attachment":
        return <FileText className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventBadgeVariant = (type: HistoryEvent["type"]) => {
    switch (type) {
      case "approved":
      case "completed":
        return "default" as const;
      case "cancelled":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Pedido #{order?.orderNumber}</DialogTitle>
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
                  <Label htmlFor="item">Item</Label>
                  <Input {...register("item", { required: true })} />
                </div>
                <div>
                  <Label htmlFor="quantity">Quantidade</Label>
                  <Input {...register("quantity", { required: true, valueAsNumber: true })} type="number" />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea {...register("description", { required: true })} />
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

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Salvar Alterações
                </Button>
              </div>
            </form>
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

              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {historyEvents.map((event) => (
                    <div key={event.id} className="flex gap-4 p-4 border rounded-lg">
                      <div className="flex-shrink-0">
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{event.action}</h4>
                          <Badge variant={getEventBadgeVariant(event.type)} className="text-xs">
                            {event.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(event.date).toLocaleDateString('pt-BR')} às {event.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {event.user}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};