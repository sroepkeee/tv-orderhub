import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Order } from "./Dashboard";
import { ActionButtons } from "./ActionButtons";
import { PhaseButtons } from "./PhaseButtons";
import { ViewControls, SortOption, GroupOption, PhaseFilter, ViewMode } from "./ViewControls";
import { KanbanView } from "./KanbanView";
import { ClipboardList, PackageCheck, Boxes, Truck, CheckCircle2 } from "lucide-react";

interface PriorityViewProps {
  orders: Order[];
  onEdit: (order: Order) => void;
  onDuplicate: (order: Order) => void;
  onApprove: (orderId: string) => void;
  onCancel: (orderId: string) => void;
  onRowClick?: (order: Order) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
}

export const PriorityView = ({ 
  orders, 
  onEdit, 
  onDuplicate, 
  onApprove, 
  onCancel,
  onRowClick,
  onStatusChange 
}: PriorityViewProps) => {
  const [sortBy, setSortBy] = React.useState<SortOption>("priority");
  const [groupBy, setGroupBy] = React.useState<GroupOption>("priority");
  const [phaseFilter, setPhaseFilter] = React.useState<PhaseFilter>("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    const saved = localStorage.getItem("viewMode");
    return (saved as ViewMode) || "list";
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("viewMode", mode);
  };

  // Phase mapping helper
  const getPhaseFromStatus = (status: Order["status"]): string => {
    const phaseMap: Record<string, string> = {
      "pending": "preparation",
      "in_analysis": "preparation",
      "awaiting_approval": "preparation",
      "planned": "preparation",
      "separation_started": "production",
      "in_production": "production",
      "awaiting_material": "production",
      "separation_completed": "production",
      "production_completed": "production",
      "in_quality_check": "packaging",
      "in_packaging": "packaging",
      "ready_for_shipping": "packaging",
      "released_for_shipping": "logistics",
      "in_expedition": "logistics",
      "in_transit": "logistics",
      "pickup_scheduled": "logistics",
      "awaiting_pickup": "logistics",
      "collected": "logistics",
      "delivered": "completion",
      "completed": "completion",
    };
    return phaseMap[status] || "other";
  };

  // Filter by phase
  const phaseFilteredOrders = phaseFilter === "all" 
    ? orders 
    : orders.filter(order => getPhaseFromStatus(order.status) === phaseFilter);

  // Sort orders
  const sortedOrders = [...phaseFilteredOrders].sort((a, b) => {
    switch (sortBy) {
      case "priority":
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority as keyof typeof priorityOrder] - 
               priorityOrder[a.priority as keyof typeof priorityOrder];
      case "deadline":
        return new Date(a.deliveryDeadline).getTime() - new Date(b.deliveryDeadline).getTime();
      case "created":
        return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
      case "status":
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
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

  const handleRowClick = (order: Order, e: React.MouseEvent) => {
    // Prevent opening if clicking on buttons or interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) {
      return;
    }
    
    if (onRowClick) {
      onRowClick(order);
    }
  };

  const getPhaseBadge = (status: Order["status"]) => {
    const phase = getPhaseFromStatus(status);
    const phaseConfig: Record<string, { label: string; icon: any; color: string }> = {
      preparation: { label: "Preparação", icon: ClipboardList, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
      production: { label: "Produção", icon: PackageCheck, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
      packaging: { label: "Embalagem", icon: Boxes, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
      logistics: { label: "Expedição", icon: Truck, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
      completion: { label: "Conclusão", icon: CheckCircle2, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    };
    return phaseConfig[phase] || { label: "Outro", icon: ClipboardList, color: "bg-gray-100 text-gray-700" };
  };

  // Group orders based on selected groupBy option
  const getGroupedOrders = () => {
    if (groupBy === "none") {
      return { "Todos os Pedidos": sortedOrders };
    }

    if (groupBy === "priority") {
      return {
        "Alta": sortedOrders.filter(order => order.priority === "high"),
        "Média": sortedOrders.filter(order => order.priority === "medium"),
        "Baixa": sortedOrders.filter(order => order.priority === "low"),
      };
    }

    if (groupBy === "phase") {
      return {
        "Preparação": sortedOrders.filter(order => getPhaseFromStatus(order.status) === "preparation"),
        "Produção": sortedOrders.filter(order => getPhaseFromStatus(order.status) === "production"),
        "Embalagem": sortedOrders.filter(order => getPhaseFromStatus(order.status) === "packaging"),
        "Expedição": sortedOrders.filter(order => getPhaseFromStatus(order.status) === "logistics"),
        "Conclusão": sortedOrders.filter(order => getPhaseFromStatus(order.status) === "completion"),
      };
    }

    if (groupBy === "type") {
      return {
        "Produção": sortedOrders.filter(order => order.type === "production"),
        "Vendas": sortedOrders.filter(order => order.type === "sales"),
        "Materiais": sortedOrders.filter(order => order.type === "materials"),
      };
    }

    return {};
  };

  const groupedOrders = getGroupedOrders();

  const renderOrderGroup = (groupLabel: string, orders: Order[]) => {
    if (orders.length === 0) return null;

    return (
      <div className="mb-8">
        <div className="sticky top-0 bg-background z-10 py-3 mb-4 border-b-2">
          <h3 className="text-xl font-bold flex items-center gap-2">
            {groupLabel} ({orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'})
          </h3>
        </div>
        
        <div className="space-y-4">
          {orders.map((order) => {
            const daysRemaining = calculateDaysRemaining(order.deliveryDeadline);
            const phaseBadge = getPhaseBadge(order.status);
            const PhaseIcon = phaseBadge.icon;
            
            return (
              <div 
                key={order.id} 
                onClick={(e) => handleRowClick(order, e)}
                className={`${getPriorityClass(order.priority)} p-6 rounded-lg border-2 cursor-pointer hover:shadow-lg transition-all duration-200 order-card`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Badge className={`order-type-badge ${getTypeColor(order.type)} text-sm px-3 py-1`}>
                      {getTypeLabel(order.type)}
                    </Badge>
                    <div className="font-mono text-lg font-bold">
                      {order.orderNumber}
                    </div>
                    <Badge className={`${phaseBadge.color} text-sm px-3 py-1 flex items-center gap-1`}>
                      <PhaseIcon className="h-3 w-3" />
                      {phaseBadge.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${order.priority === "high" ? "priority-blink" : ""}`}>
                      {getPriorityLabel(order.priority)}
                    </span>
                  </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-12 gap-6 mb-4">
                  <div className="col-span-3">
                    <div className="text-sm text-muted-foreground mb-1">Item</div>
                    <div className="font-semibold text-lg">{order.item}</div>
                  </div>
                  
                  <div className="col-span-4">
                    <div className="text-sm text-muted-foreground mb-1">Descrição</div>
                    <div className="text-base">{order.description}</div>
                  </div>
                  
                  <div className="col-span-2">
                    <div className="text-sm text-muted-foreground mb-1">Cliente</div>
                    <div className="font-medium text-base">{order.client}</div>
                  </div>
                  
                  <div className="col-span-1">
                    <div className="text-sm text-muted-foreground mb-1">Qtd</div>
                    <div className="font-bold text-lg text-center">{order.quantity}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm text-muted-foreground mb-1">Prazo</div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        {new Date(order.deliveryDeadline).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={getProgressWidth(daysRemaining)} 
                          className="h-3 flex-1"
                        />
                        <span className="text-sm font-bold w-14 text-right">
                          {daysRemaining}d
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status and Actions Row */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4">
                    <Badge className={`status-badge ${getStatusColor(order.status)} text-sm px-3 py-1`}>
                      {getStatusLabel(order.status)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Desk: <span className="font-medium">{order.deskTicket}</span>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Criado: <span className="font-medium">{new Date(order.createdDate).toLocaleDateString('pt-BR')}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <ActionButtons
                      order={order}
                      onEdit={onEdit}
                      onDuplicate={onDuplicate}
                      onApprove={onApprove}
                      onCancel={onCancel}
                    />
                  </div>
                </div>

                {/* Phase Management Buttons */}
                <div className="mt-4 pt-4 border-t" onClick={(e) => e.stopPropagation()}>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Gestão de Fase:</div>
                  <PhaseButtons 
                    order={order} 
                    onStatusChange={onStatusChange}
                  />
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
      {/* Header with View Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">
            Todos os Pedidos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {sortedOrders.length} pedidos no total
          </p>
        </div>
      </div>

      <ViewControls
        sortBy={sortBy}
        groupBy={groupBy}
        phaseFilter={phaseFilter}
        viewMode={viewMode}
        onSortChange={setSortBy}
        onGroupChange={setGroupBy}
        onPhaseFilterChange={setPhaseFilter}
        onViewModeChange={handleViewModeChange}
      />
      
      {/* Orders Display */}
      {viewMode === "kanban" ? (
        <KanbanView
          orders={sortedOrders}
          onEdit={onEdit}
          onStatusChange={onStatusChange}
        />
      ) : (
        <>
          {/* Render Groups */}
          {Object.entries(groupedOrders).map(([groupLabel, orders]) => 
            renderOrderGroup(groupLabel, orders)
          )}
          
          {sortedOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">Nenhum pedido encontrado.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};