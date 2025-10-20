import React from "react";
import { Button } from "@/components/ui/button";
import { 
  ClipboardList, 
  PackageCheck, 
  Boxes, 
  Truck, 
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  XCircle,
  Check,
  Calculator,
  FileText
} from "lucide-react";
import { Order } from "./Dashboard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PhaseButtonsProps {
  order: Order;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
}

export const PhaseButtons = ({ order, onStatusChange }: PhaseButtonsProps) => {
  const [optimisticStatus, setOptimisticStatus] = React.useState<string | null>(null);
  const currentStatus = optimisticStatus || order.status;

  const phases = [
    {
      id: "preparation",
      label: "Preparação",
      icon: ClipboardList,
      color: "text-blue-600",
      statuses: [
        { value: "pending", label: "Pendente (Novo)" },
        { value: "in_analysis", label: "Em Análise" },
        { value: "awaiting_approval", label: "Aguardando Aprovação" },
        { value: "planned", label: "Planejado" },
      ]
    },
    {
      id: "production",
      label: "Separação/Produção",
      icon: PackageCheck,
      color: "text-purple-600",
      statuses: [
        { value: "separation_started", label: "Iniciado a Separação" },
        { value: "in_production", label: "Em Produção" },
        { value: "awaiting_material", label: "Aguardando Material" },
        { value: "separation_completed", label: "Concluído a Separação" },
        { value: "production_completed", label: "Concluído a Produção" },
      ]
    },
    {
      id: "packaging",
      label: "Embalagem",
      icon: Boxes,
      color: "text-orange-600",
      statuses: [
        { value: "in_quality_check", label: "Em Conferência/Qualidade" },
        { value: "in_packaging", label: "Em Embalagem" },
        { value: "ready_for_shipping", label: "Pronto para Envio" },
      ]
    },
    {
      id: "freight_quote",
      label: "Cotação de Frete",
      icon: Calculator,
      color: "text-amber-600",
      statuses: [
        { value: "freight_quote_requested", label: "Cotação Solicitada" },
        { value: "freight_quote_received", label: "Cotação Recebida" },
        { value: "freight_approved", label: "Frete Aprovado" },
      ]
    },
    {
      id: "logistics",
      label: "Expedição",
      icon: Truck,
      color: "text-cyan-600",
      statuses: [
        { value: "released_for_shipping", label: "Liberado para Envio" },
        { value: "in_expedition", label: "Deixado na Expedição" },
        { value: "in_transit", label: "Em Trânsito" },
        { value: "pickup_scheduled", label: "Retirada Agendada" },
        { value: "awaiting_pickup", label: "Aguardando Retirada" },
        { value: "collected", label: "Coletado" },
      ]
    },
    {
      id: "invoicing",
      label: "Faturamento",
      icon: FileText,
      color: "text-emerald-600",
      statuses: [
        { value: "awaiting_invoice", label: "Aguardando Faturamento" },
        { value: "invoice_issued", label: "Nota Fiscal Emitida" },
        { value: "invoice_sent", label: "NF Enviada ao Cliente" },
      ]
    },
    {
      id: "completion",
      label: "Conclusão",
      icon: CheckCircle2,
      color: "text-green-600",
      statuses: [
        { value: "delivered", label: "Entregue" },
        { value: "completed", label: "Finalizado" },
      ]
    },
    {
      id: "exceptions",
      label: "Exceções",
      icon: AlertCircle,
      color: "text-red-600",
      statuses: [
        { value: "cancelled", label: "Cancelado" },
        { value: "on_hold", label: "Em Espera" },
        { value: "delayed", label: "Atrasado" },
        { value: "returned", label: "Devolvido" },
      ]
    },
  ];

  return (
    <div className="flex gap-2">
      {phases.map((phase) => {
        const Icon = phase.icon;
        const isCurrentPhase = phase.statuses.some(s => s.value === currentStatus);
        
        return (
          <DropdownMenu key={phase.id}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={isCurrentPhase ? "default" : "outline"}
                size="sm"
                className={`gap-2 ${isCurrentPhase ? '' : phase.color}`}
              >
                <Icon className="h-4 w-4" />
                {phase.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DropdownMenuLabel>{phase.label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {phase.statuses.map((status) => (
                <DropdownMenuItem
                  key={status.value}
                  onClick={() => {
                    setOptimisticStatus(status.value);
                    onStatusChange(order.id, status.value as Order["status"]);
                    setTimeout(() => setOptimisticStatus(null), 2000);
                  }}
                  className={currentStatus === status.value ? "bg-accent" : ""}
                >
                  {currentStatus === status.value && (
                    <Check className="h-4 w-4 mr-2 text-green-600 font-bold" />
                  )}
                  {status.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </div>
  );
};
