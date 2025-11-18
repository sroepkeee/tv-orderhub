import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderTypeSelector } from "@/components/OrderTypeSelector";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings } from "lucide-react";
import { useDuplicateOrderCheck } from "@/hooks/useDuplicateOrderCheck";
import { DuplicateOrderWarningDialog } from "@/components/DuplicateOrderWarningDialog";

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
  item_status?: 'pending' | 'in_stock' | 'awaiting_production' | 'purchase_required' | 'purchase_requested' | 'completed';
  production_estimated_date?: string;
  userId?: string;
  sla_days?: number | null;
  is_imported?: boolean;
  import_lead_time_days?: number | null;
  sla_deadline?: string;
  current_phase?: string;
  phase_started_at?: string;
  // Campos de controle de compra
  purchase_action_started?: boolean;
  purchase_action_started_at?: string;
  purchase_action_started_by?: string;
}

interface OrderFormData {
  type: string;
  priority: string;
  client: string;
  deliveryDeadline: string;
  deskTicket: string;
  totvsOrderNumber?: string;
  items: OrderItem[];
  pdfFile?: File;
  requires_firmware?: boolean;
  firmware_project_name?: string;
  requires_image?: boolean;
  image_project_name?: string;
}

interface AddOrderDialogProps {
  onAddOrder: (order: OrderFormData) => void;
}

