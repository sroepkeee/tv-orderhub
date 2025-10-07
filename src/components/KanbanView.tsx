import React from "react";
import { KanbanColumn } from "./KanbanColumn";
import { Order } from "@/components/Dashboard";
import {
  ClipboardList,
  PackageCheck,
  Box,
  Truck,
  CheckCircle2,
  Microscope,
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

export type Phase = "preparation" | "production" | "laboratory" | "packaging" | "logistics" | "in_transit" | "completion";

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
        distance: 15, // Drag apenas após 15px de movimento
        delay: 200, // Delay de 200ms antes de ativar o drag
        tolerance: 5, // Tolerância de 5px
      },
    }),
    useSensor(KeyboardSensor)
  );

  const getPhaseFromStatus = (status: Order["status"]): Phase => {
    switch (status) {
      case "pending":
      case "in_analysis":
      case "awaiting_approval":
      case "planned":
      case "on_hold":
        return "preparation";
      case "separation_started":
      case "in_production":
      case "awaiting_material":
      case "separation_completed":
      case "production_completed":
        return "production";
      case "awaiting_lab":
      case "in_lab_analysis":
      case "lab_completed":
        return "laboratory";
      case "in_quality_check":
      case "in_packaging":
      case "ready_for_shipping":
        return "packaging";
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
        return "completion";
    }
  };

  const columns = [
    {
      id: "preparation" as Phase,
      title: "Preparação",
      icon: ClipboardList,
      colorClass: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100",
    },
    {
      id: "production" as Phase,
      title: "Produção",
      icon: PackageCheck,
      colorClass: "bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100",
    },
    {
      id: "laboratory" as Phase,
      title: "Laboratório",
      icon: Microscope,
      colorClass: "bg-pink-100 text-pink-900 dark:bg-pink-900/30 dark:text-pink-100",
    },
    {
      id: "packaging" as Phase,
      title: "Embalagem",
      icon: Box,
      colorClass: "bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-100",
    },
    {
      id: "logistics" as Phase,
      title: "Expedição",
      icon: Truck,
      colorClass: "bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-100",
    },
    {
      id: "in_transit" as Phase,
      title: "Em Trânsito",
      icon: Truck,
      colorClass: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100",
    },
    {
      id: "completion" as Phase,
      title: "Conclusão",
      icon: CheckCircle2,
      colorClass: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100",
    },
  ];

  const getOrdersByPhase = (phase: Phase) => {
    return orders.filter((order) => getPhaseFromStatus(order.status) === phase);
  };

  const getDefaultStatusForPhase = (phase: Phase): Order["status"] => {
    switch (phase) {
      case "preparation":
        return "pending";
      case "production":
        return "in_production";
      case "laboratory":
        return "in_lab_analysis";
      case "packaging":
        return "in_packaging";
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
      <div className="kanban-view h-full overflow-hidden">
        <div className="kanban-container flex gap-2 overflow-x-auto h-full pb-2">
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
