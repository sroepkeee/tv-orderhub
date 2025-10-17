import React, { useState, useEffect, useRef } from "react";
import logo from "@/assets/logo.png";
import { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Calendar, BarChart3, FileSpreadsheet, Plus, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { AddOrderDialog } from "./AddOrderDialog";
import { EditOrderDialog } from "./EditOrderDialog";
import { ActionButtons } from "./ActionButtons";
import { PriorityView } from "./PriorityView";
import { PhaseButtons } from "./PhaseButtons";
import { ColumnSettings, ColumnVisibility } from "./ColumnSettings";
import { DateRangeFilter } from "./DateRangeFilter";
import { UserMenu } from "./UserMenu";
import { ImportOrderDialog } from "./ImportOrderDialog";

import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Types
type Priority = "high" | "medium" | "low";
type OrderStatus = 
  // Fase de Preparação/Planejamento
  | "pending" | "in_analysis" | "awaiting_approval" | "planned"
  // Fase de Separação/Produção
  | "separation_started" | "in_production" | "awaiting_material" | "separation_completed" | "production_completed"
  // Fase de Laboratório
  | "awaiting_lab" | "in_lab_analysis" | "lab_completed"
  // Fase de Embalagem/Conferência
  | "in_quality_check" | "in_packaging" | "ready_for_shipping"
  // Fase de Expedição/Logística
  | "released_for_shipping" | "in_expedition" | "in_transit" | "pickup_scheduled" | "awaiting_pickup" | "collected"
  // Fase de Conclusão
  | "delivered" | "completed"
  // Status de Exceção/Problemas
  | "cancelled" | "on_hold" | "delayed" | "returned";
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
  deskTicket: string;
  totvsOrderNumber?: string;
  items?: import("./AddOrderDialog").OrderItem[];
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const isUpdatingRef = useRef(false);
  
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
      actions: false,
    };
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(`columnVisibility_${user.id}`, JSON.stringify(columnVisibility));
    }
  }, [columnVisibility, user]);

  // Load orders from Supabase
  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

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

    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (!isUpdatingRef.current) {
              loadOrders();
            }
          }, 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items'
        },
        () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (!isUpdatingRef.current) {
              loadOrders();
            }
          }, 500);
        }
      )
      .subscribe();

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
    if (!user) return;
    
    setLoading(true);
    try {
      // Load all orders for shared viewing
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load items for each order
      const ordersWithItems = await Promise.all(
        (data || []).map(async (dbOrder) => {
          const { data: itemsData } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', dbOrder.id);

          const items = (itemsData || []).map(item => ({
            id: item.id,
            itemCode: item.item_code,
            itemDescription: item.item_description,
            unit: item.unit,
            requestedQuantity: item.requested_quantity,
            warehouse: item.warehouse,
            deliveryDate: item.delivery_date,
            deliveredQuantity: item.delivered_quantity,
            item_source_type: item.item_source_type as 'in_stock' | 'production' | 'out_of_stock',
            item_status: item.item_status as 'in_stock' | 'awaiting_production' | 'purchase_required' | 'completed',
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
            deskTicket: dbOrder.notes || dbOrder.order_number,
            totvsOrderNumber: dbOrder.totvs_order_number || undefined,
            items
          };
        })
      );

      setOrders(ordersWithItems);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar pedidos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  // Helper function to check if order is in production phase
  const isInProductionPhase = (status: OrderStatus) => {
    return ["separation_started", "in_production", "awaiting_material", "separation_completed", "production_completed"].includes(status);
  };

  // Helper function to check if ecommerce order should appear in sales tab
  const isEcommerceInSalesPhase = (status: OrderStatus) => {
    const salesPhaseStatuses: OrderStatus[] = [
      // Preparação
      "pending", "in_analysis", "awaiting_approval", "planned",
      // Produção
      "separation_started", "in_production", "awaiting_material", 
      "separation_completed", "production_completed",
      // Laboratório
      "awaiting_lab", "in_lab_analysis", "lab_completed",
      // Embalagem
      "in_quality_check", "in_packaging", "ready_for_shipping",
      // Expedição
      "released_for_shipping", "in_expedition", "pickup_scheduled", "awaiting_pickup"
    ];
    return salesPhaseStatuses.includes(status);
  };

  // Filter orders based on active tab, search, and date range
  const filteredOrders = orders.filter((order) => {
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
      matchesTab = 
        order.type === "sales" || 
        (order.type === "ecommerce" && isEcommerceInSalesPhase(order.status));
    } else if (activeTab === "materials") {
      matchesTab = order.type === "materials";
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
  const handleAddOrder = async (orderData: any) => {
    if (!user) return;

    try {
      const orderNumber = generateOrderNumber(orderData.type);
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          order_number: orderNumber,
          customer_name: orderData.client,
          delivery_address: orderData.client,
          delivery_date: orderData.deliveryDeadline,
          status: "pending",
          priority: orderData.priority,
          order_type: orderData.type,
          notes: orderData.deskTicket,
          totvs_order_number: orderData.totvsOrderNumber || orderNumber,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Register creation in history
      await supabase
        .from('order_history')
        .insert({
          order_id: orderRow.id,
          user_id: user.id,
          old_status: 'pending',
          new_status: 'pending'
        });

      // Insert all items
      if (orderData.items && orderData.items.length > 0) {
        const itemsToInsert = orderData.items.map((item: any) => ({
          order_id: orderRow.id,
          user_id: user.id,
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

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    }

    // Upload PDF to Storage
    if (orderData.pdfFile) {
      const fileName = `${orderNumber}_${Date.now()}.pdf`;
      const filePath = `${user.id}/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('order-attachments')
        .upload(filePath, orderData.pdfFile, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("Error uploading PDF:", uploadError);
        throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
      }

      // Save attachment metadata
      const { error: attachmentError } = await supabase
        .from('order_attachments')
        .insert({
          order_id: orderRow.id,
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
      description: `${orderNumber} foi criado com ${orderData.items?.length || 0} item(ns) e PDF anexado.`,
    });
    } catch (error: any) {
      toast({
        title: "Erro ao criar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateOrderNumber = (type: OrderType) => {
    const prefix = type === "production" ? "PRD" : 
                   type === "sales" ? "VND" : 
                   type === "ecommerce" ? "ECOM" : 
                   "MAT";
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
      const { data: updatedRow, error: orderError } = await supabase
        .from('orders')
        .update({
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
          carrier_name: (updatedOrder as any).carrierName || null,
          freight_type: (updatedOrder as any).freightType || null,
          freight_value: (updatedOrder as any).freightValue || null,
        })
        .eq('id', updatedOrder.id)
        .select('id')
        .single();

      if (orderError) throw orderError;
      if (!updatedRow) throw new Error("Sem permissão para atualizar este pedido.");

      // Update items - handle existing, new, and deleted items
      if (updatedOrder.items) {
        // Get existing item IDs and owners from database
        const { data: existingItems } = await supabase
          .from('order_items')
          .select('id, user_id')
          .eq('order_id', updatedOrder.id);

        const existingItemIds = new Set((existingItems || []).map(item => item.id));
        const currentItemIds = new Set(updatedOrder.items.filter(item => item.id).map(item => item.id as string));

        // Delete only items owned by current user and removed from the list
        const itemsToDelete = (existingItems || [])
          .filter(row => !currentItemIds.has(row.id) && row.user_id === user.id)
          .map(row => row.id);

        if (itemsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('order_items')
            .delete()
            .in('id', itemsToDelete);

          if (deleteError) throw deleteError;
        }

        // Update existing items (only own items) and insert new ones
        for (const item of updatedOrder.items) {
          // Calculate correct status based on quantities
          const statusToSave = computeReceivedStatus(item.deliveredQuantity, item.requestedQuantity);

          if (item.id) {
            // Skip updating items not owned by current user (RLS)
            if (item.userId && item.userId !== user.id) continue;

            const { error: updateError } = await supabase
              .from('order_items')
              .update({
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
                import_lead_time_days: item.import_lead_time_days
              })
              .eq('id', item.id);

            if (updateError) throw updateError;
          } else {
            // Insert new item (owned by current user)
            const { error: insertError } = await supabase
              .from('order_items')
              .insert({
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
                import_lead_time_days: item.import_lead_time_days
              });

            if (insertError) throw insertError;
          }
        }
      }

      await loadOrders();
      
      // Só mostrar toast após confirmar sucesso da atualização local
      toast({
        title: "Pedido atualizado",
        description: `Pedido ${updatedOrder.orderNumber} foi atualizado com sucesso.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar pedido",
        description: error.message,
        variant: "destructive",
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
      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          order_number: generateOrderNumber(originalOrder.type),
          customer_name: originalOrder.client,
          delivery_address: originalOrder.client,
          delivery_date: originalOrder.deliveryDeadline,
          status: "pending",
          priority: originalOrder.priority,
          order_type: originalOrder.type,
          notes: originalOrder.description,
        })
        .select()
        .single();

      if (error) throw error;

      await loadOrders();
      
      toast({
        title: "Pedido duplicado",
        description: "Um novo pedido foi criado com base no original.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao duplicar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    if (!user) return;

    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: "planned" })
        .eq('id', orderId);

      if (error) throw error;

      // Register in history
      await saveOrderHistory(orderId, order.status, "planned", order.orderNumber);

      await loadOrders();
      
      toast({
        title: "Pedido aprovado",
        description: "Pedido foi planejado e aprovado para produção.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao aprovar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!user) return;

    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: "cancelled" })
        .eq('id', orderId);

      if (error) throw error;

      // Register in history
      await saveOrderHistory(orderId, order.status, "cancelled", order.orderNumber);

      await loadOrders();
      
      toast({
        title: "Pedido cancelado",
        description: "Pedido foi marcado como cancelado.",
        variant: "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    if (!user) return;

    const order = orders.find(o => o.id === orderId);
    const previousStatus = order?.status;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Save to history
      if (order && previousStatus) {
        await saveOrderHistory(orderId, previousStatus, newStatus, order.orderNumber);
      }

      await loadOrders();
      
      toast({
        title: "Status atualizado",
        description: `Pedido ${order?.orderNumber} movido para ${getStatusLabel(newStatus)}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveOrderHistory = async (
    orderId: string, 
    previousStatus: OrderStatus, 
    newStatus: OrderStatus,
    orderNumber: string
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('order_history')
        .insert({
          order_id: orderId,
          user_id: user.id,
          old_status: previousStatus,
          new_status: newStatus,
        });

      if (error) throw error;
    } catch (error: any) {
      console.error("Erro ao salvar histórico:", error.message);
    }
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

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Imply Logo" className="h-24 w-auto" />
          <h1 className="text-3xl font-bold text-dashboard-header">Logística SSM</h1>
        </div>
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
          <Button 
            variant="outline" 
            onClick={() => navigate('/metrics')}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Indicadores
          </Button>
          <UserMenu />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Lançamento
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  const addButton = document.querySelector('[data-add-order-trigger]') as HTMLElement;
                  addButton?.click();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Lançamento Manual
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowImportDialog(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Importar do TOTVS
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AddOrderDialog onAddOrder={handleAddOrder} />
        </div>
      </div>

      {/* Tab Navigation - Compacta */}
      <div className="mb-4">
        <div className="flex justify-center items-center gap-1 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.name}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando pedidos...</p>
          </div>
        </div>
      ) : activeTab === "all" ? (
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
                  {columnVisibility.labStatus && <th className="text-left p-4 font-semibold">Status Laboratório</th>}
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
                      {columnVisibility.labStatus && (
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            {(order as any).lab_ticket_id && (
                              <span className="text-xs font-mono text-muted-foreground">
                                #{(order as any).lab_ticket_id}
                              </span>
                            )}
                            <Badge className={getLabStatusColor((order as any).lab_status)}>
                              {getLabStatusLabel((order as any).lab_status)}
                            </Badge>
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
          onDelete={handleDeleteOrder}
        />
      )}

      {/* Import Dialog */}
      <ImportOrderDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportSuccess={loadOrders}
      />
    </div>
  );
};