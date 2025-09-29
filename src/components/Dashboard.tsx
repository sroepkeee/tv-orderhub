import React, { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AddOrderDialog } from "./AddOrderDialog";
import { EditOrderDialog } from "./EditOrderDialog";
import { ActionButtons } from "./ActionButtons";
import { PriorityView } from "./PriorityView";
import { PhaseButtons } from "./PhaseButtons";
import { ColumnSettings, ColumnVisibility } from "./ColumnSettings";
import { DateRangeFilter } from "./DateRangeFilter";
import { UserMenu } from "./UserMenu";
import { toast } from "@/hooks/use-toast";

// Types
type Priority = "high" | "medium" | "low";
type OrderStatus = 
  // Fase de Preparação/Planejamento
  | "pending" | "in_analysis" | "awaiting_approval" | "planned"
  // Fase de Separação/Produção
  | "separation_started" | "in_production" | "awaiting_material" | "separation_completed" | "production_completed"
  // Fase de Embalagem/Conferência
  | "in_quality_check" | "in_packaging" | "ready_for_shipping"
  // Fase de Expedição/Logística
  | "released_for_shipping" | "in_expedition" | "in_transit" | "pickup_scheduled" | "awaiting_pickup" | "collected"
  // Fase de Conclusão
  | "delivered" | "completed"
  // Status de Exceção/Problemas
  | "cancelled" | "on_hold" | "delayed" | "returned";
type OrderType = "production" | "sales" | "materials";

export interface Order {
  id: string;
  type: OrderType;
  priority: Priority;
  orderNumber: string;
  item: string;
  description: string;
  quantity: number;
  createdDate: string;
  status: OrderStatus;
  client: string;
  deliveryDeadline: string;
  deskTicket: string;
}

// Mock data
const mockOrders: Order[] = [
  {
    id: "1",
    type: "production",
    priority: "high",
    orderNumber: "PRD-2024-001",
    item: "Motor Elétrico 220V",
    description: "Motor para linha de produção industrial",
    quantity: 15,
    createdDate: "2024-01-15",
    status: "pending",
    client: "Indústria ABC Ltda",
    deliveryDeadline: "2024-02-15",
    deskTicket: "DSK-2024-001",
  },
  {
    id: "2",
    type: "sales",
    priority: "medium",
    orderNumber: "VND-2024-002",
    item: "Bomba Hidráulica",
    description: "Sistema de bombeamento para irrigação",
    quantity: 8,
    createdDate: "2024-01-16",
    status: "planned",
    client: "Fazenda XYZ",
    deliveryDeadline: "2024-02-28",
    deskTicket: "DSK-2024-002",
  },
  {
    id: "3",
    type: "materials",
    priority: "low",
    orderNumber: "MAT-2024-003",
    item: "Parafusos Inox",
    description: "Kit de parafusos inoxidáveis M8",
    quantity: 500,
    createdDate: "2024-01-17",
    status: "in_production",
    client: "Construtora DEF",
    deliveryDeadline: "2024-03-10",
    deskTicket: "DSK-2024-003",
  },
  {
    id: "4",
    type: "production",
    priority: "high",
    orderNumber: "PRD-2024-004",
    item: "Válvula Pneumática",
    description: "Válvula de controle automático",
    quantity: 20,
    createdDate: "2024-01-18",
    status: "pending",
    client: "Metalúrgica GHI",
    deliveryDeadline: "2024-02-05",
    deskTicket: "DSK-2024-004",
  },
  {
    id: "5",
    type: "sales",
    priority: "medium",
    orderNumber: "VND-2024-005",
    item: "Sensor de Temperatura",
    description: "Sensor industrial de alta precisão",
    quantity: 12,
    createdDate: "2024-01-19",
    status: "completed",
    client: "Laboratório JKL",
    deliveryDeadline: "2024-02-20",
    deskTicket: "DSK-2024-005",
  },
  {
    id: "6",
    type: "materials",
    priority: "high",
    orderNumber: "MAT-2024-006",
    item: "Chapa de Aço",
    description: "Chapas de aço carbono 2mm",
    quantity: 100,
    createdDate: "2024-01-20",
    status: "pending",
    client: "Serralheria MNO",
    deliveryDeadline: "2024-02-08",
    deskTicket: "DSK-2024-006",
  },
];

