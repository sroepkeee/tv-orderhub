import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface OrderItem {
  id?: string;
  itemCode: string;
  itemDescription: string;
  unit: string;
  requestedQuantity: number;
  warehouse: string;
  deliveryDate: string;
  deliveredQuantity: number;
  received_status?: 'pending' | 'partial' | 'completed';
  item_source_type?: 'in_stock' | 'production' | 'out_of_stock';
  production_estimated_date?: string;
}

interface OrderFormData {
  type: string;
  priority: string;
  client: string;
  deliveryDeadline: string;
  deskTicket: string;
  totvsOrderNumber?: string;
  items: OrderItem[];
}

interface AddOrderDialogProps {
  onAddOrder: (order: OrderFormData) => void;
}

export const AddOrderDialog = ({ onAddOrder }: AddOrderDialogProps) => {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<OrderItem[]>([]);
  const { register, handleSubmit, reset, setValue, watch } = useForm<OrderFormData>();

  const orderType = watch("type");

  const addItem = () => {
    setItems([...items, {
      itemCode: "",
      itemDescription: "",
      unit: "UND",
      requestedQuantity: 0,
      warehouse: "",
      deliveryDate: "",
      deliveredQuantity: 0,
      item_source_type: "in_stock"
    }]);
  };

  const getSourceBadge = (type?: 'in_stock' | 'production' | 'out_of_stock') => {
    const badges = {
      in_stock: <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">✅ Em Estoque</Badge>,
      production: <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">🏭 Produção</Badge>,
      out_of_stock: <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">⚠️ Sem Estoque</Badge>
    };
    return type ? badges[type] : badges.in_stock;
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const onSubmit = (data: OrderFormData) => {
    if (items.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um item ao pedido.",
        variant: "destructive"
      });
      return;
    }

    const orderData = { ...data, items };
    onAddOrder(orderData);
    toast({
      title: "Pedido criado com sucesso!",
      description: `Novo ${getTypeLabel(data.type)} foi adicionado com ${items.length} item(ns).`,
    });
    reset();
    setItems([]);
    setOpen(false);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "production": return "Pedido de Produção";
      case "sales": return "Pedido de Venda";
      case "materials": return "Remessa de Materiais";
      case "ecommerce": return "Pedido E-commerce";
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
                  <SelectItem value="ecommerce">E-commerce</SelectItem>
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
              <Label htmlFor="client">Cliente</Label>
              <Input {...register("client", { required: true })} placeholder="Nome do cliente" />
            </div>
            <div>
              <Label htmlFor="deskTicket">Nº Chamado Desk</Label>
              <Input {...register("deskTicket", { required: true })} placeholder="Ex: DSK-2024-001" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="totvsOrderNumber">Nº Pedido TOTVS</Label>
              <Input 
                {...register("totvsOrderNumber")} 
                placeholder="Ex: 123456"
                maxLength={50}
              />
            </div>
            <div>
              <Label htmlFor="deliveryDeadline">Prazo de Entrega</Label>
              <Input 
                {...register("deliveryDeadline", { required: true })} 
                type="date" 
              />
            </div>
          </div>

          <div className="space-y-4">
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
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {items.map((item, index) => (
                  <Card key={index} className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="font-semibold">Item {index + 1}</Label>
                        {getSourceBadge(item.item_source_type)}
                      </div>
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
                          className="h-10 text-base"
                        />
                      </div>
                      <div>
                        <Label>UND</Label>
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(index, "unit", e.target.value)}
                          placeholder="Ex: UND, KG, M"
                          className="h-10 text-base"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Descrição</Label>
                      <Input
                        value={item.itemDescription}
                        onChange={(e) => updateItem(index, "itemDescription", e.target.value)}
                        placeholder="Descrição do item"
                        className="h-10 text-base"
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
                          className="h-10 text-base"
                        />
                      </div>
                      <div>
                        <Label>Armazém</Label>
                        <Input
                          value={item.warehouse}
                          onChange={(e) => updateItem(index, "warehouse", e.target.value)}
                          placeholder="Local de armazenamento"
                          className="h-10 text-base"
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
                          className="h-10 text-base"
                        />
                      </div>
                      <div>
                        <Label>Quantidade Entregue</Label>
                        <Input
                          type="number"
                          value={item.deliveredQuantity}
                          onChange={(e) => updateItem(index, "deliveredQuantity", parseInt(e.target.value) || 0)}
                          min="0"
                          className="h-10 text-base"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Situação do Item</Label>
                        <Select 
                          value={item.item_source_type || 'in_stock'}
                          onValueChange={(value: 'in_stock' | 'production' | 'out_of_stock') => updateItem(index, "item_source_type", value)}
                        >
                          <SelectTrigger className="h-10 text-base">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in_stock">✅ Disponível em Estoque</SelectItem>
                            <SelectItem value="production">🏭 Enviar para Produção</SelectItem>
                            <SelectItem value="out_of_stock">⚠️ Sem Estoque / Sem Controle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {item.item_source_type === 'production' && (
                        <div>
                          <Label>Previsão Produção</Label>
                          <Input
                            type="date"
                            value={item.production_estimated_date || ''}
                            onChange={(e) => updateItem(index, "production_estimated_date", e.target.value)}
                            className="h-10 text-base"
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
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