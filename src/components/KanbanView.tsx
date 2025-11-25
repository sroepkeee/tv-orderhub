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
  ShoppingCart,
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
import { usePhaseAuthorization } from "@/hooks/usePhaseAuthorization";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export type Phase = "almox_ssm" | "order_generation" | "purchases" | "almox_general" | "production_client" | "production_stock" | "balance_generation" | "laboratory" | "packaging" | "freight_quote" | "ready_to_invoice" | "invoicing" | "logistics" | "in_transit" | "completion";

interface KanbanViewProps {
  orders: Order[];
  onEdit: (order: Order) => void;
  onStatusChange: (orderId: string, newStatus: Order["status"]) => void;
}

export const KanbanView = ({ orders, onEdit, onStatusChange }: KanbanViewProps) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [optimisticOrders, setOptimisticOrders] = React.useState<Order[]>(orders);
  const [phaseOrder, setPhaseOrder] = React.useState<Map<Phase, number>>(new Map());
  const { getPhaseInfo, loading: phaseInfoLoading } = usePhaseInfo();
  const { canViewPhase, canEditPhase, userRoles, loading: authLoading } = usePhaseAuthorization();
  const { user } = useAuth();

  // Sincronizar com orders recebidos (atualização real do servidor)
  React.useEffect(() => {
    setOptimisticOrders(orders);
  }, [orders]);

  // Carregar order_index das fases
  React.useEffect(() => {
    const loadPhaseOrder = async () => {
      const { data } = await supabase
        .from('phase_config')
        .select('phase_key, order_index');
      
      if (data) {
        const orderMap = new Map<Phase, number>();
        data.forEach(p => orderMap.set(p.phase_key as Phase, p.order_index || 0));
        setPhaseOrder(orderMap);
      }
    };
    loadPhaseOrder();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const getPhaseFromStatus = (status: Order["status"], orderCategory?: string): Phase => {
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
      case "purchase_pending":
      case "purchase_quoted":
      case "purchase_ordered":
      case "purchase_received":
        return "purchases";
      case "almox_general_received":
      case "almox_general_separating":
      case "almox_general_ready":
        return "almox_general";
      case "separation_started":
      case "in_production":
      case "awaiting_material":
      case "separation_completed":
      case "production_completed":
        // Dividir produção por categoria de pedido
        return orderCategory === 'vendas' ? "production_client" : "production_stock";
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
      // Fase: Faturamento
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
      id: "purchases" as Phase,
      title: "Compras",
      icon: ShoppingCart,
      colorClass: "bg-phase-purchases-bg text-phase-purchases border-b-4 border-phase-border",
    },
    {
      id: "production_client" as Phase,
      title: "Produção Clientes",
      icon: PackageCheck,
      colorClass: "bg-phase-production-client-bg text-phase-production-client border-b-4 border-phase-production-client-border",
    },
    {
      id: "production_stock" as Phase,
      title: "Produção Estoque",
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

  // Função para obter colunas visíveis (apenas com permissão explícita)
  const getVisibleColumns = () => {
    // Admin vê tudo
    if (userRoles.includes('admin')) {
      return columns;
    }

    const visiblePhases = new Set<Phase>();

    // Adicionar apenas fases onde o usuário tem permissão de visualização
    columns.forEach(col => {
      if (canViewPhase(col.id)) {
        visiblePhases.add(col.id);
      }
    });

    // Filtrar colunas visíveis mantendo ordem original
    return columns.filter(col => visiblePhases.has(col.id));
  };

  const visibleColumns = getVisibleColumns();

  const getOrdersByPhase = (phase: Phase) => {
    return optimisticOrders.filter((order) => getPhaseFromStatus(order.status, order.order_category) === phase);
  };

  const getPhaseDetails = (phaseKey: string) => {
    const roleInfo = ROLE_LABELS[phaseKey];
    
    const sampleStatusMap: Record<Phase, Order["status"]> = {
      almox_ssm: "almox_ssm_pending",
      order_generation: "order_generation_pending",
      purchases: "purchase_pending",
      almox_general: "almox_general_received",
      production_client: "in_production",
      production_stock: "in_production",
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
      case "purchases":
        return "purchase_pending";
      case "almox_general":
        return "almox_general_received";
      case "production_client":
      case "production_stock":
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const orderId = active.id as string;
    const targetPhase = over.id as Phase;
    const order = optimisticOrders.find((o) => o.id === orderId);

    if (!order) return;

    const currentPhase = getPhaseFromStatus(order.status, order.order_category);

    console.log('🎯 [Kanban] Drag & Drop:', {
      pedido: order.orderNumber,
      de: currentPhase,
      para: targetPhase,
      statusAtual: order.status,
      usuario: user?.email,
      timestamp: new Date().toISOString()
    });
    
    // Se soltar na mesma coluna, não faz nada
    if (currentPhase === targetPhase) return;

    // ❌ VALIDAR: Usuário pode editar a fase de destino?
    if (!canEditPhase(targetPhase) && !userRoles.includes('admin')) {
      toast({
        title: "Sem permissão",
        description: `Você não tem permissão para mover pedidos para ${targetPhase}`,
        variant: "destructive",
      });
      return;
    }

    const newStatus = getDefaultStatusForPhase(targetPhase);
    
    // 🚀 PASSO 1: Optimistic update IMEDIATAMENTE (instantâneo!)
    setOptimisticOrders(prev => 
      prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
    );
    
    // 🚀 PASSO 2: Enviar para servidor (não bloqueia UI)
    onStatusChange(orderId, newStatus);
    
    // 🔥 PASSO 3: Log em background (fire-and-forget, não bloqueia)
    const logActivity = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          await supabase.from('user_activity_log').insert({
            user_id: currentUser.id,
            action_type: 'update',
            table_name: 'orders',
            record_id: orderId,
            description: `Moveu pedido ${order.orderNumber} de ${currentPhase} para ${targetPhase}`,
            metadata: {
              order_number: order.orderNumber,
              old_phase: currentPhase,
              new_phase: targetPhase,
              old_status: order.status,
              new_status: newStatus,
              action_source: 'kanban_drag_drop'
            }
          });
          console.log('✅ Log registrado em background');
        }
      } catch (error) {
        console.error('⚠️ Erro ao registrar log (não crítico):', error);
      }
    };
    logActivity(); // Fire-and-forget
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeOrder = activeId ? optimisticOrders.find((o) => o.id === activeId) : null;

  // Loading state
  if (authLoading || phaseInfoLoading) {
    return (
      <div className="kanban-view">
        <div className="kanban-container flex gap-2 lg:gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-[600px] min-w-[280px]" />
          ))}
        </div>
      </div>
    );
  }

  // Sem permissões
  if (visibleColumns.length === 0) {
    return (
      <div className="kanban-view p-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nenhuma fase disponível</AlertTitle>
          <AlertDescription>
            Você ainda não tem permissões configuradas. 
            Entre em contato com o administrador para solicitar acesso às fases do sistema.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

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
          {visibleColumns.map((column) => {
            const phaseDetails = getPhaseDetails(column.id);
            const canDrag = canEditPhase(column.id) || userRoles.includes('admin');
            
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
                canDrag={canDrag}
                linkTo={column.id === "purchases" ? "/purchases" : undefined}
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
