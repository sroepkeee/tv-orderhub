import React from "react";
import { KanbanColumn } from "./KanbanColumn";
import { Order } from "@/components/Dashboard";
import {
  PackageCheck,
  Box,
  Truck,
  CheckCircle2,
  Microscope,
  Calculator,
  FileText,
  PackageSearch,
  FileEdit,
  Warehouse,
  Receipt,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { KanbanCard } from "./KanbanCard";

export type Phase = "almox_ssm" | "order_generation" | "almox_general" | "production" | "balance_generation" | "laboratory" | "packaging" | "freight_quote" | "invoicing" | "logistics" | "in_transit" | "completion";

interface KanbanViewProps {
  orders: Order[];
  onEdit: (order: Order) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
}

export const KanbanView = ({ orders, onEdit, onStatusChange }: KanbanViewProps) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const getPhaseFromStatus = (status: Order["status"]): Phase => {
    switch (status) {
      case "almox_ssm_received":
      case "almox_ssm_in_review":
      case "almox_ssm_approved":
        return "almox_ssm";
      case "order_generation_pending":
      case "order_in_creation":
      case "order_generated":
        return "order_generation";
      case "almox_general_received":
      case "almox_general_separating":
      case "almox_general_ready":
        return "almox_general";
      case "separation_started":
      case "in_production":
      case "awaiting_material":
      case "separation_completed":
      case "production_completed":
        return "production";
      case "balance_calculation":
      case "balance_review":
      case "balance_approved":
        return "balance_generation";
      case "awaiting_lab":
      case "in_lab_analysis":
      case "lab_completed":
        return "laboratory";
      case "in_quality_check":
      case "in_packaging":
      case "ready_for_shipping":
        return "packaging";
      case "freight_quote_requested":
      case "freight_quote_received":
      case "freight_approved":
        return "freight_quote";
      // Status de Faturamento (Invoicing Phase):
      // - invoice_requested: Solicitação de geração de NF
      // - awaiting_invoice: Aguardando emissão da NF
      // - invoice_issued: NF emitida, aguardando envio
      // - invoice_sent: NF enviada ao cliente
      case "invoice_requested":
      case "awaiting_invoice":
      case "invoice_issued":
      case "invoice_sent":
        return "invoicing";
      case "released_for_shipping":
      case "in_expedition":
      case "pickup_scheduled":
      case "awaiting_pickup":
        return "logistics";
      case "in_transit":
      case "collected":
        return "in_transit";
      case "delivered":
      case "completed":
      case "cancelled":
      case "delayed":
      case "returned":
      case "pending":
      case "in_analysis":
      case "awaiting_approval":
      case "planned":
      case "on_hold":
        return "completion";
      default:
        console.warn(`Status não mapeado no Kanban: ${status}, usando fase 'completion'`);
        return "completion";
    }
  };

  const columns = [
    {
      id: "almox_ssm" as Phase,
      title: "Almox SSM",
      icon: PackageSearch,
      colorClass: "bg-phase-almox-ssm-bg text-phase-almox-ssm border-b-4 border-phase-almox-ssm",
    },
    {
      id: "almox_general" as Phase,
      title: "Almox Geral",
      icon: Warehouse,
      colorClass: "bg-phase-almox-general-bg text-phase-almox-general border-b-4 border-phase-almox-general",
    },
    {
      id: "order_generation" as Phase,
      title: "Gerar Ordem",
      icon: FileEdit,
      colorClass: "bg-phase-order-gen-bg text-phase-order-gen border-b-4 border-phase-order-gen",
    },
    {
      id: "production" as Phase,
      title: "Produção",
      icon: PackageCheck,
      colorClass: "bg-phase-production-bg text-phase-production border-b-4 border-phase-production",
    },
    {
      id: "balance_generation" as Phase,
      title: "Gerar Saldo",
      icon: Receipt,
      colorClass: "bg-phase-balance-bg text-phase-balance border-b-4 border-phase-balance",
    },
    {
      id: "laboratory" as Phase,
      title: "Laboratório",
      icon: Microscope,
      colorClass: "bg-phase-laboratory-bg text-phase-laboratory border-b-4 border-phase-laboratory",
    },
    {
      id: "packaging" as Phase,
      title: "Embalagem",
      icon: Box,
      colorClass: "bg-phase-packaging-bg text-phase-packaging border-b-4 border-phase-packaging",
    },
    {
      id: "freight_quote" as Phase,
      title: "Cotação Frete",
      icon: Calculator,
      colorClass: "bg-phase-freight-bg text-phase-freight border-b-4 border-phase-freight",
    },
    {
      id: "invoicing" as Phase,
      title: "Faturamento",
      icon: FileText,
      colorClass: "bg-phase-invoicing-bg text-phase-invoicing border-b-4 border-phase-invoicing",
    },
    {
      id: "logistics" as Phase,
      title: "Expedição",
      icon: Truck,
      colorClass: "bg-phase-logistics-bg text-phase-logistics border-b-4 border-phase-logistics",
    },
    {
      id: "in_transit" as Phase,
      title: "Em Trânsito",
      icon: Truck,
      colorClass: "bg-phase-transit-bg text-phase-transit border-b-4 border-phase-transit",
    },
    {
      id: "completion" as Phase,
      title: "Conclusão",
      icon: CheckCircle2,
      colorClass: "bg-phase-completion-bg text-phase-completion border-b-4 border-phase-completion",
    },
  ];

  const getOrdersByPhase = (phase: Phase) => {
    return orders.filter((order) => getPhaseFromStatus(order.status) === phase);
  };

  const getDefaultStatusForPhase = (phase: Phase): Order["status"] => {
    switch (phase) {
      case "almox_ssm":
        return "almox_ssm_received";
      case "order_generation":
        return "order_generation_pending";
      case "almox_general":
        return "almox_general_received";
      case "production":
        return "in_production";
      case "balance_generation":
        return "balance_calculation";
      case "laboratory":
        return "in_lab_analysis";
      case "packaging":
        return "in_packaging";
      case "freight_quote":
        return "freight_quote_requested";
      case "invoicing":
        return "awaiting_invoice";
      case "logistics":
        return "in_expedition";
      case "in_transit":
        return "in_transit";
      case "completion":
        return "completed";
    }
  };

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const orderId = active.id as string;
    const targetPhase = over.id as Phase;
    const order = orders.find((o) => o.id === orderId);

    if (!order) return;

    const currentPhase = getPhaseFromStatus(order.status);
    
    // Se soltar na mesma coluna, não faz nada
    if (currentPhase === targetPhase) return;

    const newStatus = getDefaultStatusForPhase(targetPhase);
    onStatusChange(orderId, newStatus);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeOrder = activeId ? orders.find((o) => o.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="kanban-view">
        <div className="kanban-container flex gap-2 lg:gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              icon={column.icon}
              orders={getOrdersByPhase(column.id)}
              colorClass={column.colorClass}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeOrder ? (
          <div className="kanban-drag-overlay">
            <KanbanCard
              order={activeOrder}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