// Tabs configuration
const tabs = [
  { id: "all", name: "Todos os Pedidos" },
  { id: "production", name: "Pedidos de Produção" },
  { id: "sales", name: "Pedidos de Venda" },
  { id: "materials", name: "Remessa de Materiais" },
  { id: "in_transit", name: "Em Trânsito" },
  { id: "completed", name: "Concluídos" },
];

export const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  
  // User ID state with localStorage persistence
  const [userId, setUserId] = useState<string>(() => {
    const saved = localStorage.getItem("currentUserId");
    return saved || "default-user";
  });

  // Save user ID to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("currentUserId", userId);
  }, [userId]);
  
  // Column visibility state with user-specific localStorage persistence
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    const saved = localStorage.getItem(`columnVisibility_${userId}`);
    return saved ? JSON.parse(saved) : {
      priority: true,
      orderNumber: true,
      item: true,
      description: true,
      quantity: true,
      createdDate: true,
      status: true,
      client: true,
      deskTicket: true,
      deliveryDeadline: true,
      daysRemaining: true,
      phaseManagement: true,
      actions: true,
    };
  });

  // Save column visibility to localStorage whenever it changes or user changes
  useEffect(() => {
    localStorage.setItem(`columnVisibility_${userId}`, JSON.stringify(columnVisibility));
  }, [columnVisibility, userId]);

  // Reload column visibility when user changes
  useEffect(() => {
    const saved = localStorage.getItem(`columnVisibility_${userId}`);
    if (saved) {
      setColumnVisibility(JSON.parse(saved));
    }
  }, [userId]);

  const getPriorityClass = (priority: Priority) => {
    switch (priority) {
      case "high": return "priority-high-row";
      case "medium": return "priority-medium-row";
      case "low": return "priority-low-row";
      default: return "";
    }
  };

  const getPriorityLabel = (priority: Priority) => {
    switch (priority) {
      case "high": return "Alta";
      case "medium": return "Média";
      case "low": return "Baixa";
      default: return priority;
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

  // Filter orders based on active tab, search, and date range
  const filteredOrders = orders.filter((order) => {
    let matchesTab = false;
    
    if (activeTab === "all") {
      matchesTab = true;
    } else if (activeTab === "in_transit") {
      matchesTab = order.status === "collected" || order.status === "in_transit";
    } else if (activeTab === "completed") {
      matchesTab = order.status === "delivered" || order.status === "completed";
    } else {
      matchesTab = order.type === activeTab;
    }
    
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.deskTicket.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Date range filter
    let matchesDate = true;
    if (dateRange?.from) {
      const orderDate = new Date(order.createdDate);
      matchesDate = orderDate >= dateRange.from;
      if (dateRange.to) {
        matchesDate = matchesDate && orderDate <= dateRange.to;
      }
    }
    
    return matchesTab && matchesSearch && matchesDate;
  });

  // Action handlers
  const handleAddOrder = (orderData: any) => {
    const newOrder: Order = {
      ...orderData,
      id: Date.now().toString(),
      orderNumber: generateOrderNumber(orderData.type),
      createdDate: new Date().toISOString().split('T')[0],
      status: "pending" as OrderStatus,
    };
    setOrders(prev => [newOrder, ...prev]);
  };

  const generateOrderNumber = (type: OrderType) => {
    const prefix = type === "production" ? "PRD" : type === "sales" ? "VND" : "MAT";
    const year = new Date().getFullYear();
    const count = orders.filter(o => o.type === type).length + 1;
    return `${prefix}-${year}-${count.toString().padStart(3, '0')}`;
  };

  const handleEditOrder = (updatedOrder: Order) => {
    setOrders(prev => prev.map(order => 
      order.id === updatedOrder.id ? updatedOrder : order
    ));
    toast({
      title: "Pedido atualizado",
      description: `Pedido ${updatedOrder.orderNumber} foi atualizado com sucesso.`,
    });
  };

  const handleDuplicateOrder = (originalOrder: Order) => {
    const duplicatedOrder: Order = {
      ...originalOrder,
      id: Date.now().toString(),
      orderNumber: generateOrderNumber(originalOrder.type),
      createdDate: new Date().toISOString().split('T')[0],
      status: "pending" as OrderStatus,
    };
    setOrders(prev => [duplicatedOrder, ...prev]);
  };

  const handleApproveOrder = (orderId: string) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status: "planned" as OrderStatus } : order
    ));
    toast({
      title: "Pedido aprovado",
      description: "Pedido foi planejado e aprovado para produção.",
    });
  };

  const handleCancelOrder = (orderId: string) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status: "cancelled" as OrderStatus } : order
    ));
  };

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    const order = orders.find(o => o.id === orderId);
    const previousStatus = order?.status;
    
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
    
    // Save to history
    if (order && previousStatus) {
      saveOrderHistory(orderId, previousStatus, newStatus, order.orderNumber);
    }
    
    toast({
      title: "Status atualizado",
      description: `Pedido ${order?.orderNumber} movido para ${getStatusLabel(newStatus)}`,
    });
  };

  const saveOrderHistory = (
    orderId: string, 
    previousStatus: OrderStatus, 
    newStatus: OrderStatus,
    orderNumber: string
  ) => {
    const historyKey = `orderHistory_${orderId}`;
    const existingHistory = localStorage.getItem(historyKey);
    const history = existingHistory ? JSON.parse(existingHistory) : { orderId, events: [] };
    
    const getPhaseFromStatus = (status: OrderStatus): string => {
      const phaseMap: Record<string, string> = {
        "pending": "Preparação",
        "in_analysis": "Preparação",
        "awaiting_approval": "Preparação",
        "planned": "Preparação",
        "separation_started": "Produção",
        "in_production": "Produção",
        "awaiting_material": "Produção",
        "separation_completed": "Produção",
        "production_completed": "Produção",
        "in_quality_check": "Embalagem",
        "in_packaging": "Embalagem",
        "ready_for_shipping": "Embalagem",
        "released_for_shipping": "Expedição",
        "in_expedition": "Expedição",
        "in_transit": "Expedição",
        "pickup_scheduled": "Expedição",
        "awaiting_pickup": "Expedição",
        "collected": "Expedição",
        "delivered": "Conclusão",
        "completed": "Conclusão",
        "cancelled": "Exceção",
        "on_hold": "Exceção",
        "delayed": "Exceção",
        "returned": "Exceção",
      };
      return phaseMap[status] || "Outro";
    };

    const newEvent = {
      id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      type: "status_change",
      action: "Mudança de Status",
      description: `Status alterado de "${getStatusLabel(previousStatus)}" para "${getStatusLabel(newStatus)}"`,
      userId: userId,
      userName: `Usuário ${userId}`,
      previousStatus: previousStatus,
      newStatus: newStatus,
      previousPhase: getPhaseFromStatus(previousStatus),
      newPhase: getPhaseFromStatus(newStatus),
      orderNumber: orderNumber,
    };

    history.events.push(newEvent);
    localStorage.setItem(historyKey, JSON.stringify(history));
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      // Preparação/Planejamento
      "pending": "Pendente (Novo)",
      "in_analysis": "Em Análise",
      "awaiting_approval": "Aguardando Aprovação",
      "planned": "Planejado",
      // Separação/Produção
      "separation_started": "Iniciado a Separação",
      "in_production": "Em Produção",
      "awaiting_material": "Aguardando Material",
      "separation_completed": "Concluído a Separação",
      "production_completed": "Concluído a Produção",
      // Embalagem/Conferência
      "in_quality_check": "Em Conferência/Qualidade",
      "in_packaging": "Em Embalagem",
      "ready_for_shipping": "Pronto para Envio",
      // Expedição/Logística
      "released_for_shipping": "Liberado para Envio",
      "in_expedition": "Deixado na Expedição",
      "in_transit": "Em Trânsito",
      "pickup_scheduled": "Retirada Agendada",
      "awaiting_pickup": "Aguardando Retirada",
      "collected": "Coletado",
      // Conclusão
      "delivered": "Entregue",
      "completed": "Finalizado",
      // Exceção/Problemas
      "cancelled": "Cancelado",
      "on_hold": "Em Espera",
      "delayed": "Atrasado",
      "returned": "Devolvido"
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      // Preparação/Planejamento
      "pending": "bg-status-pending-bg text-status-pending",
      "in_analysis": "bg-status-analysis-bg text-status-analysis",
      "awaiting_approval": "bg-status-awaiting-bg text-status-awaiting",
      "planned": "bg-status-planned-bg text-status-planned",
      // Separação/Produção
      "separation_started": "bg-status-separation-bg text-status-separation",
      "in_production": "bg-status-production-bg text-status-production",
      "awaiting_material": "bg-status-material-bg text-status-material",
      "separation_completed": "bg-status-sep-complete-bg text-status-sep-complete",
      "production_completed": "bg-status-prod-complete-bg text-status-prod-complete",
      // Embalagem/Conferência
      "in_quality_check": "bg-status-quality-bg text-status-quality",
      "in_packaging": "bg-status-packaging-bg text-status-packaging",
      "ready_for_shipping": "bg-status-ready-bg text-status-ready",
      // Expedição/Logística
      "released_for_shipping": "bg-status-released-bg text-status-released",
      "in_expedition": "bg-status-expedition-bg text-status-expedition",
      "in_transit": "bg-status-transit-bg text-status-transit",
      "pickup_scheduled": "bg-status-scheduled-bg text-status-scheduled",
      "awaiting_pickup": "bg-status-pickup-bg text-status-pickup",
      "collected": "bg-status-collected-bg text-status-collected",
      // Conclusão
      "delivered": "bg-status-delivered-bg text-status-delivered",
      "completed": "bg-status-completed-bg text-status-completed",
      // Exceção/Problemas
      "cancelled": "bg-status-cancelled-bg text-status-cancelled",
      "on_hold": "bg-status-hold-bg text-status-hold",
      "delayed": "bg-status-delayed-bg text-status-delayed",
      "returned": "bg-status-returned-bg text-status-returned"
    };
    return colors[status] || "bg-gray-100 text-gray-700";
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
    
    // Auto-navigate to appropriate tab based on order status
    if (order.status === "collected" || order.status === "in_transit") {
      setActiveTab("in_transit");
    } else if (order.status === "delivered" || order.status === "completed") {
      setActiveTab("completed");
    }
    
    setSelectedOrder(order);
    setShowEditDialog(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-dashboard-header">Logística SSM</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar pedidos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-80"
            />
          </div>
          <DateRangeFilter 
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
          <ColumnSettings 
            visibility={columnVisibility}
            onVisibilityChange={setColumnVisibility}
          />
          <UserMenu
            currentUserId={userId}
            onUserIdChange={setUserId}
          />
          <AddOrderDialog onAddOrder={handleAddOrder} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="flex space-x-1 p-2 rounded-lg border-2" style={{ 
          background: 'hsl(var(--dashboard-tabs-bg))',
          borderColor: 'hsl(var(--dashboard-tabs-border))'
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 rounded-md text-lg font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? "shadow-md"
                  : "bg-transparent hover:bg-accent/50 hover:text-accent-foreground"
              }`}
              style={activeTab === tab.id ? {
                background: 'hsl(var(--tab-active))',
                color: 'white'
              } : {
                color: 'hsl(var(--tab-inactive))'
              }}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === "all" ? (
        <PriorityView 
          orders={filteredOrders}
          onEdit={handleEditOrder}
          onDuplicate={handleDuplicateOrder}
          onApprove={handleApproveOrder}
          onCancel={handleCancelOrder}
          onStatusChange={handleStatusChange}
          onRowClick={(order) => {
            setSelectedOrder(order);
            setShowEditDialog(true);
          }}
        />
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="dashboard-header">
                <tr>
                  {columnVisibility.priority && <th className="text-left p-4 font-semibold">Prioridade</th>}
                  {columnVisibility.orderNumber && <th className="text-left p-4 font-semibold">Número do Pedido</th>}
                  {columnVisibility.item && <th className="text-left p-4 font-semibold">Item</th>}
                  {columnVisibility.description && <th className="text-left p-4 font-semibold">Descrição</th>}
                  {columnVisibility.quantity && <th className="text-left p-4 font-semibold">Quantidade</th>}
                  {columnVisibility.createdDate && <th className="text-left p-4 font-semibold">Data de Criação</th>}
                  {columnVisibility.status && <th className="text-left p-4 font-semibold">Status</th>}
                  {columnVisibility.client && <th className="text-left p-4 font-semibold">Cliente</th>}
                  {columnVisibility.deskTicket && <th className="text-left p-4 font-semibold">Chamado Desk</th>}
                  {columnVisibility.deliveryDeadline && <th className="text-left p-4 font-semibold">Prazo de Entrega</th>}
                  {columnVisibility.daysRemaining && <th className="text-left p-4 font-semibold">Dias Restantes</th>}
                  {columnVisibility.phaseManagement && <th className="text-left p-4 font-semibold">Gestão de Fase</th>}
                  {columnVisibility.actions && <th className="text-center p-4 font-semibold">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const daysRemaining = calculateDaysRemaining(order.deliveryDeadline);
                  return (
                    <tr 
                      key={order.id} 
                      onClick={(e) => handleRowClick(order, e)}
                      className={`border-t transition-colors hover:bg-muted/50 cursor-pointer ${getPriorityClass(order.priority)}`}
                    >
                      {columnVisibility.priority && (
                        <td className="p-4">
                          <span className={`font-medium ${order.priority === "high" ? "priority-blink" : ""}`}>
                            {getPriorityLabel(order.priority)}
                          </span>
                        </td>
                      )}
                      {columnVisibility.orderNumber && <td className="p-4 font-mono text-sm">{order.orderNumber}</td>}
                      {columnVisibility.item && <td className="p-4 font-medium">{order.item}</td>}
                      {columnVisibility.description && <td className="p-4 text-sm text-muted-foreground">{order.description}</td>}
                      {columnVisibility.quantity && <td className="p-4 text-center">{order.quantity}</td>}
                      {columnVisibility.createdDate && <td className="p-4 text-sm">{new Date(order.createdDate).toLocaleDateString('pt-BR')}</td>}
                      {columnVisibility.status && (
                        <td className="p-4">
                          <Badge className={`status-badge ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </Badge>
                        </td>
                      )}
                      {columnVisibility.client && <td className="p-4 text-sm">{order.client}</td>}
                      {columnVisibility.deskTicket && <td className="p-4 text-sm font-mono">{order.deskTicket}</td>}
                      {columnVisibility.deliveryDeadline && <td className="p-4 text-sm">{new Date(order.deliveryDeadline).toLocaleDateString('pt-BR')}</td>}
                      {columnVisibility.daysRemaining && (
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={getProgressWidth(daysRemaining)} 
                              className="h-2 flex-1"
                            />
                            <span className="text-xs font-medium w-8 text-right">{daysRemaining}d</span>
                          </div>
                        </td>
                      )}
                      {columnVisibility.phaseManagement && (
                        <td className="p-4">
                          <PhaseButtons
                            order={order}
                            onStatusChange={handleStatusChange}
                          />
                        </td>
                      )}
                      {columnVisibility.actions && (
                        <td className="p-4">
                          <ActionButtons
                            order={order}
                            onEdit={handleEditOrder}
                            onDuplicate={handleDuplicateOrder}
                            onApprove={handleApproveOrder}
                            onCancel={handleCancelOrder}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum pedido encontrado para os filtros aplicados.</p>
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog with integrated History */}
      {selectedOrder && (
        <EditOrderDialog
          order={selectedOrder}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSave={handleEditOrder}
        />
      )}
    </div>
  );
};