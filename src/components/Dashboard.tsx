import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Calendar, FileSpreadsheet, Plus, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cleanItemDescription } from "@/lib/utils";
import { getStatusLabel } from "@/lib/statusLabels";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { AddOrderDialog } from "./AddOrderDialog";
import { EditOrderDialog } from "./EditOrderDialog";
import { ActionButtons } from "./ActionButtons";
import { PriorityView } from "./PriorityView";
import { PhaseButtons } from "./PhaseButtons";
import { ColumnSettings, ColumnVisibility } from "./ColumnSettings";
import { DateRangeFilter } from "./DateRangeFilter";
import { NotificationCenter } from "./NotificationCenter";
import { ImportOrderDialog } from "./ImportOrderDialog";
import { RateioUploadDialog } from "./RateioUploadDialog";
import { RealtimeIndicator } from "./RealtimeIndicator";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { usePhaseAuthorization } from "@/hooks/usePhaseAuthorization";
import { usePhaseManagerNotification } from "@/hooks/usePhaseManagerNotification";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/sidebar/AppSidebar";
import { useKanbanDensity, KanbanDensity } from "@/hooks/useKanbanDensity";
import { ViewMode } from "./ViewControls";
import { ViewSettingsPopover } from "./ViewSettingsPopover";

// Types
type Priority = "high" | "medium" | "low";
type OrderStatus =
// Fase: Almox SSM
"almox_ssm_pending" | "almox_ssm_received" | "almox_ssm_in_review" | "almox_ssm_approved"
// Fase: Gerar Ordem
| "order_generation_pending" | "order_in_creation" | "order_generated"
// Fase: Compras
| "purchase_pending" | "purchase_quoted" | "purchase_ordered" | "purchase_received"
// Fase: Almox Geral
| "almox_general_received" | "almox_general_separating" | "almox_general_ready"
// Fase: Produção
| "separation_started" | "in_production" | "awaiting_material" | "separation_completed" | "production_completed"
// Fase: Gerar Saldo
| "balance_calculation" | "balance_review" | "balance_approved"
// Fase: Laboratório
| "awaiting_lab" | "in_lab_analysis" | "lab_completed"
// Fase: Embalagem
| "in_quality_check" | "in_packaging" | "ready_for_shipping"
// Fase: Cotação de Frete
| "freight_quote_requested" | "freight_quote_received" | "freight_approved"
// Fase: À Faturar
| "ready_to_invoice" | "pending_invoice_request"
// Fase: Solicitado Faturamento
| "invoice_requested" | "awaiting_invoice" | "invoice_issued" | "invoice_sent"
// Fase: Expedição
| "released_for_shipping" | "in_expedition" | "in_transit" | "pickup_scheduled" | "awaiting_pickup" | "collected"
// Fase: Conclusão
| "delivered" | "completed"
// Exceções
| "cancelled" | "on_hold" | "delayed" | "returned"
// Preparação (legacy)
| "pending" | "in_analysis" | "awaiting_approval" | "planned";
type OrderType = "production" | "sales" | "materials" | "ecommerce";
export interface Order {
  id: string;
  type: OrderType;
  priority: Priority;
  orderNumber: string;
  item: string;
  description: string;
  quantity: number;
  createdDate: string;
  issueDate?: string;
  status: OrderStatus;
  client: string;
  deliveryDeadline: string;
  delivery_address?: string;
  deskTicket: string;
  totvsOrderNumber?: string;
  items?: import("./AddOrderDialog").OrderItem[];
  order_category?: string;
  daysOpen?: number;
  requires_firmware?: boolean;
  firmware_project_name?: string;
  requires_image?: boolean;
  image_project_name?: string;
  freight_type?: string;
  freight_value?: number;
  freight_modality?: string;
  carrier_name?: string;
  tracking_code?: string;
  // ✨ Novos campos de dimensões e volumes
  package_volumes?: number;
  package_weight_kg?: number;
  package_height_m?: number;
  package_width_m?: number;
  package_length_m?: number;
  updatedAt?: string;
  // ✨ Campos de liberação de produção
  production_released?: boolean;
  production_released_at?: string;
  production_released_by?: string;
  // ✨ Campos de área de negócio (RATEIO)
  cost_center?: string;
  account_item?: string;
  business_unit?: string;
  business_area?: 'ssm' | 'filial' | 'projetos' | 'ecommerce';
  rateio_project_code?: string;
  // ✨ Campo de empresa emissora
  sender_company?: string;
  // ✨ Campos de contato do cliente para notificações
  customer_contact_name?: string;
  customer_whatsapp?: string;
}

// Mock data
const mockOrders: Order[] = [{
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
  deskTicket: "DSK-2024-001"
}, {
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
  deskTicket: "DSK-2024-002"
}, {
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
  deskTicket: "DSK-2024-003"
}, {
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
  deskTicket: "DSK-2024-004"
}, {
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
  deskTicket: "DSK-2024-005"
}, {
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
  deskTicket: "DSK-2024-006"
}];

