import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  PackageCheck,
  Boxes,
  Truck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Order } from "./Dashboard";
import { toast } from "@/hooks/use-toast";

interface PhaseManagementDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
}

const phases = [
  {
    id: "preparation",
    label: "Preparação",
    icon: ClipboardList,
    color: "hsl(var(--chart-1))",
    statuses: [
      { value: "pending", label: "Pendente (Novo)" },
      { value: "in_analysis", label: "Em Análise" },
      { value: "awaiting_approval", label: "Aguardando Aprovação" },
      { value: "planned", label: "Planejado" },
    ],
  },
  {
    id: "production",
    label: "Separação/Produção",
    icon: PackageCheck,
    color: "hsl(var(--chart-2))",
    statuses: [
      { value: "separation_started", label: "Iniciado a Separação" },
      { value: "in_production", label: "Em Produção" },
      { value: "awaiting_material", label: "Aguardando Material" },
      { value: "separation_completed", label: "Concluído a Separação" },
      { value: "production_completed", label: "Concluído a Produção" },
    ],
  },
  {
    id: "packaging",
    label: "Embalagem",
    icon: Boxes,
    color: "hsl(var(--chart-3))",
    statuses: [
      { value: "in_quality_check", label: "Em Conferência/Qualidade" },
      { value: "in_packaging", label: "Em Embalagem" },
      { value: "ready_for_shipping", label: "Pronto para Envio" },
    ],
  },
  {
    id: "logistics",
    label: "Expedição",
    icon: Truck,
    color: "hsl(var(--chart-4))",
    statuses: [
      { value: "released_for_shipping", label: "Liberado para Envio" },
      { value: "in_expedition", label: "Deixado na Expedição" },
      { value: "in_transit", label: "Em Trânsito" },
      { value: "pickup_scheduled", label: "Retirada Agendada" },
      { value: "awaiting_pickup", label: "Aguardando Retirada" },
    ],
  },
  {
    id: "completion",
    label: "Conclusão",
    icon: CheckCircle2,
    color: "hsl(var(--chart-5))",
    statuses: [
      { value: "delivered", label: "Entregue" },
      { value: "completed", label: "Finalizado" },
    ],
  },
  {
    id: "exceptions",
    label: "Exceções",
    icon: AlertCircle,
    color: "hsl(var(--destructive))",
    statuses: [
      { value: "cancelled", label: "Cancelado" },
      { value: "on_hold", label: "Em Espera" },
      { value: "delayed", label: "Atrasado" },
      { value: "returned", label: "Devolvido" },
    ],
  },
];

export const PhaseManagementDialog = ({
  order,
  open,
  onOpenChange,
  onStatusChange,
}: PhaseManagementDialogProps) => {
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  React.useEffect(() => {
    if (order && open) {
      setSelectedStatus(order.status);
    }
  }, [order, open]);

  if (!order) return null;

  const currentPhase = phases.find((phase) =>
    phase.statuses.some((s) => s.value === order.status)
  );

  const handleSave = () => {
    if (selectedStatus && selectedStatus !== order.status) {
      onStatusChange(order.id, selectedStatus as Order["status"]);
      toast({
        title: "Status atualizado",
        description: `Status do pedido ${order.orderNumber} foi atualizado com sucesso.`,
      });
    }
    onOpenChange(false);
  };

  const Icon = currentPhase?.icon || ClipboardList;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" style={{ color: currentPhase?.color }} />
            Gestão de Fase - {order.orderNumber}
          </DialogTitle>
          <DialogDescription>
            Selecione o novo status para o pedido dentro da fase atual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Fase Atual:</span>
            <Badge variant="outline" style={{ borderColor: currentPhase?.color }}>
              {currentPhase?.label}
            </Badge>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Opções de Status Disponíveis:
            </Label>
            <RadioGroup value={selectedStatus} onValueChange={setSelectedStatus}>
              {currentPhase?.statuses.map((status) => (
                <div
                  key={status.value}
                  className="flex items-center space-x-2 rounded-md border p-3 hover:bg-accent"
                >
                  <RadioGroupItem value={status.value} id={status.value} />
                  <Label
                    htmlFor={status.value}
                    className="flex-1 cursor-pointer font-normal"
                  >
                    {status.label}
                  </Label>
                  {order.status === status.value && (
                    <Badge variant="secondary" className="text-xs">
                      Atual
                    </Badge>
                  )}
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!selectedStatus || selectedStatus === order.status}>
            Salvar Alteração
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
