import React from "react";
import { Button } from "@/components/ui/button";
import { 
  PackageSearch,
  FileEdit,
  Warehouse,
  PackageCheck, 
  Receipt,
  Microscope,
  Boxes, 
  Calculator,
  FileText,
  Truck, 
  CheckCircle2,
  AlertCircle,
  Check,
  ClipboardCheck,
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
import { usePhaseAuthorization } from "@/hooks/usePhaseAuthorization";

interface PhaseButtonsProps {
  order: Order;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
}

export const PhaseButtons = ({ order, onStatusChange }: PhaseButtonsProps) => {
  const [optimisticStatus, setOptimisticStatus] = React.useState<string | null>(null);
  const currentStatus = optimisticStatus || order.status;
  const { canEditPhase } = usePhaseAuthorization();

  const phases = [
    {
      id: "almox_ssm",
      label: "Almox SSM",
      icon: PackageSearch,
      color: "text-blue-600",
      statuses: [
        { value: "almox_ssm_received", label: "Recebido SSM" },
        { value: "almox_ssm_in_review", label: "Em Análise SSM" },
        { value: "almox_ssm_approved", label: "Aprovado SSM" },
      ]
    },
    {
      id: "order_generation",
      label: "Gerar Ordem",
      icon: FileEdit,
      color: "text-indigo-600",
      statuses: [
        { value: "order_generation_pending", label: "Pendente Ordem" },
        { value: "order_in_creation", label: "Criando Ordem" },
        { value: "order_generated", label: "Ordem Gerada" },
      ]
    },
    {
      id: "almox_general",
      label: "Almox Geral",
      icon: Warehouse,
      color: "text-violet-600",
      statuses: [
        { value: "almox_general_received", label: "Recebido Almox" },
        { value: "almox_general_separating", label: "Separando" },
        { value: "almox_general_ready", label: "Pronto Almox" },
      ]
    },
    {
      id: "production",
      label: "Produção",
      icon: PackageCheck,
      color: "text-purple-600",
      statuses: [
        { value: "separation_started", label: "Iniciado Separação" },
        { value: "in_production", label: "Em Produção" },
        { value: "awaiting_material", label: "Aguardando Material" },
        { value: "separation_completed", label: "Separação Concluída" },
        { value: "production_completed", label: "Produção Concluída" },
      ]
    },
    {
      id: "balance_generation",
      label: "Gerar Saldo",
      icon: Receipt,
      color: "text-fuchsia-600",
      statuses: [
        { value: "balance_calculation", label: "Calculando Saldo" },
        { value: "balance_review", label: "Revisando Saldo" },
        { value: "balance_approved", label: "Saldo Aprovado" },
      ]
    },
    {
      id: "laboratory",
      label: "Laboratório",
      icon: Microscope,
      color: "text-pink-600",
      statuses: [
        { value: "awaiting_lab", label: "Aguardando Lab" },
        { value: "in_lab_analysis", label: "Em Análise Lab" },
        { value: "lab_completed", label: "Lab Concluído" },
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
      id: "ready_to_invoice",
      label: "À Faturar",
      icon: ClipboardCheck,
      color: "text-teal-600",
      statuses: [
        { value: "ready_to_invoice", label: "Pronto para Faturar" },
        { value: "pending_invoice_request", label: "Aguardando Solicitação" },
      ]
    },
    {
      id: "invoicing",
      label: "Solicitado Faturamento",
      icon: FileText,
      color: "text-emerald-600",
      statuses: [
        { value: "invoice_requested", label: "Faturamento Solicitado" },
        { value: "awaiting_invoice", label: "Processando Faturamento" },
        { value: "invoice_issued", label: "Nota Fiscal Emitida" },
        { value: "invoice_sent", label: "NF Enviada ao Cliente" },
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
    <div className="flex gap-2 flex-wrap">
      {phases.map((phase) => {
        const Icon = phase.icon;
        const isCurrentPhase = phase.statuses.some(s => s.value === currentStatus);
        const canEdit = canEditPhase(phase.id);
        
        return (
          <DropdownMenu key={phase.id}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant={isCurrentPhase ? "default" : "outline"}
                size="sm"
                className={`gap-2 ${isCurrentPhase ? '' : phase.color}`}
                disabled={!canEdit}
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
                  disabled={!canEdit}
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