// Tabs configuration
const tabs = [{
  id: "all",
  name: "Todos os Pedidos"
}, {
  id: "production",
  name: "Pedidos de Produção"
}, {
  id: "sales",
  name: "Pedidos de Venda"
}, {
  id: "materials",
  name: "Remessa de Materiais"
}, {
  id: "in_transit",
  name: "Em Trânsito"
}, {
  id: "completed",
  name: "Concluídos"
}];
export const Dashboard = () => {
  const {
    user
  } = useAuth();
  const {
    isAdmin
  } = useAdminAuth();
  const {
    userRoles
  } = usePhaseAuthorization();
  const { requireOrganization } = useOrganizationId();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [unreadConversationsCount, setUnreadConversationsCount] = useState(0);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showRateioDialog, setShowRateioDialog] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'synced' | 'updating' | 'disconnected'>('synced');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const isUpdatingRef = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const refreshQueueRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRefreshRef = useRef(false);
  const isBatchImportingRef = useRef(false);
  const lastToastTimeRef = useRef(0);

  // Column visibility state with user-specific localStorage persistence
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    const saved = user ? localStorage.getItem(`columnVisibility_${user.id}`) : null;
    return saved ? JSON.parse(saved) : {
      priority: true,
      orderNumber: true,
      item: false,
      description: false,
      quantity: false,
      createdDate: false,
      status: false,
      client: false,
      deskTicket: true,
      deliveryDeadline: true,
      daysRemaining: true,
      labStatus: false,
      phaseManagement: true,
      actions: false
    };
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(`columnVisibility_${user.id}`, JSON.stringify(columnVisibility));
    }
  }, [columnVisibility, user]);

  // 📦 Version indicator for debugging
  useEffect(() => {
    console.log('📦 Dashboard v2.1 - Notificações Proativas ATIVAS (com await + logs diagnóstico)');
  }, []);

  // Load orders from Supabase
  useEffect(() => {
    if (user) {
      loadOrders();
      loadUnreadCount();
    }
  }, [user]);

  // Listener para evento openOrder (notificações)
  useEffect(() => {
    const handleOpenOrder = (event: CustomEvent) => {
      const {
        orderId,
        commentId
      } = event.detail;
      console.log('🔔 Evento openOrder recebido:', {
        orderId,
        commentId
      });

      // Buscar o pedido completo
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
        setShowEditDialog(true);

        // Se tem commentId, armazenar para scroll posterior
        if (commentId) {
          sessionStorage.setItem('scrollToComment', commentId);
          sessionStorage.setItem('activeTab', 'comments');
        }
      } else {
        // Pedido não está na lista atual, fazer busca direta
        supabase.from('orders').select('*').eq('id', orderId).single().then(({
          data,
          error
        }) => {
          if (error || !data) {
            toast({
              title: 'Pedido não encontrado',
              description: 'Não foi possível abrir o pedido.',
              variant: 'destructive'
            });
            return;
          }

          // Converter para formato Order e abrir
          const formattedOrder: Order = {
            id: data.id,
            orderNumber: data.order_number,
            type: data.order_type as OrderType,
            priority: data.priority as Priority,
            status: data.status as OrderStatus,
            client: data.customer_name,
            deliveryDeadline: data.delivery_date,
            delivery_address: data.delivery_address,
            createdDate: data.created_at,
            issueDate: data.issue_date || undefined,
            item: '',
            description: '',
            quantity: 0,
            deskTicket: '',
            totvsOrderNumber: data.totvs_order_number || undefined,
            order_category: data.order_category || undefined,
            requires_firmware: data.requires_firmware || false,
            firmware_project_name: data.firmware_project_name || undefined,
            requires_image: data.requires_image || false,
            image_project_name: data.image_project_name || undefined,
            freight_type: data.freight_type || undefined,
            freight_value: data.freight_value || undefined,
            freight_modality: data.freight_modality || undefined,
            carrier_name: data.carrier_name || undefined,
            tracking_code: data.tracking_code || undefined,
            package_volumes: data.package_volumes || undefined,
            package_weight_kg: data.package_weight_kg || undefined,
            package_height_m: data.package_height_m || undefined,
            package_width_m: data.package_width_m || undefined,
            package_length_m: data.package_length_m || undefined
          };
          setSelectedOrder(formattedOrder);
          setShowEditDialog(true);
          if (commentId) {
            sessionStorage.setItem('scrollToComment', commentId);
            sessionStorage.setItem('activeTab', 'comments');
          }
        });
      }
    };
    window.addEventListener('openOrder', handleOpenOrder as EventListener);
    return () => {
      window.removeEventListener('openOrder', handleOpenOrder as EventListener);
    };
  }, [orders]);

  // Listener para navegação de retorno do chat (auto-abrir pedido)
  useEffect(() => {
    const navigationState = location.state as {
      openOrderId?: string;
      openOrderNumber?: string;
    } | null;
    if (navigationState?.openOrderId && orders.length > 0) {
      const order = orders.find(o => o.id === navigationState.openOrderId);
      if (order) {
        setSelectedOrder(order);
        setShowEditDialog(true);

        // Limpar o state para não reabrir em navegações futuras
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, orders]);
  const loadUnreadCount = async () => {
    try {
      const {
        count
      } = await supabase.from('carrier_conversations').select('*', {
        count: 'exact',
        head: true
      }).eq('message_direction', 'inbound').is('read_at', null);
      setUnreadConversationsCount(count || 0);
    } catch (error) {
      console.error('Erro ao carregar contador de conversas:', error);
    }
  };

  // Load pending approvals count for admin
  useEffect(() => {
    if (!isAdmin) return;
    const loadPendingCount = async () => {
      const {
        count
      } = await supabase.from('user_approval_status').select('*', {
        count: 'exact',
        head: true
      }).eq('status', 'pending');
      setPendingApprovalsCount(count || 0);
    };
    loadPendingCount();

    // Realtime subscription
    const channel = supabase.channel('pending-approvals').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_approval_status'
    }, loadPendingCount).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  // Limpar dialog se o pedido selecionado não existir mais
  useEffect(() => {
    if (selectedOrder && !orders.find(o => o.id === selectedOrder.id)) {
      setShowEditDialog(false);
      setSelectedOrder(null);
    }
  }, [orders, selectedOrder]);

  // Update seletivo de pedido individual
  const updateSingleOrder = async (orderId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('orders').select(`
          *,
          order_items(*)
        `).eq('id', orderId).single();
      if (error) throw error;
      if (data) {
        setOrders(prev => {
          const index = prev.findIndex(o => o.id === orderId);
          const items = (data.order_items || []).map((item: any) => ({
            id: item.id,
            itemCode: item.item_code,
            itemDescription: item.item_description,
            unit: item.unit,
            requestedQuantity: item.requested_quantity,
            warehouse: item.warehouse,
            deliveryDate: item.delivery_date,
            deliveredQuantity: item.delivered_quantity,
            item_source_type: item.item_source_type,
            item_status: item.item_status,
            received_status: item.received_status,
            production_estimated_date: item.production_estimated_date,
            sla_days: item.sla_days,
            is_imported: item.is_imported,
            import_lead_time_days: item.import_lead_time_days,
            sla_deadline: item.sla_deadline,
            current_phase: item.current_phase,
            phase_started_at: item.phase_started_at,
            userId: item.user_id,
            production_order_number: item.production_order_number
          }));
          const firstItem = items[0];
          const totalRequested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
          const transformedOrder = {
            id: data.id,
            type: data.order_type,
            priority: data.priority,
            orderNumber: data.order_number,
            item: firstItem ? `${firstItem.itemCode} (+${items.length - 1})` : data.customer_name,
            description: firstItem?.itemDescription || data.notes || "",
            quantity: totalRequested,
            createdDate: new Date(data.created_at).toISOString().split('T')[0],
            issueDate: data.issue_date || undefined,
            status: data.status,
            client: data.customer_name,
            deliveryDeadline: data.delivery_date,
            delivery_address: data.delivery_address || data.customer_name,
            deskTicket: data.notes || data.order_number,
            totvsOrderNumber: data.totvs_order_number || undefined,
            items,
            userId: data.user_id,
            notes: data.notes,
            createdAt: data.created_at,
            // Campos RATEIO
            cost_center: data.cost_center || null,
            account_item: data.account_item || null,
            business_unit: data.business_unit || null,
            business_area: data.business_area || null,
            rateio_project_code: data.rateio_project_code || null,
            // Campo empresa emissora
            sender_company: data.sender_company || null
          } as Order;
          if (index === -1) {
            return [...prev, transformedOrder];
          }
          const updated = [...prev];
          updated[index] = transformedOrder;
          return updated;
        });
        setRealtimeStatus('synced');
        setLastUpdateTime(new Date());
      }
    } catch (error) {
      console.error('❌ [Update] Erro ao atualizar pedido:', error);
      queueRefresh();
    }
  };

  // Fila de Refresh com Smart Throttle (150ms)
  const lastEventTimeRef = useRef(0);
  const queueRefresh = () => {
    // ✅ Ignorar eventos durante batch import
    if (isBatchImportingRef.current) {
      console.log('📦 [queueRefresh] Batch import em andamento, ignorando evento Realtime');
      return;
    }
    const now = Date.now();
    const timeSinceLastEvent = now - lastEventTimeRef.current;
    lastEventTimeRef.current = now;

    // ⚡ Se evento isolado (>2s desde último), reload imediato
    if (timeSinceLastEvent > 2000 && !pendingRefreshRef.current) {
      console.log('⚡ [queueRefresh] Evento isolado - reload imediato');
      if (!isLoadingRef.current && !isUpdatingRef.current) {
        loadOrders();
      }
      return;
    }

    // 📦 Caso contrário, agrupar eventos com delay curto (150ms)
    if (pendingRefreshRef.current) return;
    pendingRefreshRef.current = true;
    if (refreshQueueRef.current) {
      clearTimeout(refreshQueueRef.current);
    }
    refreshQueueRef.current = setTimeout(() => {
      pendingRefreshRef.current = false;
      if (!isLoadingRef.current && !isUpdatingRef.current) {
        console.log('🔄 [queueRefresh] Executando reload agrupado');
        loadOrders();
      }
    }, 150); // Otimizado para sincronização rápida
  };

  // 📡 Realtime subscriptions com update seletivo
  useEffect(() => {
    if (!user) return;
    console.log('📡 [Realtime] Iniciando subscriptions expandidas...');
    setRealtimeStatus('updating');
    const channel = supabase.channel('orders-realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders'
    }, payload => {
      console.log('📡 [Realtime] Evento em orders:', payload.eventType);

      // Update seletivo para INSERT/UPDATE
      if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new?.id) {
        setRealtimeStatus('updating');
        updateSingleOrder(payload.new.id as string);
        return;
      }

      // DELETE: reload completo
      queueRefresh();
    }).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'order_items'
    }, payload => {
      console.log('📡 [Realtime] Evento em order_items:', payload.eventType);
      if ((payload.new as any)?.order_id) {
        updateSingleOrder((payload.new as any).order_id as string);
      } else {
        queueRefresh();
      }
    }).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'order_history'
    }, payload => {
      console.log('📡 [Realtime] Evento em order_history:', payload.eventType);
      queueRefresh();
    }).subscribe(status => {
      console.log('📡 [Realtime] Status da conexão:', status);
      if (status === 'SUBSCRIBED') {
        setRealtimeStatus('synced');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setRealtimeStatus('disconnected');
      }
    });
    return () => {
      console.log('📡 [Realtime] Limpando subscriptions...');
      if (refreshQueueRef.current) clearTimeout(refreshQueueRef.current);
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 📢 Broadcast channel para sincronização instantânea
  useEffect(() => {
    if (!user) return;
    console.log('📢 [Broadcast] Configurando canal de broadcast');
    const broadcastChannel = supabase.channel('order-status-broadcast').on('broadcast', {
      event: 'status_changed'
    }, payload => {
      const {
        orderId,
        newStatus,
        changedBy,
        orderNumber
      } = payload.payload;

      // Ignorar se foi mudança do próprio usuário
      if (changedBy === user.id) return;
      console.log('📢 [Broadcast] Status mudou:', {
        orderNumber,
        newStatus
      });

      // Update imediato na UI
      setOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        status: newStatus as OrderStatus
      } : o));

      // Feedback visual
      setRealtimeStatus('updating');
      setTimeout(() => setRealtimeStatus('synced'), 1000);
    }).subscribe(status => {
      console.log('📢 [Broadcast] Status:', status);
    });
    return () => {
      console.log('📢 [Broadcast] Cleanup: removendo canal');
      supabase.removeChannel(broadcastChannel);
    };
  }, [user]);

  // 📦 Listeners para controle de batch import
  useEffect(() => {
    const handleBatchStart = () => {
      console.log('📦 [Dashboard] Batch import iniciado, pausando Realtime refresh');
      isBatchImportingRef.current = true;
      setIsBatchImporting(true);
    };
    const handleBatchComplete = () => {
      console.log('✅ [Dashboard] Batch import concluído, recarregando lista');
      isBatchImportingRef.current = false;
      setIsBatchImporting(false);
      // Incrementar requestId e agendar novo carregamento
      requestIdRef.current++;
      pendingRefreshRef.current = false;
      if (!isLoadingRef.current && !isUpdatingRef.current) {
        // Chamar loadOrders através de um setTimeout para evitar problemas de dependência
        setTimeout(() => {
          if (!isLoadingRef.current) {
            window.location.reload();
          }
        }, 100);
      }
    };
    window.addEventListener('batchImportStart', handleBatchStart);
    window.addEventListener('batchImportComplete', handleBatchComplete);
    return () => {
      window.removeEventListener('batchImportStart', handleBatchStart);
      window.removeEventListener('batchImportComplete', handleBatchComplete);
    };
  }, []);

  // Listener removido - usando apenas Realtime com throttle
  // Toast consolidado e limitado
  const showLimitedToast = (title: string, description: string, variant: "default" | "destructive" = "default") => {
    const now = Date.now();
    if (now - lastToastTimeRef.current < 300000) {
      // 5 minutos
      console.log('🔕 Toast suprimido (cooldown ativo)');
      return;
    }
    lastToastTimeRef.current = now;
    toast({
      title,
      description,
      variant
    });
  };

  // 🆕 Helper para mapear phase_key → statuses
  const getStatusesFromPhase = (phaseKey: string): OrderStatus[] => {
    const phaseToStatuses: Record<string, OrderStatus[]> = {
      'almox_ssm': ['almox_ssm_pending', 'almox_ssm_received', 'almox_ssm_in_review', 'almox_ssm_approved'],
      'order_generation': ['order_generation_pending', 'order_in_creation', 'order_generated'],
      'almox_general': ['almox_general_received', 'almox_general_separating', 'almox_general_ready'],
      'production': ['separation_started', 'in_production', 'awaiting_material', 'separation_completed', 'production_completed'],
      'balance_generation': ['balance_calculation', 'balance_review', 'balance_approved'],
      'laboratory': ['awaiting_lab', 'in_lab_analysis', 'lab_completed'],
      'packaging': ['in_quality_check', 'in_packaging', 'ready_for_shipping'],
      'freight_quote': ['freight_quote_requested', 'freight_quote_received', 'freight_approved'],
      'invoicing': ['ready_to_invoice', 'pending_invoice_request', 'invoice_requested', 'awaiting_invoice', 'invoice_issued', 'invoice_sent'],
      'logistics': ['released_for_shipping', 'in_expedition', 'in_transit', 'pickup_scheduled', 'awaiting_pickup', 'collected'],
      'completion': ['delivered', 'completed', 'cancelled', 'on_hold', 'delayed', 'returned', 'pending', 'in_analysis', 'awaiting_approval', 'planned']
    };
    return phaseToStatuses[phaseKey] || [];
  };

  // 🆕 Helper para obter phase a partir do status
  const getPhaseFromStatus = (status: OrderStatus): string => {
    if (['almox_ssm_pending', 'almox_ssm_received', 'almox_ssm_in_review', 'almox_ssm_approved'].includes(status)) return 'almox_ssm';
    if (['order_generation_pending', 'order_in_creation', 'order_generated'].includes(status)) return 'order_generation';
    if (['almox_general_received', 'almox_general_separating', 'almox_general_ready'].includes(status)) return 'almox_general';
    if (['separation_started', 'in_production', 'awaiting_material', 'separation_completed', 'production_completed'].includes(status)) return 'production';
    if (['balance_calculation', 'balance_review', 'balance_approved'].includes(status)) return 'balance_generation';
    if (['awaiting_lab', 'in_lab_analysis', 'lab_completed'].includes(status)) return 'laboratory';
    if (['in_quality_check', 'in_packaging', 'ready_for_shipping'].includes(status)) return 'packaging';
    if (['freight_quote_requested', 'freight_quote_received', 'freight_approved'].includes(status)) return 'freight_quote';
    if (['ready_to_invoice', 'pending_invoice_request', 'invoice_requested', 'awaiting_invoice', 'invoice_issued', 'invoice_sent'].includes(status)) return 'invoicing';
    if (['released_for_shipping', 'in_expedition', 'in_transit', 'pickup_scheduled', 'awaiting_pickup', 'collected'].includes(status)) return 'logistics';
    return 'completion';
  };
  const loadOrders = async () => {
    if (!user) return;

    // Evitar carregamentos concorrentes
    if (isLoadingRef.current) {
      console.log('⏭️ [loadOrders] Carregamento já em andamento, ignorando...');
      return;
    }

    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      console.log('🛑 [loadOrders] Cancelando requisição anterior...');
      abortControllerRef.current.abort();
    }

    // Criar novo AbortController e requestId
    abortControllerRef.current = new AbortController();
    const currentRequestId = ++requestIdRef.current;
    isLoadingRef.current = true;
    setRealtimeStatus('updating'); // 🔄 Indicar que está atualizando
    const startTime = performance.now();

    // 🆕 Buscar fases permitidas do usuário
    const {
      data: userPhases
    } = await supabase.rpc('get_user_phases', {
      _user_id: user.id
    });
    const allowedPhases = userPhases?.map(p => p.phase_key) || [];
    const isAdminUser = userRoles.includes('admin');
    console.log('🔄 [loadOrders] Iniciando carregamento...', {
      userId: user.id,
      requestId: currentRequestId,
      isAdmin: isAdminUser,
      allowedPhases
    });

    // Loading state bifurcado
    if (!hasLoadedOnceRef.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    // Timeout de segurança por chamada
    loadingTimeoutRef.current = setTimeout(() => {
      console.error('⏱️ [loadOrders] Timeout de 15s atingido');
      setLoading(false);
      setRefreshing(false);
      isLoadingRef.current = false;
      setRealtimeStatus('disconnected'); // ❌ Indicar desconexão
      showLimitedToast("Carregamento lento", "A conexão está demorando. Tente novamente.", "default");
    }, 15000);
    try {
      console.log('📡 [loadOrders] Executando query otimizada...');

      // 🆕 Query base com filtro condicional de fases
      let query = supabase.from('orders').select(`
          id,
          order_number,
          customer_name,
          delivery_address,
          status,
          priority,
          order_type,
          order_category,
          delivery_date,
          created_at,
          updated_at,
          notes,
          totvs_order_number,
          freight_type,
          freight_value,
          carrier_name,
          tracking_code,
          customer_document,
          operation_code,
          executive_name,
          municipality,
          issue_date,
          requires_firmware,
          firmware_project_name,
          requires_image,
          image_project_name,
          package_volumes,
          package_weight_kg,
          package_height_m,
          package_width_m,
          package_length_m,
          freight_modality,
          shipping_date,
          vehicle_plate,
          driver_name,
          production_released,
          production_released_at,
          production_released_by,
          cost_center,
          account_item,
          business_unit,
          business_area,
          rateio_project_code,
          sender_company,
          customer_whatsapp,
          customer_contact_name,
          order_items (
            id,
            item_code,
            item_description,
            requested_quantity,
            delivered_quantity,
            delivery_date,
            item_status,
            item_source_type,
            current_phase,
            warehouse,
            unit,
            sla_days,
            sla_deadline,
            received_status,
            production_estimated_date,
            is_imported,
            import_lead_time_days,
            phase_started_at,
            user_id
          )
        `);
      const {
        data,
        error
      } = await query.range(0, 499).order('created_at', {
        ascending: false
      }).abortSignal(abortControllerRef.current.signal).returns<any[]>();

      // Verificar se é a requisição mais recente
      if (currentRequestId !== requestIdRef.current) {
        console.log('⏭️ [loadOrders] Resposta obsoleta, ignorando...', {
          currentRequestId,
          latestRequestId: requestIdRef.current
        });
        return;
      }
      const endTime = performance.now();
      const duration = endTime - startTime;
      const payloadSize = data ? JSON.stringify(data).length : 0;
      console.log('📊 [loadOrders] Métricas:', {
        duration: `${duration.toFixed(0)}ms`,
        payloadSize: `${(payloadSize / 1024).toFixed(1)}KB`,
        ordersCount: data?.length || 0,
        hasError: !!error
      });
      if (error) {
        // Verificar se foi cancelamento
        if (error.message?.includes('aborted')) {
          console.log('🛑 [loadOrders] Requisição cancelada propositalmente');
          return;
        }
        throw error;
      }

      // Fallback para resultado vazio do JOIN
      if (!data || data.length === 0) {
        console.log('⚠️ [loadOrders] Resultado vazio no JOIN, aplicando fallback LEFT/N+1...');

        // Fallback: buscar apenas orders
        const {
          data: ordersData,
          error: ordersError
        } = await supabase.from('orders').select(`
            id,
            order_number,
            customer_name,
            delivery_address,
            status,
            priority,
            order_type,
            order_category,
            delivery_date,
            created_at,
            updated_at,
            notes,
            totvs_order_number,
            freight_type,
            freight_value,
            carrier_name,
            tracking_code,
            customer_document,
            operation_code,
            executive_name,
            municipality,
            issue_date,
            requires_firmware,
            firmware_project_name,
            requires_image,
            image_project_name,
            package_volumes,
            package_weight_kg,
            package_height_m,
            package_width_m,
            package_length_m,
            freight_modality,
            shipping_date,
            vehicle_plate,
            driver_name,
            customer_whatsapp
          `).range(0, 99).order('created_at', {
          ascending: false
        }).abortSignal(abortControllerRef.current.signal);
        if (ordersError) throw ordersError;

        // Buscar order_items separadamente (N+1)
        const ordersWithItems = await Promise.all((ordersData || []).map(async (dbOrder: any) => {
          const {
            data: itemsData
          } = await supabase.from('order_items').select('*').eq('order_id', dbOrder.id).abortSignal(abortControllerRef.current!.signal);
          const items = (itemsData || []).map((item: any) => ({
            id: item.id,
            itemCode: item.item_code,
            itemDescription: cleanItemDescription(item.item_description),
            unit: item.unit,
            requestedQuantity: item.requested_quantity,
            warehouse: item.warehouse,
            deliveryDate: item.delivery_date,
            deliveredQuantity: item.delivered_quantity,
            item_source_type: item.item_source_type as 'in_stock' | 'production' | 'out_of_stock',
            item_status: item.item_status as 'pending' | 'in_stock' | 'awaiting_production' | 'purchase_required' | 'completed',
            received_status: item.received_status as 'pending' | 'partial' | 'completed',
            production_estimated_date: item.production_estimated_date,
            sla_days: item.sla_days,
            is_imported: item.is_imported,
            import_lead_time_days: item.import_lead_time_days,
            sla_deadline: item.sla_deadline,
            current_phase: item.current_phase,
            phase_started_at: item.phase_started_at,
            userId: item.user_id,
            production_order_number: item.production_order_number
          }));
          const totalRequested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
          const firstItem = items[0];
          return {
            id: dbOrder.id,
            type: dbOrder.order_type as OrderType,
            priority: dbOrder.priority as Priority,
            orderNumber: dbOrder.order_number,
            item: firstItem ? `${firstItem.itemCode} (+${items.length - 1})` : dbOrder.customer_name,
            description: firstItem?.itemDescription || dbOrder.notes || "",
            quantity: totalRequested,
            createdDate: new Date(dbOrder.created_at).toISOString().split('T')[0],
            issueDate: dbOrder.issue_date || undefined,
            status: dbOrder.status as OrderStatus,
            client: dbOrder.customer_name,
            deliveryDeadline: dbOrder.delivery_date,
            delivery_address: dbOrder.delivery_address || dbOrder.customer_name,
            deskTicket: dbOrder.notes || dbOrder.order_number,
            totvsOrderNumber: dbOrder.totvs_order_number || undefined,
            items,
            order_category: dbOrder.order_category,
            freight_modality: dbOrder.freight_modality || null,
            carrier_name: dbOrder.carrier_name || null,
            freight_type: dbOrder.freight_type || null,
            freight_value: dbOrder.freight_value || null,
            tracking_code: dbOrder.tracking_code || null,
            package_volumes: dbOrder.package_volumes || null,
            package_weight_kg: dbOrder.package_weight_kg || null,
            package_length_m: dbOrder.package_length_m || null,
            package_width_m: dbOrder.package_width_m || null,
            package_height_m: dbOrder.package_height_m || null,
            customer_document: dbOrder.customer_document || null,
            municipality: dbOrder.municipality || null,
            operation_code: dbOrder.operation_code || null,
            executive_name: dbOrder.executive_name || null,
            firmware_project_name: dbOrder.firmware_project_name || null,
            image_project_name: dbOrder.image_project_name || null,
            requires_firmware: dbOrder.requires_firmware || false,
            requires_image: dbOrder.requires_image || false,
            shipping_date: dbOrder.shipping_date || null,
            vehicle_plate: dbOrder.vehicle_plate || null,
            driver_name: dbOrder.driver_name || null,
            updatedAt: dbOrder.updated_at || undefined,
            customer_whatsapp: dbOrder.customer_whatsapp || null
          };
        }));
        console.log('✅ [loadOrders] Fallback concluído (empty result)', {
          totalProcessed: ordersWithItems.length,
          fallbackEmptyResult: true
        });
        if (currentRequestId !== requestIdRef.current) {
          console.log('⏭️ [loadOrders] Fallback obsoleto, não atualizando...');
          return;
        }
        setOrders(ordersWithItems);
        hasLoadedOnceRef.current = true;
        return; // Sair antes de processar dados vazios
      }
      console.log('🔧 [loadOrders] Processando dados (LEFT JOIN)...');
      // Processar dados com LEFT JOIN
      const ordersWithItems = (data || []).map((dbOrder: any) => {
        const items = (dbOrder.order_items || []).map((item: any) => ({
          id: item.id,
          itemCode: item.item_code,
          itemDescription: cleanItemDescription(item.item_description),
          unit: item.unit,
          requestedQuantity: item.requested_quantity,
          warehouse: item.warehouse,
          deliveryDate: item.delivery_date,
          deliveredQuantity: item.delivered_quantity,
          item_source_type: item.item_source_type as 'in_stock' | 'production' | 'out_of_stock',
          item_status: item.item_status as 'pending' | 'in_stock' | 'awaiting_production' | 'purchase_required' | 'completed',
          received_status: item.received_status as 'pending' | 'partial' | 'completed',
          production_estimated_date: item.production_estimated_date,
          sla_days: item.sla_days,
          is_imported: item.is_imported,
          import_lead_time_days: item.import_lead_time_days,
          sla_deadline: item.sla_deadline,
          current_phase: item.current_phase,
          phase_started_at: item.phase_started_at,
          userId: item.user_id
        }));
        const totalRequested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
        const firstItem = items[0];
        return {
          id: dbOrder.id,
          type: dbOrder.order_type as OrderType,
          priority: dbOrder.priority as Priority,
          orderNumber: dbOrder.order_number,
          item: firstItem ? `${firstItem.itemCode} (+${items.length - 1})` : dbOrder.customer_name,
          description: firstItem?.itemDescription || dbOrder.notes || "",
          quantity: totalRequested,
          createdDate: new Date(dbOrder.created_at).toISOString().split('T')[0],
          issueDate: (dbOrder as any).issue_date || undefined,
          status: dbOrder.status as OrderStatus,
          client: dbOrder.customer_name,
          deliveryDeadline: dbOrder.delivery_date,
          delivery_address: dbOrder.delivery_address || dbOrder.customer_name,
          deskTicket: dbOrder.notes || dbOrder.order_number,
          totvsOrderNumber: dbOrder.totvs_order_number || undefined,
          items,
          order_category: dbOrder.order_category,
          // Campos de frete e transporte
          freight_modality: dbOrder.freight_modality || null,
          carrier_name: dbOrder.carrier_name || null,
          freight_type: dbOrder.freight_type || null,
          freight_value: dbOrder.freight_value || null,
          tracking_code: dbOrder.tracking_code || null,
          // Campos de embalagem
          package_volumes: dbOrder.package_volumes || null,
          package_weight_kg: dbOrder.package_weight_kg || null,
          package_length_m: dbOrder.package_length_m || null,
          package_width_m: dbOrder.package_width_m || null,
          package_height_m: dbOrder.package_height_m || null,
          // Campos adicionais
          customer_document: dbOrder.customer_document || null,
          municipality: dbOrder.municipality || null,
          operation_code: dbOrder.operation_code || null,
          executive_name: dbOrder.executive_name || null,
          firmware_project_name: dbOrder.firmware_project_name || null,
          image_project_name: dbOrder.image_project_name || null,
          requires_firmware: dbOrder.requires_firmware || false,
          requires_image: dbOrder.requires_image || false,
          shipping_date: dbOrder.shipping_date || null,
          vehicle_plate: dbOrder.vehicle_plate || null,
          driver_name: dbOrder.driver_name || null,
          updatedAt: dbOrder.updated_at || undefined,
          // Campos RATEIO
          cost_center: dbOrder.cost_center || null,
          account_item: dbOrder.account_item || null,
          business_unit: dbOrder.business_unit || null,
          business_area: dbOrder.business_area || null,
          rateio_project_code: dbOrder.rateio_project_code || null,
          // Campo empresa emissora
          sender_company: dbOrder.sender_company || null,
          // Campo WhatsApp cliente
          customer_whatsapp: dbOrder.customer_whatsapp || null,
          // Campo Contato/Negociador
          customer_contact_name: dbOrder.customer_contact_name || null
        };
      });
      console.log('✅ [loadOrders] Processamento concluído', {
        totalProcessed: ordersWithItems.length
      });

      // Verificar novamente se ainda é a requisição mais recente antes de atualizar state
      if (currentRequestId !== requestIdRef.current) {
        console.log('⏭️ [loadOrders] State obsoleto, não atualizando...', {
          currentRequestId,
          latestRequestId: requestIdRef.current
        });
        return;
      }
      setOrders(ordersWithItems);
      hasLoadedOnceRef.current = true;
    } catch (err: any) {
      // Verificar se foi cancelamento
      if (err.message?.includes('aborted') || err.name === 'AbortError') {
        console.log('🛑 [loadOrders] Requisição cancelada (catch)');
        return;
      }

      // Verificar se ainda é a requisição mais recente
      if (currentRequestId !== requestIdRef.current) {
        console.log('⏭️ [loadOrders] Erro em requisição obsoleta, ignorando...', {
          currentRequestId,
          latestRequestId: requestIdRef.current
        });
        return;
      }
      console.warn('⚠️ [loadOrders] Query otimizada falhou, aplicando fallback...', err);
      try {
        console.log('📡 [loadOrders] Fallback: carregando pedidos (limit 50)...');
        const {
          data: ordersData,
          error: ordersError
        } = await supabase.from('orders').select('*').order('created_at', {
          ascending: false
        }).limit(50).abortSignal(abortControllerRef.current!.signal);
        if (ordersError) throw ordersError;
        console.log('📡 [loadOrders] Fallback: carregando itens por pedido...');
        const ordersWithItems = await Promise.all((ordersData || []).map(async (dbOrder: any) => {
          const {
            data: itemsData,
            error: itemsError
          } = await supabase.from('order_items').select('*').eq('order_id', dbOrder.id).abortSignal(abortControllerRef.current!.signal);
          if (itemsError) {
            console.warn('⚠️ [loadOrders] Fallback: erro ao carregar itens do pedido', {
              orderId: dbOrder.id,
              error: itemsError.message
            });
          }
          const items = (itemsData || []).map((item: any) => ({
            id: item.id,
            itemCode: item.item_code,
            itemDescription: cleanItemDescription(item.item_description),
            unit: item.unit,
            requestedQuantity: item.requested_quantity,
            warehouse: item.warehouse,
            deliveryDate: item.delivery_date,
            deliveredQuantity: item.delivered_quantity,
            item_source_type: item.item_source_type as 'in_stock' | 'production' | 'out_of_stock',
            item_status: item.item_status as 'pending' | 'in_stock' | 'awaiting_production' | 'purchase_required' | 'completed',
            received_status: item.received_status as 'pending' | 'partial' | 'completed',
            production_estimated_date: item.production_estimated_date,
            sla_days: item.sla_days,
            is_imported: item.is_imported,
            import_lead_time_days: item.import_lead_time_days,
            sla_deadline: item.sla_deadline,
            current_phase: item.current_phase,
            phase_started_at: item.phase_started_at,
            userId: item.user_id,
            production_order_number: item.production_order_number
          }));
          const totalRequested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
          const firstItem = items[0];
          return {
            id: dbOrder.id,
            type: dbOrder.order_type as OrderType,
            priority: dbOrder.priority as Priority,
            orderNumber: dbOrder.order_number,
            item: firstItem ? `${firstItem.itemCode} (+${items.length - 1})` : dbOrder.customer_name,
            description: firstItem?.itemDescription || dbOrder.notes || "",
            quantity: totalRequested,
            createdDate: new Date(dbOrder.created_at).toISOString().split('T')[0],
            issueDate: (dbOrder as any).issue_date || undefined,
            status: dbOrder.status as OrderStatus,
            client: dbOrder.customer_name,
            deliveryDeadline: dbOrder.delivery_date,
            delivery_address: dbOrder.delivery_address || dbOrder.customer_name,
            deskTicket: dbOrder.notes || dbOrder.order_number,
            totvsOrderNumber: dbOrder.totvs_order_number || undefined,
            items,
            order_category: dbOrder.order_category,
            freight_modality: dbOrder.freight_modality || null,
            carrier_name: dbOrder.carrier_name || null,
            freight_type: dbOrder.freight_type || null,
            freight_value: dbOrder.freight_value || null,
            tracking_code: dbOrder.tracking_code || null,
            package_volumes: dbOrder.package_volumes || null,
            package_weight_kg: dbOrder.package_weight_kg || null,
            package_length_m: dbOrder.package_length_m || null,
            package_width_m: dbOrder.package_width_m || null,
            package_height_m: dbOrder.package_height_m || null,
            customer_document: dbOrder.customer_document || null,
            municipality: dbOrder.municipality || null,
            operation_code: dbOrder.operation_code || null,
            executive_name: dbOrder.executive_name || null,
            firmware_project_name: dbOrder.firmware_project_name || null,
            image_project_name: dbOrder.image_project_name || null,
            requires_firmware: dbOrder.requires_firmware || false,
            requires_image: dbOrder.requires_image || false,
            shipping_date: dbOrder.shipping_date || null,
            vehicle_plate: dbOrder.vehicle_plate || null,
            driver_name: dbOrder.driver_name || null
          };
        }));
        console.log('✅ [loadOrders] Fallback concluído', {
          totalProcessed: ordersWithItems.length
        });

        // Verificar se ainda é a requisição mais recente
        if (currentRequestId !== requestIdRef.current) {
          console.log('⏭️ [loadOrders] Fallback obsoleto, não atualizando...', {
            currentRequestId,
            latestRequestId: requestIdRef.current
          });
          return;
        }
        setOrders(ordersWithItems);
        hasLoadedOnceRef.current = true;
      } catch (fallbackError: any) {
        // Verificar se foi cancelamento
        if (fallbackError.message?.includes('aborted') || fallbackError.name === 'AbortError') {
          console.log('🛑 [loadOrders] Fallback cancelado');
          return;
        }
        console.error('❌ [loadOrders] Erro no fallback:', fallbackError);
        showLimitedToast("Erro ao carregar pedidos", fallbackError.message || "Erro desconhecido ao carregar pedidos", "destructive");
      }
    } finally {
      // Limpar timeout de segurança
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      console.log('🏁 [loadOrders] Finalizando');
      setLoading(false);
      setRefreshing(false);
      isLoadingRef.current = false;

      // ✅ Indicar sincronização bem-sucedida
      setRealtimeStatus('synced');
      setLastUpdateTime(new Date());
    }
  };
  const handleDeleteOrder = async () => {
    // Atualização otimista: remove o pedido do estado imediatamente
    if (selectedOrder) {
      setOrders(prevOrders => prevOrders.filter(o => o.id !== selectedOrder.id));
      setSelectedOrder(null);
      setShowEditDialog(false);
    }

    // Recarrega do banco para garantir sincronização
    await loadOrders();
  };
  const getPriorityClass = (priority: Priority) => {
    switch (priority) {
      case "high":
        return "priority-high-row";
      case "medium":
        return "priority-medium-row";
      case "low":
        return "priority-low-row";
      default:
        return "";
    }
  };
  const getPriorityLabel = (priority: Priority) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Média";
      case "low":
        return "Baixa";
      default:
        return priority;
    }
  };
  const getProgressBarColor = (daysRemaining: number) => {
    if (daysRemaining > 7) return "bg-progress-good";
    if (daysRemaining > 3) return "bg-progress-warning";
    return "bg-progress-critical";
  };
  const getProgressWidth = (daysRemaining: number) => {
    const maxDays = 30;
    const percentage = Math.max(0, Math.min(100, daysRemaining / maxDays * 100));
    return percentage;
  };

  // Helper function to check if order is in production phase
  const isInProductionPhase = (status: OrderStatus) => {
    return ["separation_started", "in_production", "awaiting_material", "separation_completed", "production_completed"].includes(status);
  };

  // Helper function to check if ecommerce order should appear in sales tab
  const isEcommerceInSalesPhase = (status: OrderStatus) => {
    const salesPhaseStatuses: OrderStatus[] = [
    // Preparação
    "pending", "in_analysis", "awaiting_approval", "planned",
    // Faturamento
    "invoice_requested", "awaiting_invoice", "invoice_issued", "invoice_sent",
    // Produção
    "separation_started", "in_production", "awaiting_material", "separation_completed", "production_completed",
    // Laboratório
    "awaiting_lab", "in_lab_analysis", "lab_completed",
    // Embalagem
    "in_quality_check", "in_packaging", "ready_for_shipping",
    // Expedição
    "released_for_shipping", "in_expedition", "pickup_scheduled", "awaiting_pickup"];
    return salesPhaseStatuses.includes(status);
  };

  // Filter orders based on active tab, search, and date range
  const filteredOrders = orders.filter(order => {
    let matchesTab = false;
    if (activeTab === "all") {
      matchesTab = true;
    } else if (activeTab === "production") {
      matchesTab = isInProductionPhase(order.status);
    } else if (activeTab === "in_transit") {
      matchesTab = order.status === "collected" || order.status === "in_transit";
    } else if (activeTab === "completed") {
      matchesTab = order.status === "delivered" || order.status === "completed";
    } else if (activeTab === "sales") {
      // Todos os pedidos de vendas e e-commerce devem ser visíveis independente do status
      matchesTab = order.type === "sales" || order.type.includes("ecommerce") || order.type.includes("vendas");
    } else if (activeTab === "materials") {
      matchesTab = order.type === "materials";
    }
    // Busca direta por número de pedido (solução 1C)
    const isNumericSearch = /^\d+$/.test(searchQuery.trim());
    const matchesSearch = isNumericSearch ? order.orderNumber.includes(searchQuery.trim()) || order.totvsOrderNumber?.includes(searchQuery.trim()) : order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) || order.item.toLowerCase().includes(searchQuery.toLowerCase()) || order.client.toLowerCase().includes(searchQuery.toLowerCase()) || order.deskTicket.toLowerCase().includes(searchQuery.toLowerCase());

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
  const handleAddOrder = async (orderData: any) => {
    if (!user) return;
    try {
      // Usar hook centralizado para obter organization_id
      const organizationId = requireOrganization();
      const orderNumber = generateOrderNumber(orderData.type);
      
      const {
        data: orderRow,
        error: orderError
      } = await supabase.from('orders').insert({
        user_id: user.id,
        organization_id: organizationId,
        order_number: orderNumber,
        customer_name: orderData.client,
        customer_whatsapp: orderData.customerWhatsapp || null,
        delivery_address: orderData.client,
        delivery_date: orderData.deliveryDeadline,
        status: "almox_ssm_pending",
        priority: orderData.priority,
        order_type: orderData.type,
        notes: orderData.deskTicket,
        totvs_order_number: orderData.totvsOrderNumber || orderNumber
      }).select().single();
      if (orderError) throw orderError;

      // Register manual creation in history
      await supabase.from('order_changes').insert({
        order_id: orderRow.id,
        organization_id: organizationId,
        field_name: 'created',
        old_value: '',
        new_value: 'manual_creation',
        changed_by: user.id,
        change_category: 'order_creation',
        change_type: 'create'
      });

      // Insert all items
      if (orderData.items && orderData.items.length > 0) {
        const itemsToInsert = orderData.items.map((item: any) => ({
          order_id: orderRow.id,
          user_id: user.id,
          organization_id: organizationId,
          item_code: item.itemCode,
          item_description: item.itemDescription,
          unit: item.unit,
          requested_quantity: item.requestedQuantity,
          warehouse: item.warehouse,
          delivery_date: item.deliveryDate,
          delivered_quantity: item.deliveredQuantity,
          item_source_type: item.item_source_type || 'in_stock',
          received_status: item.received_status || 'pending',
          production_estimated_date: item.production_estimated_date || null
        }));
        const {
          error: itemsError
        } = await supabase.from('order_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      // Upload PDF to Storage
      if (orderData.pdfFile) {
        const fileName = `${orderNumber}_${Date.now()}.pdf`;
        const filePath = `${user.id}/${fileName}`;
        const {
          data: uploadData,
          error: uploadError
        } = await supabase.storage.from('order-attachments').upload(filePath, orderData.pdfFile, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        });
        if (uploadError) {
          console.error("Error uploading PDF:", uploadError);
          throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
        }

        // Save attachment metadata
        const {
          error: attachmentError
        } = await supabase.from('order_attachments').insert({
          order_id: orderRow.id,
          organization_id: organizationId,
          file_name: orderData.pdfFile.name,
          file_path: uploadData.path,
          file_size: orderData.pdfFile.size,
          file_type: orderData.pdfFile.type,
          uploaded_by: user.id
        });
        if (attachmentError) {
          console.error("Error saving attachment metadata:", attachmentError);
          throw new Error("Erro ao salvar informações do anexo");
        }
      }
      await loadOrders();
      toast({
        title: "Pedido criado com sucesso!",
        description: `${orderNumber} foi criado com ${orderData.items?.length || 0} item(ns) e PDF anexado.`
      });
    } catch (error: any) {
      toast({
        title: "Erro ao criar pedido",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const generateOrderNumber = (type: OrderType) => {
    const prefix = type === "production" ? "PRD" : type === "sales" ? "VND" : type === "ecommerce" ? "ECOM" : "MAT";
    const year = new Date().getFullYear();
    const count = orders.filter(o => o.type === type).length + 1;
    return `${prefix}-${year}-${count.toString().padStart(3, '0')}`;
  };

  // Compute received_status based on quantities
  const computeReceivedStatus = (delivered: number, requested: number): 'pending' | 'partial' | 'completed' => {
    if (!requested || delivered <= 0) return 'pending';
    if (delivered < requested) return 'partial';
    return 'completed';
  };
  const handleEditOrder = async (updatedOrder: Order) => {
    if (!user) return;

    // Marcar que estamos atualizando localmente
    isUpdatingRef.current = true;
    try {
      const {
        data: updatedRow,
        error: orderError
      } = await supabase.from('orders').update({
        customer_name: updatedOrder.client,
        delivery_address: updatedOrder.client,
        delivery_date: updatedOrder.deliveryDeadline,
        status: updatedOrder.status,
        priority: updatedOrder.priority,
        order_type: updatedOrder.type,
        notes: updatedOrder.deskTicket,
        totvs_order_number: updatedOrder.totvsOrderNumber || null,
        customer_document: (updatedOrder as any).customerDocument || null,
        municipality: (updatedOrder as any).municipality || null,
        operation_code: (updatedOrder as any).operationCode || null,
        executive_name: (updatedOrder as any).executiveName || null,
        // Campos de frete (usando snake_case correto)
        freight_modality: (updatedOrder as any).freight_modality || null,
        carrier_name: (updatedOrder as any).carrier_name || null,
        freight_type: (updatedOrder as any).freight_type || null,
        freight_value: (updatedOrder as any).freight_value || null,
        tracking_code: (updatedOrder as any).tracking_code || null,
        // Campos de RATEIO
        rateio_project_code: (updatedOrder as any).rateio_project_code || null,
        business_unit: (updatedOrder as any).business_unit || null,
        business_area: (updatedOrder as any).business_area || null,
        cost_center: (updatedOrder as any).cost_center || null,
        account_item: (updatedOrder as any).account_item || null,
        // Campo empresa emissora
        sender_company: (updatedOrder as any).sender_company || null,
        // Campo WhatsApp do cliente
        customer_whatsapp: (updatedOrder as any).customer_whatsapp || null,
        // Campo Contato/Negociador
        customer_contact_name: (updatedOrder as any).customer_contact_name || null
      }).eq('id', updatedOrder.id).select('id').single();
      if (orderError) throw orderError;
      if (!updatedRow) throw new Error("Sem permissão para atualizar este pedido.");

      // Update items - handle existing, new, and deleted items
      if (updatedOrder.items) {
        // Get existing item IDs and owners from database
        const {
          data: existingItems
        } = await supabase.from('order_items').select('id, user_id').eq('order_id', updatedOrder.id);
        const existingItemIds = new Set((existingItems || []).map(item => item.id));
        const currentItemIds = new Set(updatedOrder.items.filter(item => item.id).map(item => item.id as string));

        // Delete only items owned by current user and removed from the list
        const itemsToDelete = (existingItems || []).filter(row => !currentItemIds.has(row.id) && row.user_id === user.id).map(row => row.id);
        if (itemsToDelete.length > 0) {
          const {
            error: deleteError
          } = await supabase.from('order_items').delete().in('id', itemsToDelete);
          if (deleteError) throw deleteError;
        }

        // Update existing items (only own items) and insert new ones
        for (const item of updatedOrder.items) {
          // Calculate correct status based on quantities
          const statusToSave = computeReceivedStatus(item.deliveredQuantity, item.requestedQuantity);
          if (item.id) {
            // RLS policies handle security - allow collaborative editing of all items
            const {
              error: updateError
            } = await supabase.from('order_items').update({
              item_code: item.itemCode,
              item_description: item.itemDescription,
              unit: item.unit,
              requested_quantity: item.requestedQuantity,
              warehouse: item.warehouse,
              delivery_date: item.deliveryDate,
              delivered_quantity: Math.max(0, Math.min(item.deliveredQuantity, item.requestedQuantity)),
              item_source_type: item.item_source_type || 'in_stock',
              item_status: item.item_status || 'in_stock',
              received_status: statusToSave,
              production_estimated_date: item.production_estimated_date || null,
              sla_days: item.sla_days,
              is_imported: item.is_imported,
              import_lead_time_days: item.import_lead_time_days,
              production_order_number: item.production_order_number || null
            }).eq('id', item.id);
            if (updateError) throw updateError;
          } else {
            // Insert new item (owned by current user)
            const {
              error: insertError
            } = await supabase.from('order_items').insert({
              order_id: updatedOrder.id,
              user_id: user.id,
              item_code: item.itemCode,
              item_description: item.itemDescription,
              unit: item.unit,
              requested_quantity: item.requestedQuantity,
              warehouse: item.warehouse,
              delivery_date: item.deliveryDate,
              delivered_quantity: Math.max(0, Math.min(item.deliveredQuantity, item.requestedQuantity)),
              item_source_type: item.item_source_type || 'in_stock',
              item_status: item.item_status || 'in_stock',
              received_status: statusToSave,
              production_estimated_date: item.production_estimated_date || null,
              sla_days: item.sla_days,
              is_imported: item.is_imported,
              import_lead_time_days: item.import_lead_time_days,
              production_order_number: item.production_order_number || null
            });
            if (insertError) throw insertError;
          }
        }
      }
      await loadOrders();

      // Só mostrar toast após confirmar sucesso da atualização local
      toast({
        title: "Pedido atualizado",
        description: `Pedido ${updatedOrder.orderNumber} foi atualizado com sucesso.`
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar pedido",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSelectedOrder(null);
      // Resetar flag após 1 segundo
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 1000);
    }
  };
  const handleDuplicateOrder = async (originalOrder: Order) => {
    if (!user) return;
    try {
      // Usar hook centralizado para obter organization_id
      const organizationId = requireOrganization();
      
      const {
        data,
        error
      } = await supabase.from('orders').insert({
        user_id: user.id,
        organization_id: organizationId,
        order_number: generateOrderNumber(originalOrder.type),
        customer_name: originalOrder.client,
        delivery_address: originalOrder.client,
        delivery_date: originalOrder.deliveryDeadline,
        status: "pending",
        priority: originalOrder.priority,
        order_type: originalOrder.type,
        notes: originalOrder.description
      }).select().single();
      if (error) throw error;
      await loadOrders();
      toast({
        title: "Pedido duplicado",
        description: "Um novo pedido foi criado com base no original."
      });
    } catch (error: any) {
      toast({
        title: "Erro ao duplicar pedido",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const handleApproveOrder = async (orderId: string) => {
    if (!user) return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    try {
      const {
        error
      } = await supabase.from('orders').update({
        status: "planned"
      }).eq('id', orderId);
      if (error) throw error;

      // Register in history
      await saveOrderHistory(orderId, order.status, "planned", order.orderNumber);
      await loadOrders();
      toast({
        title: "Pedido aprovado",
        description: "Pedido foi planejado e aprovado para produção."
      });
    } catch (error: any) {
      toast({
        title: "Erro ao aprovar pedido",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const handleCancelOrder = async (orderId: string) => {
    if (!user) return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    try {
      const {
        error
      } = await supabase.from('orders').update({
        status: "cancelled"
      }).eq('id', orderId);
      if (error) throw error;

      // Register in history
      await saveOrderHistory(orderId, order.status, "cancelled", order.orderNumber);
      await loadOrders();
      toast({
        title: "Pedido cancelado",
        description: "Pedido foi marcado como cancelado.",
        variant: "destructive"
      });
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar pedido",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  // 🔔 Função helper para disparar notificação proativa ao cliente
  const triggerProactiveNotification = async (orderId: string, newStatus: string, orderNumber: string) => {
    try {
      console.log('🔔 [Notify] Iniciando verificação para status:', newStatus);

      // Mapear status para fases de notificação
      const statusToPhase: Record<string, string> = {
        // Fase: Pedido criado/recebido
        'almox_ssm_pending': 'order_created',
        'almox_ssm_received': 'order_created',
        'almox_ssm_approved': 'order_created',
        'order_generated': 'order_created',
        // Fase: Em produção
        'separation_started': 'in_production',
        'in_production': 'in_production',
        'awaiting_material': 'in_production',
        // Fase: Produção concluída
        'separation_completed': 'production_completed',
        'production_completed': 'production_completed',
        // Fase: Pronto para envio
        'in_packaging': 'ready_for_shipping',
        'ready_for_shipping': 'ready_for_shipping',
        'awaiting_pickup': 'ready_for_shipping',
        'pickup_scheduled': 'ready_for_shipping',
        // Fase: Em trânsito
        'in_transit': 'in_transit',
        'collected': 'in_transit',
        // Fase: Entregue
        'delivered': 'delivered',
        'completed': 'delivered',
        // Fase: Atraso
        'delayed': 'delayed',
        // Fase: À Faturar
        'ready_to_invoice': 'ready_to_invoice',
        'pending_invoice_request': 'ready_to_invoice',
        // Fase: Faturamento Solicitado
        'invoice_requested': 'invoicing',
        'awaiting_invoice': 'invoicing',
        'invoice_issued': 'invoicing',
        'invoice_sent': 'invoicing',
        // Fase: Expedição
        'released_for_shipping': 'ready_for_shipping',
        'in_expedition': 'ready_for_shipping'
      };
      const phase = statusToPhase[newStatus];
      console.log('🔔 [Notify] Mapeamento:', newStatus, '→', phase || '(não mapeado)');
      if (!phase) {
        console.log('⏭️ [Notify] Status não mapeado para notificação');
        return;
      }

      // Buscar configuração do agente customer
      const {
        data: agentConfig,
        error: configError
      } = await supabase.from('ai_agent_config').select('is_active, notification_phases, test_phone').eq('agent_type', 'customer').limit(1).single();
      if (configError) {
        console.error('❌ [Notify] Erro ao buscar config:', configError);
        return;
      }
      console.log('🔔 [Notify] Config do agente:', {
        is_active: agentConfig?.is_active,
        notification_phases: agentConfig?.notification_phases,
        test_phone: agentConfig?.test_phone
      });
      if (!agentConfig?.is_active) {
        console.log('⏭️ [Notify] Agente customer inativo');
        return;
      }
      if (!agentConfig?.notification_phases?.includes(phase)) {
        console.log('⏭️ [Notify] Fase não habilitada:', phase, '| Habilitadas:', agentConfig.notification_phases);
        return;
      }

      // ✅ Disparar notificação!
      console.log(`🚀 [Notify] Disparando notificação para fase: ${phase}`);
      const {
        data: notifyResult,
        error: notifyError
      } = await supabase.functions.invoke('ai-agent-notify', {
        body: {
          order_id: orderId,
          new_status: newStatus,
          trigger_type: 'status_change',
          agent_type: 'customer'
        }
      });
      if (notifyError) {
        console.error('❌ [Notify] Erro na edge function:', notifyError);
        toast({
          title: "Erro ao notificar cliente",
          description: notifyError.message,
          variant: "destructive"
        });
      } else {
        console.log('✅ [Notify] Notificação enviada:', notifyResult);
        toast({
          title: "📱 Cliente notificado",
          description: `Mensagem enviada sobre pedido ${orderNumber}`
        });
      }
    } catch (error: any) {
      console.error('⚠️ [Notify] Exceção:', error);
    }
  };
  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    console.log('🎯 [StatusChange] INÍCIO - orderId:', orderId, 'newStatus:', newStatus);
    if (!user) {
      console.log('🎯 [StatusChange] ABORTADO - Sem usuário');
      return;
    }
    const order = orders.find(o => o.id === orderId);
    const previousStatus = order?.status;
    console.log('🎯 [StatusChange] Pedido encontrado:', order?.orderNumber, '| Status anterior:', previousStatus);

    // 🚀 PASSO 1: Atualizar estado local IMEDIATAMENTE (feedback instantâneo)
    setOrders(orders.map(o => o.id === orderId ? {
      ...o,
      status: newStatus
    } : o));
    try {
      // Detectar mudança para fase "Gerar Ordem"
      const orderGenerationStatuses = ['order_generation_pending', 'order_in_creation', 'order_generated'];
      const isMovingToOrderGeneration = orderGenerationStatuses.includes(newStatus);
      let updateData: any = {
        status: newStatus
      };

      // Se está mudando para fase "Gerar Ordem", calcular novo prazo baseado no SLA
      if (isMovingToOrderGeneration && order) {
        // Buscar SLA padrão do tipo de pedido
        const {
          data: orderTypeConfig
        } = await supabase.from('order_type_config').select('default_sla_days').eq('order_type', order.type).single();
        if (orderTypeConfig?.default_sla_days) {
          // Calcular nova data de entrega: hoje + SLA padrão
          const today = new Date();
          const newDeliveryDate = new Date(today);
          newDeliveryDate.setDate(newDeliveryDate.getDate() + orderTypeConfig.default_sla_days);
          updateData.delivery_date = newDeliveryDate.toISOString().split('T')[0];
          console.log(`📅 Calculando prazo: hoje + ${orderTypeConfig.default_sla_days} dias = ${updateData.delivery_date}`);
        }
      }

      // PASSO 2: Salvar no banco
      const {
        error
      } = await supabase.from('orders').update(updateData).eq('id', orderId);
      if (error) throw error;

      // 🔥 PASSO 3: Operações secundárias em PARALELO (não bloqueantes)
      Promise.all([
      // Broadcast para outros usuários
      supabase.channel('order-status-broadcast').send({
        type: 'broadcast',
        event: 'status_changed',
        payload: {
          orderId,
          newStatus,
          changedBy: user.id,
          orderNumber: order?.orderNumber,
          timestamp: new Date().toISOString()
        }
      }),
      // Salvar histórico
      order && previousStatus ? saveOrderHistory(orderId, previousStatus, newStatus, order.orderNumber) : Promise.resolve(),
      // Registrar em order_changes
      previousStatus !== newStatus ? supabase.from('order_changes').insert({
        order_id: orderId,
        field_name: 'status',
        old_value: previousStatus,
        new_value: newStatus,
        changed_by: user.id,
        change_category: 'status_change'
      }) : Promise.resolve()]).then(() => {
        console.log('✅ Operações secundárias concluídas em background');
      }).catch(error => {
        console.error('⚠️ Erro em operações secundárias (não crítico):', error);
      });

      // 🔔 PASSO 4: Notificação PROATIVA ao cliente (executada FORA do Promise.all)
      console.log('🔔 [Notify] PASSO 4 - Chamando triggerProactiveNotification');
      await triggerProactiveNotification(orderId, newStatus, order?.orderNumber || '');

      // 🔔 PASSO 5: Notificar gestor da fase via WhatsApp (fire-and-forget)
      supabase.functions.invoke('notify-phase-manager', {
        body: {
          orderId,
          oldStatus: previousStatus,
          newStatus,
          orderType: order?.type,
          orderCategory: order?.order_category,
          notificationType: 'status_change'
        }
      }).then(({ data }) => {
        if (data?.notifications_sent > 0) {
          console.log(`📱 [PhaseManager] ${data.notifications_sent} gestor(es) notificado(s)`);
        }
      }).catch(err => console.log('⚠️ Erro ao notificar gestor:', err));
      const description = isMovingToOrderGeneration && updateData.delivery_date ? `Pedido ${order?.orderNumber} movido para ${getStatusLabel(newStatus)} - Prazo calculado automaticamente` : `Pedido ${order?.orderNumber} movido para ${getStatusLabel(newStatus)}`;
      toast({
        title: "Status atualizado",
        description
      });
    } catch (error: any) {
      // 🔄 ROLLBACK: Se falhar, reverter para estado anterior
      setOrders(orders.map(o => o.id === orderId ? {
        ...o,
        status: previousStatus!
      } : o));
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const saveOrderHistory = async (orderId: string, previousStatus: OrderStatus, newStatus: OrderStatus, orderNumber: string) => {
    if (!user) return;
    try {
      const {
        error
      } = await supabase.from('order_history').insert({
        order_id: orderId,
        user_id: user.id,
        old_status: previousStatus,
        new_status: newStatus
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Erro ao salvar histórico:", error.message);
    }
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
      // Faturamento
      "ready_to_invoice": "bg-teal-100 text-teal-700",
      "pending_invoice_request": "bg-teal-100 text-teal-700",
      "invoice_requested": "bg-blue-100 text-blue-700",
      "awaiting_invoice": "bg-blue-100 text-blue-700",
      "invoice_issued": "bg-blue-200 text-blue-800",
      "invoice_sent": "bg-blue-300 text-blue-900",
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
  const getLabStatusLabel = (labStatus: string | null | undefined) => {
    if (!labStatus) return "-";
    const labels: Record<string, string> = {
      "in_production": "Em Produção",
      "quality_check": "Controle de Qualidade",
      "ready": "Pronto",
      "error": "Erro de Produção"
    };
    return labels[labStatus] || labStatus;
  };
  const getLabStatusColor = (labStatus: string | null | undefined) => {
    if (!labStatus) return "bg-gray-100 text-gray-600";
    const colors: Record<string, string> = {
      "in_production": "bg-yellow-100 text-yellow-700",
      "quality_check": "bg-blue-100 text-blue-700",
      "ready": "bg-green-100 text-green-700",
      "error": "bg-red-100 text-red-700"
    };
    return colors[labStatus] || "bg-gray-100 text-gray-600";
  };
  const handleRowClick = (order: Order, e?: React.MouseEvent) => {
    // Prevent opening if clicking on buttons or interactive elements
    if (e) {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) {
        return;
      }
    }
    console.log('Opening edit dialog for order:', order.orderNumber);

    // Auto-navigate to appropriate tab based on order status
    if (order.status === "collected" || order.status === "in_transit") {
      setActiveTab("in_transit");
    } else if (order.status === "delivered" || order.status === "completed") {
      setActiveTab("completed");
    }
    setSelectedOrder(order);
    setShowEditDialog(true);
  };
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const {
    density: kanbanDensity,
    setDensity: setKanbanDensity,
    autoDetect: kanbanAutoDetect,
    setAutoDetect: setKanbanAutoDetect
  } = useKanbanDensity();
  return <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar orders={orders} unreadConversationsCount={unreadConversationsCount} pendingApprovalsCount={pendingApprovalsCount} viewMode={viewMode} kanbanDensity={kanbanDensity} kanbanAutoDetect={kanbanAutoDetect} onViewModeChange={setViewMode} onKanbanDensityChange={setKanbanDensity} onKanbanAutoDetectChange={setKanbanAutoDetect} />
        <SidebarInset className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col bg-background overflow-hidden">
            {/* Header - fixed height */}
            <header className="flex-shrink-0 flex items-center justify-between px-4 lg:px-6 py-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <h1 className="text-base md:text-lg lg:text-xl font-bold text-dashboard-header tracking-tight">
                  Sistema Integrado de Gestão de Pedidos
                </h1>
              </div>
              <div className="flex items-center gap-1.5 lg:gap-2">
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" />
                  <Input placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 w-32 lg:w-48 h-8 text-sm" />
                </div>
                <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
                <ViewSettingsPopover viewMode={viewMode} kanbanDensity={kanbanDensity} kanbanAutoDetect={kanbanAutoDetect} onViewModeChange={setViewMode} onKanbanDensityChange={setKanbanDensity} onKanbanAutoDetectChange={setKanbanAutoDetect} />
                <ColumnSettings visibility={columnVisibility} onVisibilityChange={setColumnVisibility} />
                <RealtimeIndicator status={realtimeStatus} lastUpdateTime={lastUpdateTime} />
                <NotificationCenter />
                {isBatchImporting && <Badge variant="secondary" className="animate-pulse gap-1 h-8 px-2">
                    📦 Importando...
                  </Badge>}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-1.5 h-8 px-2 lg:px-3" size="sm" disabled={isBatchImporting}>
                      <Plus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Novo</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border border-border">
                    <DropdownMenuItem onClick={() => {
                    const addButton = document.querySelector('[data-add-order-trigger]') as HTMLElement;
                    addButton?.click();
                  }} disabled={isBatchImporting}>
                      <Plus className="h-4 w-4 mr-2" />
                      Lançamento Manual
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowImportDialog(true)} disabled={isBatchImporting}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Importar do TOTVS
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <AddOrderDialog onAddOrder={handleAddOrder} />
              </div>
            </header>

            {/* Main Content - contained, scroll inside kanban */}
            <main className="flex-1 min-h-0 overflow-hidden px-4 lg:px-6 pb-4">
              {/* Content */}
      {loading ? <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando pedidos...</p>
            <p className="text-xs text-muted-foreground mt-1">Primeira carga - aguarde...</p>
          </div>
        </div> : activeTab === "all" ? <PriorityView orders={filteredOrders} onEdit={handleEditOrder} onDuplicate={handleDuplicateOrder} onApprove={handleApproveOrder} onCancel={handleCancelOrder} onStatusChange={handleStatusChange} onRowClick={order => {
              setSelectedOrder(order);
              setShowEditDialog(true);
            }} viewMode={viewMode} kanbanDensity={kanbanDensity} onViewModeChange={setViewMode} onKanbanDensityChange={setKanbanDensity} /> : <div className="bg-card rounded-lg border overflow-hidden">
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
                  {columnVisibility.labStatus && <th className="text-left p-4 font-semibold">Status Laboratório</th>}
                  {columnVisibility.phaseManagement && <th className="text-left p-4 font-semibold">Gestão de Fase</th>}
                  {columnVisibility.actions && <th className="text-center p-4 font-semibold">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                      const daysRemaining = calculateDaysRemaining(order.deliveryDeadline);
                      return <tr key={order.id} onClick={e => handleRowClick(order, e)} className={`border-t transition-colors hover:bg-muted/50 cursor-pointer ${getPriorityClass(order.priority)}`}>
                      {columnVisibility.priority && <td className="p-4">
                          <span className={`font-medium ${order.priority === "high" ? "priority-blink" : ""}`}>
                            {getPriorityLabel(order.priority)}
                          </span>
                        </td>}
                      {columnVisibility.orderNumber && <td className="p-4 font-mono text-sm">{order.orderNumber}</td>}
                      {columnVisibility.item && <td className="p-4 font-medium">{order.item}</td>}
                      {columnVisibility.description && <td className="p-4 text-sm text-muted-foreground">{order.description}</td>}
                      {columnVisibility.quantity && <td className="p-4 text-center">{order.quantity}</td>}
                      {columnVisibility.createdDate && <td className="p-4 text-sm">{new Date(order.createdDate).toLocaleDateString('pt-BR')}</td>}
                      {columnVisibility.status && <td className="p-4">
                          <Badge className={`status-badge ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </Badge>
                        </td>}
                      {columnVisibility.client && <td className="p-4 text-sm">{order.client}</td>}
                      {columnVisibility.deskTicket && <td className="p-4 text-sm font-mono">{order.deskTicket}</td>}
                      {columnVisibility.deliveryDeadline && <td className="p-4 text-sm">{new Date(order.deliveryDeadline).toLocaleDateString('pt-BR')}</td>}
                      {columnVisibility.daysRemaining && <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Progress value={getProgressWidth(daysRemaining)} className="h-2 flex-1" />
                            <span className="text-xs font-medium w-8 text-right">{daysRemaining}d</span>
                          </div>
                        </td>}
                      {columnVisibility.labStatus && <td className="p-4">
                          <div className="flex flex-col gap-1">
                            {(order as any).lab_ticket_id && <span className="text-xs font-mono text-muted-foreground">
                                #{(order as any).lab_ticket_id}
                              </span>}
                            <Badge className={getLabStatusColor((order as any).lab_status)}>
                              {getLabStatusLabel((order as any).lab_status)}
                            </Badge>
                          </div>
                        </td>}
                      {columnVisibility.phaseManagement && <td className="p-4">
                          <PhaseButtons order={order} onStatusChange={handleStatusChange} />
                        </td>}
                      {columnVisibility.actions && <td className="p-4">
                          <ActionButtons order={order} onEdit={handleEditOrder} onDuplicate={handleDuplicateOrder} onApprove={handleApproveOrder} onCancel={handleCancelOrder} />
                        </td>}
                    </tr>;
                    })}
              </tbody>
            </table>
          </div>
          {filteredOrders.length === 0 && <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-4">Nenhum pedido encontrado para os filtros aplicados.</p>
              <Button variant="outline" onClick={() => {
                  setSearchQuery("");
                  setDateRange(undefined);
                  setActiveTab("all");
                  queueRefresh();
                }} className="gap-2">
                <Search className="h-4 w-4" />
                Redefinir Filtros
              </Button>
            </div>}
        </div>}
            </main>

            {/* Refresh indicator - discreto */}
            {refreshing && <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in z-50">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                <span className="text-sm">Atualizando...</span>
              </div>}

            {/* Edit Dialog with integrated History */}
            {selectedOrder && <EditOrderDialog order={selectedOrder} open={showEditDialog} onOpenChange={setShowEditDialog} onSave={handleEditOrder} onDelete={handleDeleteOrder} />}

            {/* Import Dialog */}
            <ImportOrderDialog open={showImportDialog} onOpenChange={setShowImportDialog} onImportSuccess={queueRefresh} />

            {/* Rateio Upload Dialog */}
            <RateioUploadDialog open={showRateioDialog} onOpenChange={setShowRateioDialog} onSuccess={queueRefresh} />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>;
};