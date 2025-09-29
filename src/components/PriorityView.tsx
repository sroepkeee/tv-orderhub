import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Order } from "./Dashboard";
import { ActionButtons } from "./ActionButtons";

interface PriorityViewProps {
  orders: Order[];
  onEdit: (order: Order) => void;
  onDuplicate: (order: Order) => void;
  onApprove: (orderId: string) => void;
  onCancel: (orderId: string) => void;
}

export const PriorityView = ({ 
  orders, 
  onEdit, 
  onDuplicate, 
  onApprove, 
  onCancel 
}: PriorityViewProps) => {
  // Sort orders by priority: high -> medium -> low
  const sortedOrders = [...orders].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority as keyof typeof priorityOrder] - 
           priorityOrder[a.priority as keyof typeof priorityOrder];
  });

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case "high": return "priority-high-row";
      case "medium": return "priority-medium-row";
      case "low": return "priority-low-row";
      default: return "";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high": return "Alta";
      case "medium": return "Média";
      case "low": return "Baixa";
      default: return priority;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pendente";
      case "approved": return "Aprovado";
      case "in_progress": return "Em Andamento";
      case "completed": return "Concluído";
      case "cancelled": return "Cancelado";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-status-pending-bg text-status-pending";
      case "approved": return "bg-status-approved-bg text-status-approved";
      case "in_progress": return "bg-blue-100 text-blue-700";
      case "completed": return "bg-status-completed-bg text-status-completed";
      case "cancelled": return "bg-status-cancelled-bg text-status-cancelled";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "production": return "Produção";
      case "sales": return "Vendas";
      case "materials": return "Materiais";
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "production": return "bg-orderType-production-bg text-orderType-production";
      case "sales": return "bg-orderType-sales-bg text-orderType-sales";
      case "materials": return "bg-orderType-materials-bg text-orderType-materials";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getProgressBarColor = (daysRemaining: number) => {
    if (daysRemaining > 7) return "bg-progress-good";
    if (daysRemaining > 3) return "bg-progress-warning";
    return "bg-progress-critical";
  };

  const getProgressWidth = (daysRemaining: number) => {
    const maxDays = 30;
    const percentage = Math.max(0, Math.min(100, (daysRemaining / maxDays) * 100));
    return percentage;
  };

  const calculateDaysRemaining = (deadline: string) => {
    const today = new Date();
    const deliveryDate = new Date(deadline);
    const diffTime = deliveryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Group orders by priority for better visual organization
  const groupedOrders = {
    high: sortedOrders.filter(order => order.priority === "high"),
    medium: sortedOrders.filter(order => order.priority === "medium"),
    low: sortedOrders.filter(order => order.priority === "low"),
  };

  const renderOrderGroup = (orders: Order[], priorityLabel: string, priorityClass: string) => {
    if (orders.length === 0) return null;

    return (
      <div className="mb-8">
        <div className="sticky top-0 bg-background z-10 py-2 mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${priorityClass === 'priority-high-row' ? 'bg-priority-high' : priorityClass === 'priority-medium-row' ? 'bg-priority-medium' : 'bg-priority-low'}`}></div>
            Prioridade {priorityLabel} ({orders.length} pedidos)
          </h3>
        </div>
        
        <div className="space-y-2">
          {orders.map((order) => {
            const daysRemaining = calculateDaysRemaining(order.deliveryDeadline);
            return (
              <div key={order.id} className={`${getPriorityClass(order.priority)} p-4 rounded-lg border`}>
                <div className="grid grid-cols-12 gap-4 items-center dashboard-table">
                  <div className="col-span-1">
                    <Badge className={`order-type-badge ${getTypeColor(order.type)}`}>
                      {getTypeLabel(order.type)}
                    </Badge>
                  </div>
                  
                  <div className="col-span-1">
                    <span className={order.priority === "high" ? "priority-blink font-bold" : "font-medium"}>
                      {getPriorityLabel(order.priority)}
                    </span>
                  </div>
                  
                  <div className="col-span-1 font-mono text-sm">
                    {order.orderNumber}
                  </div>
                  
                  <div className="col-span-1 font-medium">
                    {order.item}
                  </div>
                  
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {order.description}
                  </div>
                  
                  <div className="col-span-1 text-center">
                    {order.quantity}
                  </div>
                  
                  <div className="col-span-1 text-sm">
                    {new Date(order.createdDate).toLocaleDateString('pt-BR')}
                  </div>
                  
                  <div className="col-span-1">
                    <Badge className={`status-badge ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                  
                  <div className="col-span-1 text-sm">
                    {order.client}
                  </div>
                  
                  <div className="col-span-1">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.deliveryDeadline).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={getProgressWidth(daysRemaining)} 
                          className="h-2 flex-1"
                        />
                        <span className="text-xs font-medium w-12 text-right">
                          {daysRemaining}d
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-span-1 flex justify-end">
                    <ActionButtons
                      order={order}
                      onEdit={onEdit}
                      onDuplicate={onDuplicate}
                      onApprove={onApprove}
                      onCancel={onCancel}
                    />
                  </div>
                </div>
                
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                  <span className="font-medium">Chamado Desk:</span> {order.deskTicket}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h2 className="text-xl font-bold text-primary">
          Todos os Pedidos Organizados por Prioridade
        </h2>
        <p className="text-sm text-muted-foreground">
          {sortedOrders.length} pedidos no total
        </p>
      </div>
      
      {renderOrderGroup(groupedOrders.high, "Alta", "priority-high-row")}
      {renderOrderGroup(groupedOrders.medium, "Média", "priority-medium-row")}
      {renderOrderGroup(groupedOrders.low, "Baixa", "priority-low-row")}
      
      {sortedOrders.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum pedido encontrado.</p>
        </div>
      )}
    </div>
  );
};