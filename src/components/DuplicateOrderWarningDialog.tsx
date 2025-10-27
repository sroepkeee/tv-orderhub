import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Package, Calendar, User, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getStatusLabel } from "@/lib/statusLabels";

interface DuplicateOrderWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingOrder: any;
  newOrderData: {
    orderNumber?: string;
    totvsOrderNumber?: string;
    customerName?: string;
    deliveryDate?: string;
  };
  duplicateType: 'totvs' | 'internal' | 'combined' | null;
  onConfirm: (approvalNote: string) => void;
  onViewExisting: () => void;
}

export const DuplicateOrderWarningDialog = ({
  open,
  onOpenChange,
  existingOrder,
  newOrderData,
  duplicateType,
  onConfirm,
  onViewExisting,
}: DuplicateOrderWarningDialogProps) => {
  const [approvalNote, setApprovalNote] = useState("");

  const handleConfirm = () => {
    onConfirm(approvalNote);
    setApprovalNote("");
  };

  const getDuplicateMessage = () => {
    switch (duplicateType) {
      case 'totvs':
        return 'Este número TOTVS já existe no sistema';
      case 'internal':
        return 'Este número de pedido já foi utilizado';
      case 'combined':
        return 'Encontramos um pedido similar com o mesmo cliente e data próxima';
      default:
        return 'Pedido duplicado detectado';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Pedido Duplicado Detectado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
            <p className="text-sm font-medium text-warning-foreground">
              ⚠️ {getDuplicateMessage()}
            </p>
          </div>

          {/* Pedido Existente */}
          <Card className="border-2 border-primary/20">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  📦 Pedido Existente
                </h3>
                <Badge variant="outline">{getStatusLabel(existingOrder?.status)}</Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Nº Pedido:</span>
                  <p className="font-medium">{existingOrder?.order_number}</p>
                </div>
                {existingOrder?.totvs_order_number && (
                  <div>
                    <span className="text-muted-foreground">Nº TOTVS:</span>
                    <p className="font-medium">{existingOrder.totvs_order_number}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Cliente:
                  </span>
                  <p className="font-medium">{existingOrder?.customer_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Data Entrega:
                  </span>
                  <p className="font-medium">
                    {existingOrder?.delivery_date && 
                      format(new Date(existingOrder.delivery_date), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Criado em:</span>
                  <p className="font-medium">
                    {existingOrder?.created_at && 
                      format(new Date(existingOrder.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Novo Pedido */}
          <Card className="border-2 border-accent/20">
            <div className="p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-accent" />
                🆕 Novo Pedido
              </h3>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Nº Pedido:</span>
                  <p className="font-medium">{newOrderData.orderNumber || '-'}</p>
                </div>
                {newOrderData.totvsOrderNumber && (
                  <div>
                    <span className="text-muted-foreground">Nº TOTVS:</span>
                    <p className="font-medium">{newOrderData.totvsOrderNumber}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Cliente:
                  </span>
                  <p className="font-medium">{newOrderData.customerName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Data Entrega:
                  </span>
                  <p className="font-medium">
                    {newOrderData.deliveryDate && 
                      format(new Date(newOrderData.deliveryDate), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Campo de Observação */}
          <div className="space-y-2">
            <Label htmlFor="approval_note" className="text-sm font-medium">
              Motivo da Duplicação (opcional)
            </Label>
            <Textarea
              id="approval_note"
              placeholder="Ex: Pedido complementar, Reenvio aprovado pelo cliente, etc."
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              maxLength={500}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {approvalNote.length}/500 caracteres
            </p>
          </div>

          <div className="bg-muted rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">
              💡 <strong>Dica:</strong> Esta ação será registrada no histórico do pedido para auditoria.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={onViewExisting}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Ver Pedido Existente
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            className="gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            Confirmar Duplicação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
