import React from "react";
import { KanbanColumn } from "./KanbanColumn";
import { Order } from "@/components/Dashboard";
import {
  ClipboardList,
  PackageCheck,
  Box,
  Truck,
  CheckCircle2,
} from "lucide-react";

export type Phase = "preparation" | "production" | "packaging" | "logistics" | "completion";

interface KanbanViewProps {
  orders: Order[];
  onEdit: (order: Order) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
}

export const KanbanView = ({ orders, onEdit, onStatusChange }: KanbanViewProps) => {
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
      case "in_quality_check":
      case "in_packaging":
      case "ready_for_shipping":
        return "packaging";
      case "released_for_shipping":
      case "in_expedition":
      case "in_transit":
      case "pickup_scheduled":
      case "awaiting_pickup":
      case "collected":
        return "logistics";
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
      id: "completion" as Phase,
      title: "Conclusão",
      icon: CheckCircle2,
      colorClass: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100",
    },
  ];

  const getOrdersByPhase = (phase: Phase) => {
    return orders.filter((order) => getPhaseFromStatus(order.status) === phase);
  };

  return (
    <div className="kanban-view">
      <div className="kanban-container flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-300px)]">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
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
  );
};
