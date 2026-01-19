import React from "react";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  ClipboardCheck,
  ShoppingCart,
} from "lucide-react";
import { Order } from "./Dashboard";
import { getStatusLabel } from "@/lib/statusLabels";

interface UnifiedStatusSelectorProps {
  currentStatus: string;
  orderCategory?: string;
  onStatusChange: (newStatus: string) => void;
  disabled?: boolean;
}

const phases = [
  {
    id: "almox_ssm",
    label: "📦 Almox SSM",
    icon: PackageSearch,
    statuses: [
      { value: "almox_ssm_pending", label: "Aguardando SSM" },
      { value: "almox_ssm_received", label: "Recebido SSM" },
    ]
  },
  {
    id: "order_generation",
    label: "📝 Gerar Ordem",
    icon: FileEdit,
    statuses: [
      { value: "order_generation_pending", label: "Pendente Ordem" },
      { value: "order_in_creation", label: "Criando Ordem" },
      { value: "order_generated", label: "Ordem Gerada" },
    ]
  },
  {
    id: "purchases",
    label: "🛒 Compras",
    icon: ShoppingCart,
    statuses: [
      { value: "purchase_pending", label: "Pendente Compra" },
      { value: "purchase_quoted", label: "Cotação Recebida" },
      { value: "purchase_ordered", label: "Pedido Emitido" },
      { value: "purchase_received", label: "Material Recebido" },
    ]
  },
  {
    id: "almox_general",
    label: "🏭 Almox Geral",
    icon: Warehouse,
    statuses: [
      { value: "almox_general_received", label: "Recebido Almox Geral" },
      { value: "almox_general_separating", label: "Separando" },
      { value: "almox_general_ready", label: "Pronto Almox Geral" },
    ]
  },
  {
    id: "production_client",
    label: "🔧 Clientes",
    icon: PackageCheck,
    forCategory: "vendas",
    statuses: [
      { value: "separation_started", label: "Iniciado Separação" },
      { value: "in_production", label: "Em Produção" },
      { value: "awaiting_material", label: "Aguardando Material" },
      { value: "separation_completed", label: "Separação Concluída" },
      { value: "production_completed", label: "Produção Concluída" },
    ]
  },
  {
    id: "production_stock",
    label: "📦 Estoque",
    icon: Boxes,
    forCategory: "not_vendas",
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
    label: "⚖️ Gerar Saldo",
    icon: Receipt,
    statuses: [
      { value: "balance_calculation", label: "Calculando Saldo" },
      { value: "balance_review", label: "Revisando Saldo" },
      { value: "balance_approved", label: "Saldo Aprovado" },
    ]
  },
  {
    id: "laboratory",
    label: "🔬 Laboratório",
    icon: Microscope,
    statuses: [
      { value: "awaiting_lab", label: "Aguardando Lab" },
      { value: "in_lab_analysis", label: "Em Análise Lab" },
      { value: "lab_completed", label: "Lab Concluído" },
    ]
  },
  {
    id: "packaging",
    label: "📦 Embalagem",
    icon: PackageCheck,
    statuses: [
      { value: "in_quality_check", label: "Em Conferência" },
      { value: "in_packaging", label: "Em Embalagem" },
      { value: "ready_for_shipping", label: "Pronto para Envio" },
    ]
  },
  {
    id: "freight_quote",
    label: "🧮 Cotação de Frete",
    icon: Calculator,
    statuses: [
      { value: "freight_quote_requested", label: "Cotação Solicitada" },
      { value: "freight_quote_received", label: "Cotação Recebida" },
      { value: "freight_approved", label: "Frete Aprovado" },
    ]
  },
  {
    id: "ready_to_invoice",
    label: "📋 À Faturar",
    icon: ClipboardCheck,
    statuses: [
      { value: "ready_to_invoice", label: "Pronto para Faturar" },
      { value: "pending_invoice_request", label: "Aguardando Solicitação" },
    ]
  },
  {
    id: "invoicing",
    label: "💰 Faturamento",
    icon: FileText,
    statuses: [
      { value: "invoice_requested", label: "Faturamento Solicitado" },
      { value: "awaiting_invoice", label: "Processando Faturamento" },
      { value: "invoice_issued", label: "NF Emitida" },
      { value: "invoice_sent", label: "NF Enviada" },
    ]
  },
  {
    id: "logistics",
    label: "🚚 Expedição",
    icon: Truck,
    statuses: [
      { value: "released_for_shipping", label: "Liberado para Envio" },
      { value: "in_expedition", label: "Deixado na Expedição" },
      { value: "pickup_scheduled", label: "Retirada Agendada" },
      { value: "awaiting_pickup", label: "Aguardando Retirada" },
    ]
  },
  {
    id: "in_transit",
    label: "🚛 Em Trânsito",
    icon: Truck,
    statuses: [
      { value: "in_transit", label: "Em Trânsito" },
      { value: "collected", label: "Coletado" },
    ]
  },
  {
    id: "completion",
    label: "✅ Conclusão",
    icon: CheckCircle2,
    statuses: [
      { value: "delivered", label: "Entregue" },
      { value: "completed", label: "Finalizado" },
    ]
  },
  {
    id: "exceptions",
    label: "⚠️ Exceções",
    icon: AlertCircle,
    statuses: [
      { value: "cancelled", label: "Cancelado" },
      { value: "on_hold", label: "Em Espera" },
      { value: "delayed", label: "Atrasado" },
      { value: "returned", label: "Devolvido" },
    ]
  },
];

export const UnifiedStatusSelector = ({ 
  currentStatus, 
  orderCategory,
  onStatusChange, 
  disabled = false 
}: UnifiedStatusSelectorProps) => {
  // Filtrar fases baseado na categoria do pedido
  const filteredPhases = phases.filter(phase => {
    if (phase.forCategory === "vendas") {
      return orderCategory === "vendas";
    }
    if (phase.forCategory === "not_vendas") {
      return orderCategory !== "vendas";
    }
    return true;
  });

  // Encontrar a fase atual
  const currentPhase = filteredPhases.find(phase => 
    phase.statuses.some(s => s.value === currentStatus)
  );

  return (
    <Select 
      value={currentStatus} 
      onValueChange={onStatusChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecionar status...">
          <div className="flex items-center gap-2">
            {currentPhase && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {currentPhase.label.split(' ')[0]}
              </Badge>
            )}
            <span>{getStatusLabel(currentStatus)}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {filteredPhases.map((phase) => (
          <SelectGroup key={phase.id}>
            <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5 bg-muted/50">
              {phase.label}
            </SelectLabel>
            {phase.statuses.map((status) => (
              <SelectItem 
                key={`${phase.id}-${status.value}`} 
                value={status.value}
                className={currentStatus === status.value ? "bg-accent" : ""}
              >
                <div className="flex items-center gap-2">
                  {currentStatus === status.value && (
                    <span className="text-green-600 font-bold">✓</span>
                  )}
                  <span>{status.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
};
