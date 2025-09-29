import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";

interface OrderFormData {
  type: string;
  priority: string;
  itemCode: string;
  itemDescription: string;
  requestedQuantity: number;
  receivedQuantity: number;
  deliveryStatus: string;
  client: string;
  deliveryDeadline: string;
  deskTicket: string;
}

interface AddOrderDialogProps {
  onAddOrder: (order: OrderFormData) => void;
}

export const AddOrderDialog = ({ onAddOrder }: AddOrderDialogProps) => {
  const [open, setOpen] = React.useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm<OrderFormData>();

  const orderType = watch("type");

  const onSubmit = (data: OrderFormData) => {
    onAddOrder(data);
    toast({
      title: "Pedido criado com sucesso!",
      description: `Novo ${getTypeLabel(data.type)} foi adicionado.`,
    });
    reset();
    setOpen(false);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "production": return "Pedido de Produção";
      case "sales": return "Pedido de Venda";
      case "materials": return "Remessa de Materiais";
      default: return "Pedido";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Novo Lançamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar Novo Lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Tipo de Pedido</Label>
              <Select onValueChange={(value) => setValue("type", value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Pedidos de Produção</SelectItem>
                  <SelectItem value="sales">Pedidos de Venda</SelectItem>
                  <SelectItem value="materials">Remessa de Materiais</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Prioridade</Label>
              <Select onValueChange={(value) => setValue("priority", value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a prioridade" />
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
              <Label htmlFor="itemCode">Código do Item</Label>
              <Input {...register("itemCode", { required: true })} placeholder="Ex: ITEM-001" />
            </div>
            <div>
              <Label htmlFor="requestedQuantity">Quantidade Solicitada</Label>
              <Input 
                {...register("requestedQuantity", { required: true, valueAsNumber: true })} 
                type="number" 
                placeholder="Quantidade solicitada" 
                min="0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="itemDescription">Descrição do Item</Label>
            <Textarea {...register("itemDescription", { required: true })} placeholder="Descrição detalhada do item" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="receivedQuantity">Quantidade Recebida</Label>
              <Input 
                {...register("receivedQuantity", { valueAsNumber: true })} 
                type="number" 
                placeholder="Quantidade recebida" 
                min="0"
                defaultValue={0}
              />
            </div>
            <div>
              <Label htmlFor="deliveryStatus">Status de Entrega</Label>
              <Select onValueChange={(value) => setValue("deliveryStatus", value)} defaultValue="pending">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="complete">Entregue - Pedido Completo</SelectItem>
                  <SelectItem value="partial">Entregue - Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client">Cliente</Label>
              <Input {...register("client", { required: true })} placeholder="Nome do cliente" />
            </div>
            <div>
              <Label htmlFor="deskTicket">Nº Chamado Desk</Label>
              <Input {...register("deskTicket", { required: true })} placeholder="Ex: DSK-2024-001" />
            </div>
          </div>

          <div>
            <Label htmlFor="deliveryDeadline">Prazo de Entrega</Label>
            <Input 
              {...register("deliveryDeadline", { required: true })} 
              type="date" 
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Criar {orderType && getTypeLabel(orderType)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};