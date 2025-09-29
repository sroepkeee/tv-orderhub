import React from "react";
import { Button } from "@/components/ui/button";
import { 
  Edit2, 
  Copy, 
  Check, 
  X, 
  Paperclip, 
  History,
  Trash2,
  Eye
} from "lucide-react";
import { Order } from "./Dashboard";
import { EditOrderDialog } from "./EditOrderDialog";
import { OrderHistoryDialog } from "./OrderHistoryDialog";
import { FileUploadDialog } from "./FileUploadDialog";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { toast } from "@/hooks/use-toast";

interface ActionButtonsProps {
  order: Order;
  onEdit: (order: Order) => void;
  onDuplicate: (order: Order) => void;
  onApprove: (orderId: string) => void;
  onCancel: (orderId: string) => void;
}

export const ActionButtons = ({ 
  order, 
  onEdit, 
  onDuplicate, 
  onApprove, 
  onCancel 
}: ActionButtonsProps) => {
  const [editOpen, setEditOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const handleDuplicate = () => {
    onDuplicate(order);
    toast({
      title: "Pedido duplicado",
      description: `Pedido ${order.orderNumber} foi duplicado com sucesso.`,
    });
  };

  const handleApprove = () => {
    onApprove(order.id);
    toast({
      title: "Pedido aprovado",
      description: `Pedido ${order.orderNumber} foi aprovado.`,
    });
  };

  const handleCancel = () => {
    onCancel(order.id);
    setCancelOpen(false);
    toast({
      title: "Pedido cancelado",
      description: `Pedido ${order.orderNumber} foi cancelado.`,
      variant: "destructive",
    });
  };

  const handleFileUpload = (files: File[]) => {
    toast({
      title: "Arquivos anexados",
      description: `${files.length} arquivo(s) anexado(s) ao pedido ${order.orderNumber}.`,
    });
  };

  return (
    <div className="flex gap-1">
      <EditOrderDialog 
        order={order}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={onEdit}
      />
      
      <Button
        variant="ghost"
        size="icon"
        className="action-button h-8 w-8"
        onClick={() => setEditOpen(true)}
        title="Editar pedido"
      >
        <Edit2 className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="action-button h-8 w-8"
        onClick={handleDuplicate}
        title="Duplicar pedido"
      >
        <Copy className="h-4 w-4" />
      </Button>

      {order.status !== "approved" && order.status !== "completed" && (
        <Button
          variant="ghost"
          size="icon"
          className="action-button h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={handleApprove}
          title="Aprovar pedido"
        >
          <Check className="h-4 w-4" />
        </Button>
      )}

      {order.status !== "cancelled" && order.status !== "completed" && (
        <>
          <ConfirmationDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            title="Cancelar Pedido"
            description={`Tem certeza que deseja cancelar o pedido ${order.orderNumber}? Esta ação não pode ser desfeita.`}
            onConfirm={handleCancel}
            variant="destructive"
          />
          <Button
            variant="ghost"
            size="icon"
            className="action-button h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setCancelOpen(true)}
            title="Cancelar pedido"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      )}

      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={handleFileUpload}
        orderId={order.id}
      />
      <Button
        variant="ghost"
        size="icon"
        className="action-button h-8 w-8"
        onClick={() => setUploadOpen(true)}
        title="Anexar arquivos"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      <OrderHistoryDialog
        order={order}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      <Button
        variant="ghost"
        size="icon"
        className="action-button h-8 w-8"
        onClick={() => setHistoryOpen(true)}
        title="Ver histórico"
      >
        <History className="h-4 w-4" />
      </Button>
    </div>
  );
};