export const AddOrderDialog = ({ onAddOrder }: AddOrderDialogProps) => {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<OrderItem[]>([]);
  const [selectedPdfFile, setSelectedPdfFile] = React.useState<File | null>(null);
  const [requiresFirmware, setRequiresFirmware] = React.useState(false);
  const [requiresImage, setRequiresImage] = React.useState(false);
  const [duplicateWarning, setDuplicateWarning] = React.useState<{
    show: boolean;
    existingOrder: any;
    newOrderData: any;
    duplicateType: 'totvs' | 'internal' | 'combined' | null;
  }>({ show: false, existingOrder: null, newOrderData: null, duplicateType: null });
  const { register, handleSubmit, reset, setValue, watch } = useForm<OrderFormData>();
  const { checkDuplicate, isChecking } = useDuplicateOrderCheck();

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

  const onSubmit = async (data: OrderFormData) => {
    const hasItems = items.length > 0;
    const hasPdf = selectedPdfFile !== null;
    
    if (!hasItems && !hasPdf) {
      toast({
        title: "Dados incompletos",
        description: "Você deve adicionar itens manualmente OU anexar o pedido em PDF.",
        variant: "destructive"
      });
      return;
    }

    // Validar firmware e imagem
    if (requiresFirmware && !data.firmware_project_name?.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Informe o nome do projeto/firmware",
        variant: "destructive"
      });
      return;
    }
    
    if (requiresImage && !data.image_project_name?.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Informe o nome da imagem",
        variant: "destructive"
      });
      return;
    }

    // ✨ NOVO: Verificar duplicação antes de criar
    const orderNumber = `PED-${Date.now()}`;
    const duplicateCheck = await checkDuplicate({
      orderNumber,
      totvsOrderNumber: data.totvsOrderNumber,
      customerName: data.client,
      deliveryDate: data.deliveryDeadline
    });

    if (duplicateCheck.isDuplicate) {
      setDuplicateWarning({
        show: true,
        existingOrder: duplicateCheck.existingOrder,
        newOrderData: { ...data, orderNumber },
        duplicateType: duplicateCheck.duplicateType
      });
      return;
    }

    // Criar pedido normalmente
    await createOrder(data);
  };

  const createOrder = async (data: OrderFormData, duplicateInfo?: { 
    isDuplicateApproved: boolean; 
    approvalNote: string; 
    originalOrderId: string 
  }) => {
    const orderData = { ...data, items, pdfFile: selectedPdfFile || undefined };
    await onAddOrder(orderData);
    
    const itemsText = items.length > 0 ? `${items.length} item(ns)` : "PDF anexado";
    toast({
      title: "Pedido criado com sucesso!",
      description: `Novo ${getTypeLabel(data.type)} foi adicionado com ${itemsText}.`,
    });
    
    reset();
    setItems([]);
    setSelectedPdfFile(null);
    setRequiresFirmware(false);
    setRequiresImage(false);
    setOpen(false);
  };

  const handleConfirmDuplicate = async (approvalNote: string) => {
    const data = duplicateWarning.newOrderData;
    await createOrder(data, {
      isDuplicateApproved: true,
      approvalNote,
      originalOrderId: duplicateWarning.existingOrder.id
    });
    setDuplicateWarning({ show: false, existingOrder: null, newOrderData: null, duplicateType: null });
  };

  const handleViewExistingOrder = () => {
    // Fechar dialogs e disparar evento para abrir o pedido existente
    setDuplicateWarning({ show: false, existingOrder: null, newOrderData: null, duplicateType: null });
    setOpen(false);
    window.dispatchEvent(new CustomEvent('openOrder', { 
      detail: { orderId: duplicateWarning.existingOrder.id } 
    }));
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
        <Button data-add-order-trigger className="hidden">
          Trigger
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
              <OrderTypeSelector 
                value={orderType || ""} 
                onValueChange={(value) => setValue("type", value)} 
              />
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

          {/* Configurações de Firmware e Imagem */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuração de Placas (Laboratório)
            </Label>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Firmware */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="requires_firmware"
                    checked={requiresFirmware}
                    onCheckedChange={(checked) => {
                      const boolValue = checked as boolean;
                      setRequiresFirmware(boolValue);
                      setValue("requires_firmware", boolValue);
                      if (!boolValue) {
                        setValue("firmware_project_name", "");
                      }
                    }}
                  />
                  <Label htmlFor="requires_firmware" className="font-medium cursor-pointer">
                    🔧 Requer Firmware Específico
                  </Label>
                </div>
                
                {requiresFirmware && (
                  <div>
                    <Label htmlFor="firmware_project_name">Nome do Projeto/Firmware</Label>
                    <Input 
                      {...register("firmware_project_name")}
                      placeholder="Ex: FW_PLACA_V2.3.1"
                      maxLength={200}
                    />
                  </div>
                )}
              </Card>

              {/* Imagem */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="requires_image"
                    checked={requiresImage}
                    onCheckedChange={(checked) => {
                      const boolValue = checked as boolean;
                      setRequiresImage(boolValue);
                      setValue("requires_image", boolValue);
                      if (!boolValue) {
                        setValue("image_project_name", "");
                      }
                    }}
                  />
                  <Label htmlFor="requires_image" className="font-medium cursor-pointer">
                    💾 Requer Imagem Específica
                  </Label>
                </div>
                
                {requiresImage && (
                  <div>
                    <Label htmlFor="image_project_name">Nome da Imagem</Label>
                    <Input 
                      {...register("image_project_name")}
                      placeholder="Ex: IMG_LINUX_2024_Q1"
                      maxLength={200}
                    />
                  </div>
                )}
              </Card>
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
            <p className="text-xs text-muted-foreground">
              Opcional se você anexar o PDF do pedido
            </p>

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
                          step="0.01"
                          value={item.requestedQuantity}
                          onChange={(e) => updateItem(index, "requestedQuantity", parseFloat(e.target.value) || 0)}
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
                          step="0.01"
                          value={item.deliveredQuantity}
                          onChange={(e) => updateItem(index, "deliveredQuantity", parseFloat(e.target.value) || 0)}
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

          {/* Anexar PDF */}
          <div className="space-y-2 border-t pt-4">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Anexar Pedido PDF
            </Label>
            <p className="text-sm text-muted-foreground">
              Anexe o pedido em PDF (opcional se você adicionar itens manualmente) - máx. 10MB
            </p>
            
            <Card className="p-4">
              <Input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      toast({
                        title: "Arquivo muito grande",
                        description: "O PDF deve ter no máximo 10MB.",
                        variant: "destructive"
                      });
                      e.target.value = "";
                      return;
                    }
                    
                    if (file.type !== 'application/pdf') {
                      toast({
                        title: "Tipo inválido",
                        description: "Apenas arquivos PDF são aceitos.",
                        variant: "destructive"
                      });
                      e.target.value = "";
                      return;
                    }
                    
                    setSelectedPdfFile(file);
                    toast({
                      title: "PDF selecionado",
                      description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
                    });
                  }
                }}
                className="cursor-pointer"
              />
              
              {selectedPdfFile && (
                <div className="mt-3 flex items-center justify-between bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-sm">{selectedPdfFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedPdfFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPdfFile(null);
                      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                      if (input) input.value = "";
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {!selectedPdfFile && (
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Dica: Anexe o PDF OU adicione os itens manualmente acima
                </p>
              )}
            </Card>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isChecking}>
              {isChecking ? "Verificando..." : `Criar ${orderType && getTypeLabel(orderType)}`}
            </Button>
          </div>
        </form>

        {/* Dialog de Aviso de Duplicação */}
        <DuplicateOrderWarningDialog
          open={duplicateWarning.show}
          onOpenChange={(open) => {
            if (!open) {
              setDuplicateWarning({ show: false, existingOrder: null, newOrderData: null, duplicateType: null });
            }
          }}
          existingOrder={duplicateWarning.existingOrder}
          newOrderData={{
            orderNumber: duplicateWarning.newOrderData?.orderNumber,
            totvsOrderNumber: duplicateWarning.newOrderData?.totvsOrderNumber,
            customerName: duplicateWarning.newOrderData?.client,
            deliveryDate: duplicateWarning.newOrderData?.deliveryDeadline
          }}
          duplicateType={duplicateWarning.duplicateType}
          onConfirm={handleConfirmDuplicate}
          onViewExisting={handleViewExistingOrder}
        />
      </DialogContent>
    </Dialog>
  );
};