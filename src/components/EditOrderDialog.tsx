import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { Order } from "./Dashboard";

interface EditOrderDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (order: Order) => void;
}

export const EditOrderDialog = ({ order, open, onOpenChange, onSave }: EditOrderDialogProps) => {
  const { register, handleSubmit, setValue, reset } = useForm<Order>();

  React.useEffect(() => {
    if (open && order) {
      reset(order);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Pedido #{order?.orderNumber}</DialogTitle>
        </DialogHeader>
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
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
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
      </DialogContent>
    </Dialog>
  );
};