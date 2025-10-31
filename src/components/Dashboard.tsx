import React, { useState, useEffect, useRef } from "react";
import logo from "@/assets/logo.png";
import { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Calendar, BarChart3, FileSpreadsheet, Plus, ChevronDown, MessageSquare, Truck, Package } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cleanItemDescription } from "@/lib/utils";
import { getStatusLabel } from "@/lib/statusLabels";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { AddOrderDialog } from "./AddOrderDialog";
import { EditOrderDialog } from "./EditOrderDialog";
import { ActionButtons } from "./ActionButtons";
import { PriorityView } from "./PriorityView";
import { PhaseButtons } from "./PhaseButtons";
import { ColumnSettings, ColumnVisibility } from "./ColumnSettings";
import { DateRangeFilter } from "./DateRangeFilter";
import { UserMenu } from "./UserMenu";
import { NotificationCenter } from "./NotificationCenter";
import { ImportOrderDialog } from "./ImportOrderDialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Types
type Priority = "high" | "medium" | "low";
type OrderStatus =
// Fase: Almox SSM
"almox_ssm_received" | "almox_ssm_in_review" | "almox_ssm_approved"
// Fase: Gerar Ordem
| "order_generation_pending" | "order_in_creation" | "order_generated"
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
// Fase: Faturamento
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

