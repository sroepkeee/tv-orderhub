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
  item: string;
  description: string;
  quantity: number;
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
              <Label htmlFor="item">Item</Label>
              <Input {...register("item", { required: true })} placeholder="Nome do item" />
            </div>
            <div>
              <Label htmlFor="quantity">Quantidade</Label>
              <Input 
                {...register("quantity", { required: true, valueAsNumber: true })} 
                type="number" 
                placeholder="Quantidade" 
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea {...register("description", { required: true })} placeholder="Descrição do pedido" />
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