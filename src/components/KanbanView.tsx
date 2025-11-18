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
  ClipboardCheck,
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
import { usePhaseInfo } from "@/hooks/usePhaseInfo";
import { ROLE_LABELS } from "@/lib/roleLabels";

export type Phase = "almox_ssm" | "order_generation" | "almox_general" | "production" | "balance_generation" | "laboratory" | "packaging" | "freight_quote" | "ready_to_invoice" | "invoicing" | "logistics" | "in_transit" | "completion";

interface KanbanViewProps {
  orders: Order[];
  onEdit: (order: Order) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
}

export const KanbanView = ({ orders, onEdit, onStatusChange }: KanbanViewProps) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [optimisticOrders, setOptimisticOrders] = React.useState<Order[]>(orders);
  const { getPhaseInfo, loading: phaseInfoLoading } = usePhaseInfo();

  // Sincronizar com orders recebidos (atualização real do servidor)
  React.useEffect(() => {
    setOptimisticOrders(orders);
  }, [orders]);

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
      case "almox_ssm_pending":
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
      // Fase: À Faturar
      case "ready_to_invoice":
      case "pending_invoice_request":
        return "ready_to_invoice";
      // Fase: Solicitado Faturamento
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
      colorClass: "bg-phase-almox-ssm-bg text-phase-almox-ssm border-b-4 border-phase-border",
    },
    {
      id: "almox_general" as Phase,
      title: "Almox Geral",
      icon: Warehouse,
      colorClass: "bg-phase-almox-general-bg text-phase-almox-general border-b-4 border-phase-border",
    },
    {
      id: "order_generation" as Phase,
      title: "Gerar Ordem",
      icon: FileEdit,
      colorClass: "bg-phase-order-gen-bg text-phase-order-gen border-b-4 border-phase-border",
    },
    {
      id: "production" as Phase,
      title: "Produção",
      icon: PackageCheck,
      colorClass: "bg-phase-production-bg text-phase-production border-b-4 border-phase-border",
    },
    {
      id: "balance_generation" as Phase,
      title: "Gerar Saldo",
      icon: Receipt,
      colorClass: "bg-phase-balance-bg text-phase-balance border-b-4 border-phase-border",
    },
    {
      id: "laboratory" as Phase,
      title: "Laboratório",
      icon: Microscope,
      colorClass: "bg-phase-laboratory-bg text-phase-laboratory border-b-4 border-phase-border",
    },
    {
      id: "packaging" as Phase,
      title: "Embalagem",
      icon: Box,
      colorClass: "bg-phase-packaging-bg text-phase-packaging border-b-4 border-phase-border",
    },
    {
      id: "freight_quote" as Phase,
      title: "Cotação Frete",
      icon: Calculator,
      colorClass: "bg-phase-freight-bg text-phase-freight border-b-4 border-phase-border",
    },
    {
      id: "ready_to_invoice" as Phase,
      title: "À Faturar",
      icon: ClipboardCheck,
      colorClass: "bg-phase-ready-invoice-bg text-phase-ready-invoice border-b-4 border-phase-border",
    },
    {
      id: "invoicing" as Phase,
      title: "Solicitado Faturamento",
      icon: FileText,
      colorClass: "bg-phase-invoicing-bg text-phase-invoicing border-b-4 border-phase-border",
    },
    {
      id: "logistics" as Phase,
      title: "Expedição",
      icon: Truck,
      colorClass: "bg-phase-logistics-bg text-phase-logistics border-b-4 border-phase-border",
    },
    {
      id: "in_transit" as Phase,
      title: "Em Trânsito",
      icon: Truck,
      colorClass: "bg-phase-transit-bg text-phase-transit border-b-4 border-phase-border",
    },
    {
      id: "completion" as Phase,
      title: "Conclusão",
      icon: CheckCircle2,
      colorClass: "bg-phase-completion-bg text-phase-completion border-b-4 border-phase-border",
    },
  ];

  const getOrdersByPhase = (phase: Phase) => {
    return optimisticOrders.filter((order) => getPhaseFromStatus(order.status) === phase);
  };

  const getPhaseDetails = (phaseKey: string) => {
    const roleInfo = ROLE_LABELS[phaseKey];
    
    const sampleStatusMap: Record<Phase, Order["status"]> = {
      almox_ssm: "almox_ssm_pending",
      order_generation: "order_generation_pending",
      almox_general: "almox_general_received",
      production: "in_production",
      balance_generation: "balance_calculation",
      laboratory: "awaiting_lab",
      packaging: "in_packaging",
      freight_quote: "freight_quote_requested",
      ready_to_invoice: "ready_to_invoice",
      invoicing: "invoice_requested",
      logistics: "in_expedition",
      in_transit: "in_transit",
      completion: "completed",
    };
    
    const sampleStatus = sampleStatusMap[phaseKey as Phase];
    const phaseInfo = sampleStatus ? getPhaseInfo(sampleStatus) : null;
    
    return {
      area: roleInfo?.area,
      responsibleRole: roleInfo?.name,
      responsibleUsers: phaseInfo?.responsibleUsers || [],
    };
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
      case "ready_to_invoice":
        return "ready_to_invoice";
      case "invoicing":
        return "invoice_requested";
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
    const order = optimisticOrders.find((o) => o.id === orderId);

    if (!order) return;

    const currentPhase = getPhaseFromStatus(order.status);
    
    // Se soltar na mesma coluna, não faz nada
    if (currentPhase === targetPhase) return;

    const newStatus = getDefaultStatusForPhase(targetPhase);
    
    // 🚀 Optimistic update: atualizar UI imediatamente
    setOptimisticOrders(prev => 
      prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
    );
    
    // Enviar para servidor (se falhar, o useEffect vai reverter com data real)
    onStatusChange(orderId, newStatus);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeOrder = activeId ? optimisticOrders.find((o) => o.id === activeId) : null;

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
          {columns.map((column) => {
            const phaseDetails = getPhaseDetails(column.id);
            
            return (
              <KanbanColumn
                key={column.id}
                id={column.id}
                title={column.title}
                icon={column.icon}
                orders={getOrdersByPhase(column.id)}
                colorClass={column.colorClass}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                phaseKey={column.id}
                area={phaseDetails.area}
                responsibleRole={phaseDetails.responsibleRole}
                responsibleUsers={phaseDetails.responsibleUsers}
              />
            );
          })}
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