// Helper function to wrap Supabase queries with timeout
const fetchWithTimeout = <T,>(
  queryBuilder: { then: (onfulfilled: (value: any) => any) => Promise<T> },
  timeoutMs: number
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    queryBuilder
      .then((result) => {
        clearTimeout(timer);
        resolve(result as T);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// Helper to chunk arrays
const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const Dashboard = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [unreadConversationsCount, setUnreadConversationsCount] = useState(0);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(200);
  const [hasMore, setHasMore] = useState(false);
  const [safeMode, setSafeMode] = useState(false);
  const isUpdatingRef = useRef(false);
  const mountedRef = useRef(true);
  const isLoadingRef = useRef(false);
  const currentLoadIdRef = useRef(0);

  // Column visibility state with user-specific localStorage persistence
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    try {
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
    } catch {
      return {
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
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sync loading state with ref
  useEffect(() => {
    isLoadingRef.current = loading;
  }, [loading]);

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(`columnVisibility_${user.id}`, JSON.stringify(columnVisibility));
    }
  }, [columnVisibility, user]);

  // Check for safe mode URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('safe') === '1') {
      setSafeMode(true);
      console.log('[Dashboard] Safe mode activated - items will not be loaded');
    }
  }, []);

  // Load orders from Supabase
  useEffect(() => {
    if (user) {
      loadOrders();
      loadUnreadCount();
    }
  }, [user]);

  // Reload orders when date range changes
  useEffect(() => {
    loadOrders();
  }, [dateRange]);

  const loadUnreadCount = async () => {
    try {
      const today = new Date();
      const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
      
      const query = supabase
        .from("carrier_conversations")
        .select("*", { count: "exact", head: true })
        .eq("message_direction", "inbound")
        .is("read_at", null)
        .gte("sent_at", sixMonthsAgo.toISOString());

      const { count, error } = await fetchWithTimeout(query, 15000);

      if (error) {
        console.error("[Dashboard] Error loading unread count:", error);
        return;
      }

      setUnreadConversationsCount(count || 0);
    } catch (error) {
      console.error("[Dashboard] Failed to load unread count:", error);
      // Don't block UI for unread count failures
    }
  };

  // Limpar dialog se o pedido selecionado não existir mais
  useEffect(() => {
    if (selectedOrder && !orders.find(o => o.id === selectedOrder.id)) {
      setShowEditDialog(false);
      setSelectedOrder(null);
    }
  }, [orders, selectedOrder]);

  // Realtime subscription for orders - shared view with debounce
  useEffect(() => {
    if (!user) return;
    let timeoutId: NodeJS.Timeout;
    
    const scheduleReload = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!isUpdatingRef.current && !isLoadingRef.current) {
          loadOrders();
        }
      }, 500);
    };

    const channel = supabase.channel('orders-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders'
    }, () => {
      if (!isUpdatingRef.current && !isLoadingRef.current) {
        scheduleReload();
      }
    }).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'order_items'
    }, () => {
      if (!isUpdatingRef.current && !isLoadingRef.current) {
        scheduleReload();
      }
    }).subscribe();
    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Listener for custom order import events
  useEffect(() => {
    const handleOrdersUpdated = () => {
      if (user && !isUpdatingRef.current) {
        loadOrders();
      }
    };
    window.addEventListener('ordersUpdated', handleOrdersUpdated);
    return () => {
      window.removeEventListener('ordersUpdated', handleOrdersUpdated);
    };
  }, [user]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      const loadId = Date.now();
      currentLoadIdRef.current = loadId;

      // Calculate date range with default of 120 days
      const today = new Date();
      const from = dateRange?.from ?? new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000);
      const to = dateRange?.to ?? null;

      console.time('[Dashboard] ordersQuery');

      // Query orders with server-side date filtering
      let ordersQuery = supabase
        .from("orders")
        .select("id, order_type, priority, order_number, customer_name, delivery_address, delivery_date, status, notes, created_at, issue_date, order_category, totvs_order_number, freight_modality, carrier_name, freight_type, freight_value, tracking_code, package_volumes, package_weight_kg, package_length_m, package_width_m, package_height_m, customer_document, municipality, operation_code, executive_name, firmware_project_name, image_project_name, requires_firmware, requires_image, shipping_date, vehicle_plate, driver_name")
        .gte("created_at", from.toISOString())
        .order("created_at", { ascending: false })
        .limit(pageSize + 1);

      if (to) {
        ordersQuery = ordersQuery.lte("created_at", to.toISOString());
      }

      const { data: ordersData, error: ordersError } = await fetchWithTimeout(
        ordersQuery,
        20000
      );

      console.timeEnd('[Dashboard] ordersQuery');

      if (ordersError) throw ordersError;
      if (!ordersData) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Check if stale
      if (currentLoadIdRef.current !== loadId) {
        console.log('[Dashboard] Load cancelled - newer request in progress');
        return;
      }

      // Determine if there are more orders
      const hasMoreOrders = ordersData.length > pageSize;
      setHasMore(hasMoreOrders);
      const ordersToUse = hasMoreOrders ? ordersData.slice(0, pageSize) : ordersData;

      // PHASE 1: Set orders immediately without items
      const ordersWithEmptyItems = ordersToUse.map(order => ({
        ...order,
        items: []
      }));
      
      // Map to Order format
      const mappedOrders = ordersWithEmptyItems.map((dbOrder: any) => {
        const items: any[] = dbOrder.items || [];
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
          driver_name: dbOrder.driver_name || null
        };
      });
      
      setOrders(mappedOrders);
      setLoading(false);

      // Skip items loading in safe mode
      if (safeMode) {
        console.log('[Dashboard] Safe mode - skipping items load');
        return;
      }

      // PHASE 2: Load items progressively in background
      const orderIds = ordersToUse.map(o => o.id);
      const chunks = chunkArray(orderIds, 60); // Smaller chunks for reliability
      const itemsByOrder = new Map<string, any[]>();

      console.log(`[Dashboard] Loading ${chunks.length} chunks of items (${orderIds.length} orders)`);

      // Process chunks with limited concurrency (2 parallel)
      for (let i = 0; i < chunks.length; i += 2) {
        // Check if stale before each window
        if (currentLoadIdRef.current !== loadId) {
          console.log('[Dashboard] Load cancelled during items fetch');
          return;
        }

        const window = chunks.slice(i, i + 2);
        console.time(`[Dashboard] itemsWindow ${i / 2 + 1}`);

        const promises = window.map(async (chunk, idx) => {
          try {
            const itemsQuery = supabase
              .from("order_items")
              .select("id, order_id, item_code, item_description, unit, requested_quantity, warehouse, delivery_date, delivered_quantity, item_source_type, item_status, received_status, production_estimated_date, sla_days, is_imported, import_lead_time_days, sla_deadline, current_phase, phase_started_at, user_id")
              .in("order_id", chunk);

            const { data, error } = await fetchWithTimeout(itemsQuery, 12000);

            if (error) {
              console.error(`[Dashboard] Error loading items chunk ${i + idx}:`, error);
              return;
            }

            if (data) {
              data.forEach((item) => {
                if (!itemsByOrder.has(item.order_id)) {
                  itemsByOrder.set(item.order_id, []);
                }
                itemsByOrder.get(item.order_id)!.push(item);
              });
            }
          } catch (err) {
            console.error(`[Dashboard] Failed to load items chunk ${i + idx}:`, err);
            // Continue with other chunks - don't break UI
          }
        });

        await Promise.all(promises);
        console.timeEnd(`[Dashboard] itemsWindow ${i / 2 + 1}`);

        // Update orders with items progressively
        if (currentLoadIdRef.current === loadId) {
          const updatedOrders = ordersToUse.map((dbOrder: any) => {
            const itemsData = itemsByOrder.get(dbOrder.id) || [];
            const items = itemsData.map((item: any) => ({
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
              driver_name: dbOrder.driver_name || null
            };
          });
          setOrders(updatedOrders);
        }
      }

      console.log('[Dashboard] All items loaded successfully');
    } catch (error: any) {
      console.error("[Dashboard] Error loading orders:", error);
      setErrorMessage(error.message || "Erro ao carregar pedidos");
      setLoading(false);
    }
  };

  // Handle add order dialog open
  const handleAddOrder = () => {
    setShowEditDialog(false);
    setSelectedOrder(null);
    // Open add order dialog logic here
  };

  // Handle edit order dialog open
  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowEditDialog(true);
  };

  // Handle close edit dialog
  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setSelectedOrder(null);
  };

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Filter orders based on active tab and search query
  const filteredOrders = orders.filter(order => {
    if (activeTab !== "all" && order.type !== activeTab && !(activeTab === "in_transit" && order.status === "in_transit") && !(activeTab === "completed" && order.status === "completed")) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return order.orderNumber.toLowerCase().includes(query) ||
        order.item.toLowerCase().includes(query) ||
        order.client.toLowerCase().includes(query);
    }
    return true;
  });

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <img src={logo} alt="Logo" className="logo" />
        <UserMenu unreadCount={unreadConversationsCount} />
      </header>

      <nav className="dashboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.name}
          </button>
        ))}
      </nav>

      <div className="dashboard-controls">
        <Input
          placeholder="Buscar pedidos..."
          value={searchQuery}
          onChange={handleSearchChange}
          icon={<Search />}
        />
        <DateRangeFilter dateRange={dateRange} onChange={setDateRange} />
        <Button onClick={() => setShowImportDialog(true)} icon={<FileSpreadsheet />}>Importar</Button>
        <Button onClick={handleAddOrder} icon={<Plus />}>Novo Pedido</Button>
        <ColumnSettings columnVisibility={columnVisibility} onChange={setColumnVisibility} />
      </div>

      {loading && <Progress />}

      {errorMessage && <div className="error-message">{errorMessage}</div>}

      <table className="orders-table">
        <thead>
          <tr>
            {columnVisibility.priority && <th>Prioridade</th>}
            {columnVisibility.orderNumber && <th>Número</th>}
            {columnVisibility.item && <th>Item</th>}
            {columnVisibility.description && <th>Descrição</th>}
            {columnVisibility.quantity && <th>Quantidade</th>}
            {columnVisibility.createdDate && <th>Data Criação</th>}
            {columnVisibility.status && <th>Status</th>}
            {columnVisibility.client && <th>Cliente</th>}
            {columnVisibility.deskTicket && <th>Ticket</th>}
            {columnVisibility.deliveryDeadline && <th>Entrega</th>}
            {columnVisibility.daysRemaining && <th>Dias Restantes</th>}
            {columnVisibility.labStatus && <th>Status Lab</th>}
            {columnVisibility.phaseManagement && <th>Fases</th>}
            {columnVisibility.actions && <th>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {filteredOrders.map(order => (
            <tr key={order.id} onClick={() => handleEditOrder(order)}>
              {columnVisibility.priority && <td><PriorityView priority={order.priority} /></td>}
              {columnVisibility.orderNumber && <td>{order.orderNumber}</td>}
              {columnVisibility.item && <td>{order.item}</td>}
              {columnVisibility.description && <td>{order.description}</td>}
              {columnVisibility.quantity && <td>{order.quantity}</td>}
              {columnVisibility.createdDate && <td>{order.createdDate}</td>}
              {columnVisibility.status && <td><Badge>{getStatusLabel(order.status)}</Badge></td>}
              {columnVisibility.client && <td>{order.client}</td>}
              {columnVisibility.deskTicket && <td>{order.deskTicket}</td>}
              {columnVisibility.deliveryDeadline && <td>{order.deliveryDeadline}</td>}
              {columnVisibility.daysRemaining && <td>{order.daysOpen ?? "-"}</td>}
              {columnVisibility.labStatus && <td>{/* Lab status component or info here */}</td>}
              {columnVisibility.phaseManagement && <td><PhaseButtons order={order} /></td>}
              {columnVisibility.actions && <td><ActionButtons order={order} /></td>}
            </tr>
          ))}
        </tbody>
      </table>

      {showEditDialog && selectedOrder && (
        <EditOrderDialog
          order={selectedOrder}
          onClose={handleCloseEditDialog}
          onSave={() => {
            setShowEditDialog(false);
            loadOrders();
          }}
        />
      )}

      {showImportDialog && (
        <ImportOrderDialog
          onClose={() => setShowImportDialog(false)}
          onImport={() => {
            setShowImportDialog(false);
            loadOrders();
          }}
        />
      )}
    </div>
  );
};
