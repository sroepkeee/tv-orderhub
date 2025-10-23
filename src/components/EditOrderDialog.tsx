import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, User, FileText, CheckCircle, XCircle, Clock, History, Edit, Plus, Trash2, Loader2, MessageSquare, Download, Package, AlertCircle, BarChart3, Settings, Image as ImageIcon, File, FileSpreadsheet, ChevronDown } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { Order } from "./Dashboard";
import { OrderItem } from "./AddOrderDialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { CompleteOrderDialog } from "./CompleteOrderDialog";
import { ExceptionCommentDialog } from "./ExceptionCommentDialog";
import { PhaseButtons } from "./PhaseButtons";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { OrderTypeSelector } from "@/components/OrderTypeSelector";
import { cleanItemDescription } from "@/lib/utils";
import { OrderMetricsTab } from "./metrics/OrderMetricsTab";
import { EnhancedOrderTimeline } from "./EnhancedOrderTimeline";
import { LabWorkView } from "./LabWorkView";

interface HistoryEvent {
  id: string;
  changed_at: string;
  old_status?: string;
  new_status?: string;
  user_id?: string;
  user_name?: string;
  type?: 'order' | 'item' | 'change';
  field_changed?: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
  order_items?: {
    item_code: string;
    item_description: string;
  };
}

interface OrderComment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  user_name?: string;
}

interface EditOrderDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (order: Order) => void;
  onDelete?: () => void;
}

export const EditOrderDialog = ({ order, open, onOpenChange, onSave, onDelete }: EditOrderDialogProps) => {
  const { register, handleSubmit, setValue, reset, getValues, control } = useForm<Order>();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("edit");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [pendingCompletionStatus, setPendingCompletionStatus] = useState<string | null>(null);
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const [pendingExceptionStatus, setPendingExceptionStatus] = useState<string | null>(null);
  const [savingException, setSavingException] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDateChangeDialog, setShowDateChangeDialog] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<Order | null>(null);
  const [dateChangeCategory, setDateChangeCategory] = useState<string>("other");
  const [dateChangeReason, setDateChangeReason] = useState("");
  const [factoryFollowupRequired, setFactoryFollowupRequired] = useState(false);
  const [showItemDateChangeDialog, setShowItemDateChangeDialog] = useState(false);
  const [pendingItemDateChange, setPendingItemDateChange] = useState<{
    itemId: string;
    oldDate: string;
    newDate: string;
    itemIndex: number;
  } | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  
  // Estados para controlar seções colapsáveis
  const [labConfigOpen, setLabConfigOpen] = useState(false);
  const [freightInfoOpen, setFreightInfoOpen] = useState(false);
  const [dimensionsOpen, setDimensionsOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, [open]);

  // Load history from database (order + items + freight changes)
  const loadHistory = async () => {
    if (!order?.id) return;
    
    setLoadingHistory(true);
    try {
      // Histórico do pedido
      const { data: orderHistory, error: orderError } = await supabase
        .from('order_history')
        .select('*')
        .eq('order_id', order.id)
        .order('changed_at', { ascending: false });

      if (orderError) throw orderError;

      // NOVO: Histórico dos itens
      const { data: itemHistory, error: itemError } = await supabase
        .from('order_item_history')
        .select(`
          *,
          order_items(item_code, item_description)
        `)
        .eq('order_id', order.id)
        .order('changed_at', { ascending: false });

      if (itemError) console.error("Error loading item history:", itemError);

      // NOVO: Histórico de mudanças gerais (frete, etc)
      const { data: orderChanges, error: changesError } = await supabase
        .from('order_changes')
        .select('*')
        .eq('order_id', order.id)
        .order('changed_at', { ascending: false });

      if (changesError) console.error("Error loading order changes:", changesError);

      // Load user profiles for all events
      const allUserIds = [
        ...(orderHistory?.filter(h => h.user_id && h.user_id !== '00000000-0000-0000-0000-000000000000')
          .map(h => h.user_id) || []),
        ...(itemHistory?.map(h => h.user_id) || []),
        ...(orderChanges?.map(h => h.changed_by) || [])
      ];
      const userIds = [...new Set(allUserIds)];

      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        profiles = profilesData || [];
      }

      // Mesclar histórico de pedidos e itens
      const orderHistoryWithNames = orderHistory?.map(event => {
        let userName = 'Sistema';
        
        if (event.user_id === '00000000-0000-0000-0000-000000000000') {
          userName = 'Sistema Laboratório';
        } else if (event.user_id) {
          const profile = profiles.find(p => p.id === event.user_id);
          userName = profile?.full_name || profile?.email || 'Usuário';
        }
        
        return {
          ...event,
          user_name: userName,
          type: 'order' as const
        };
      }) || [];

      const itemHistoryWithNames = itemHistory?.map(event => {
        const profile = profiles.find(p => p.id === event.user_id);
        const userName = profile?.full_name || profile?.email || 'Usuário';
        
        return {
          ...event,
          user_name: userName,
          type: 'item' as const
        };
      }) || [];

      const orderChangesWithNames = orderChanges?.map(event => {
        const profile = profiles.find(p => p.id === event.changed_by);
        const userName = profile?.full_name || profile?.email || 'Usuário';
        
        return {
          ...event,
          user_name: userName,
          type: 'change' as const
        };
      }) || [];

      // Combinar e ordenar por data
      const combined = [...orderHistoryWithNames, ...itemHistoryWithNames, ...orderChangesWithNames]
        .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

      setHistoryEvents(combined);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load comments from database
  const loadComments = async () => {
    if (!order?.id) return;
    
    setLoadingComments(true);
    try {
      const { data: commentsData, error } = await supabase
        .from('order_comments')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load user profiles for comments
      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const commentsWithNames = commentsData?.map(comment => ({
        ...comment,
        user_name: profiles?.find(p => p.id === comment.user_id)?.full_name || 
                   profiles?.find(p => p.id === comment.user_id)?.email || 
                   'Usuário'
      })) || [];

      setComments(commentsWithNames);
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  // Load attachments from database
  const loadAttachments = async () => {
    if (!order?.id) return;
    
    setLoadingAttachments(true);
    try {
      const { data: attachmentsData, error } = await supabase
        .from('order_attachments')
        .select('*')
        .eq('order_id', order.id)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      // Load user profiles for attachments
      const userIds = [...new Set(attachmentsData?.map(a => a.uploaded_by) || [])];
      
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        profiles = profilesData || [];
      }

      // Combine attachments with user profiles
      const attachmentsWithProfiles = attachmentsData?.map(attachment => ({
        ...attachment,
        profiles: profiles.find(p => p.id === attachment.uploaded_by)
      })) || [];

      setAttachments(attachmentsWithProfiles);
    } catch (error) {
      console.error("Error loading attachments:", error);
    } finally {
      setLoadingAttachments(false);
    }
  };

  // Download PDF attachment
  const handleDownloadPDF = async (filePath: string, fileName: string) => {
    try {
      console.log('📥 Iniciando download:', { filePath, fileName });
      
      const { data, error } = await supabase.storage
        .from('order-attachments')
        .download(filePath);

      if (error) {
        console.error('❌ Erro ao baixar do storage:', error);
        throw error;
      }

      console.log('✅ Arquivo baixado do storage, criando blob URL...');
      
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      
      console.log('🖱️ Disparando click para download...');
      a.click();
      
      setTimeout(() => {
        console.log('🧹 Limpando recursos do download...');
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      toast({
        title: "Download iniciado",
        description: `Baixando ${fileName}...`
      });
      
    } catch (error: any) {
      console.error("❌ Error downloading PDF:", error);
      toast({
        title: "Erro no download",
        description: error?.message || "Não foi possível baixar o arquivo.",
        variant: "destructive"
      });
    }
  };

  // Delete attachment
  const handleDeleteAttachment = async (attachmentId: string, filePath: string, fileName: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('order-attachments')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('order_attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) throw dbError;

      toast({
        title: "Anexo excluído",
        description: `${fileName} foi removido com sucesso.`
      });

      // Reload attachments
      loadAttachments();
    } catch (error) {
      console.error("Error deleting attachment:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o arquivo.",
        variant: "destructive"
      });
    }
  };

  // Upload new attachment (PDF, images, documents)
  const handleUploadAttachment = async (file: File) => {
    if (!order?.id) {
      console.error('❌ Upload cancelado: pedido não definido');
      return;
    }

    console.log('📤 Iniciando upload de anexo:', { 
      fileName: file.name, 
      fileSize: file.size, 
      orderId: order.id,
      orderNumber: order.orderNumber
    });

    setUploadingAttachment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Tipos aceitos
      const ACCEPTED_TYPES = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      // Validate file
      if (file.size > 20 * 1024 * 1024) {
        console.error('❌ Arquivo muito grande:', file.size);
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 20MB.",
          variant: "destructive"
        });
        return;
      }

      if (!ACCEPTED_TYPES.includes(file.type)) {
        console.error('❌ Tipo inválido:', file.type);
        toast({
          title: "Tipo inválido",
          description: "Tipos aceitos: PDF, Imagens (PNG, JPG, WEBP), Word, Excel",
          variant: "destructive"
        });
        return;
      }

      // Upload to storage
      const fileExtension = file.name.split('.').pop();
      const fileName = `${order.orderNumber}_${Date.now()}.${fileExtension}`;
      const filePath = `${order.id}/${fileName}`;

      console.log('⏳ Fazendo upload para storage:', filePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('order-attachments')
        .upload(filePath, file, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Erro no upload para storage:', uploadError);
        throw uploadError;
      }

      console.log('✅ Upload para storage concluído:', uploadData.path);

      // Save metadata
      const attachmentData = {
        order_id: order.id,
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user.id
      };

      console.log('⏳ Registrando anexo no banco:', attachmentData);

      const { error: attachmentError } = await supabase
        .from('order_attachments')
        .insert(attachmentData);

      if (attachmentError) {
        console.error('❌ Erro ao registrar anexo no banco:', attachmentError);
        throw attachmentError;
      }

      console.log('✅ Anexo registrado com sucesso no banco');

      toast({
        title: "Anexo adicionado",
        description: `${file.name} foi anexado com sucesso.`
      });

      console.log('⏳ Recarregando lista de anexos...');
      await loadAttachments();
      console.log('✅ Lista de anexos recarregada');
    } catch (error: any) {
      console.error("Error uploading attachment:", error);
      toast({
        title: "Erro ao anexar arquivo",
        description: error.message || "Não foi possível anexar o arquivo.",
        variant: "destructive"
      });
    } finally {
      setUploadingAttachment(false);
    }
  };

  // Save new comment
  const handleSaveComment = async () => {
    if (!newComment.trim() || !order?.id) return;

    setSavingComment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from('order_comments')
        .insert({
          order_id: order.id,
          user_id: user.id,
          comment: newComment.trim()
        });

      if (error) throw error;

      // Registrar auditoria do comentário
      await supabase.from('order_changes').insert({
        order_id: order.id,
        changed_by: user.id,
        field_name: 'comment',
        old_value: null,
        new_value: newComment.trim(),
        change_type: 'create'
      });

      setNewComment("");
      setShowCommentInput(false);
      toast({
        title: "Comentário adicionado",
        description: "O comentário foi salvo com sucesso."
      });
      
      loadComments();
    } catch (error) {
      console.error("Error saving comment:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o comentário.",
        variant: "destructive"
      });
    } finally {
      setSavingComment(false);
    }
  };

  useEffect(() => {
    if (open && order) {
      const orderData = {
        ...order,
        customerDocument: (order as any).customer_document,
        municipality: (order as any).municipality,
        operationCode: (order as any).operation_code,
        executiveName: (order as any).executive_name,
        carrierName: (order as any).carrier_name,
        freightType: (order as any).freight_type,
        freightValue: (order as any).freight_value,
      };
      reset(orderData);
      
      // Carregar itens diretamente do banco para garantir dados atualizados
      const loadItems = async () => {
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id);
        
        const mappedItems = (itemsData || []).map(item => ({
          id: item.id,
          itemCode: item.item_code,
          itemDescription: cleanItemDescription(item.item_description),
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
        setItems(mappedItems);
      };
      
      loadItems();
      
      setActiveTab("edit");
      setShowCommentInput(false);
      setNewComment("");
      loadHistory();
      loadComments();
      loadAttachments();
    }
  }, [open, order, reset]);

  // Real-time subscription for history and comments updates
  useEffect(() => {
    if (!open || !order?.id) return;

    const historyChannel = supabase
      .channel(`order_history_${order.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_history',
          filter: `order_id=eq.${order.id}`
        },
        () => {
          loadHistory();
        }
      )
      .subscribe();

    const commentsChannel = supabase
      .channel(`order_comments_${order.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_comments',
          filter: `order_id=eq.${order.id}`
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    const attachmentsChannel = supabase
      .channel(`order_attachments_${order.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_attachments',
          filter: `order_id=eq.${order.id}`
        },
        () => {
          loadAttachments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(historyChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(attachmentsChannel);
    };
  }, [open, order?.id]);

  const addItem = () => {
    setItems([...items, {
      itemCode: "",
      itemDescription: "",
      unit: "UND",
      requestedQuantity: 0,
      warehouse: "",
      deliveryDate: "",
      deliveredQuantity: 0,
      item_source_type: "in_stock"
    }]);
  };

  const getSourceBadge = (type?: 'in_stock' | 'production' | 'out_of_stock') => {
    const badges = {
      in_stock: <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">✅ Estoque</Badge>,
      production: <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">🏭 Produção</Badge>,
      out_of_stock: <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">⚠️ Sem Estoque</Badge>
    };
    return type ? badges[type] : badges.in_stock;
  };

  const removeItem = (index: number) => {
    const target = items[index];
    if (target?.id && target?.userId && target.userId !== currentUserId) {
      toast({
        title: "Sem permissão para excluir",
        description: "Este item foi criado por outro usuário e não pode ser removido.",
        variant: "destructive",
      });
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // NOVO: Registrar mudança de item no histórico
  const recordItemChange = async (
    itemId: string,
    field: 'received_status' | 'delivered_quantity' | 'item_source_type' | 'item_status',
    oldValue: any,
    newValue: any,
    notes?: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log(`📝 Registrando mudança: ${field} de "${oldValue}" para "${newValue}"`);

      await supabase.from('order_item_history').insert({
        order_item_id: itemId,
        order_id: order.id,
        user_id: user.id,
        field_changed: field,
        old_value: String(oldValue),
        new_value: String(newValue),
        notes: notes || null
      });
    } catch (error) {
      console.error("Error recording item change:", error);
    }
  };

  const updateItem = async (index: number, field: keyof OrderItem, value: any) => {
    const oldItem = items[index];
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // NOVO: Detectar mudança de deliveryDate em itens
    if (field === 'deliveryDate' && oldItem.deliveryDate !== value && oldItem.id) {
      setPendingItemDateChange({
        itemId: oldItem.id,
        oldDate: oldItem.deliveryDate,
        newDate: value,
        itemIndex: index
      });
      setShowItemDateChangeDialog(true);
      return; // Não atualizar ainda
    }
    
    // NOVO: Registrar mudança de situação (item_status)
    if (field === 'item_status' && oldItem.item_status !== value && oldItem.id) {
      console.log(`🔄 Situação mudou: ${oldItem.item_status} → ${value}`);
      
      // Validação de permissão
      if (oldItem.userId && oldItem.userId !== currentUserId) {
        toast({
          title: "Sem permissão",
          description: "Você não tem permissão para alterar este item.",
          variant: "destructive",
        });
        return;
      }
      
      // Salvar no banco
      const { error } = await supabase
        .from('order_items')
        .update({ item_status: value })
        .eq('id', oldItem.id);
      
      if (error) {
        console.error('Error updating item_status:', error);
        toast({
          title: "Erro ao atualizar situação",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      await recordItemChange(
        oldItem.id, 
        'item_status', 
        oldItem.item_status || 'in_stock', 
        value,
        `Situação alterada`
      );
      
      const statusLabels = {
        in_stock: '✅ Disponível em Estoque',
        awaiting_production: '🏭 Aguardando Produção',
        purchase_required: '🛒 Solicitar Compra',
        completed: '✓ Concluído'
      };
      
      toast({
        title: "Situação atualizada",
        description: `Item alterado para: ${statusLabels[value as keyof typeof statusLabels]}`,
      });
      
      // Recarregar itens do banco para sincronizar UI
      const { data: reloadedItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
      
      if (reloadedItems) {
        const mappedItems = reloadedItems.map(dbItem => ({
          id: dbItem.id,
          itemCode: dbItem.item_code,
          itemDescription: cleanItemDescription(dbItem.item_description),
          unit: dbItem.unit,
          requestedQuantity: dbItem.requested_quantity,
          warehouse: dbItem.warehouse,
          deliveryDate: dbItem.delivery_date,
          deliveredQuantity: dbItem.delivered_quantity,
          received_status: dbItem.received_status as 'pending' | 'partial' | 'completed',
          item_status: dbItem.item_status as 'in_stock' | 'awaiting_production' | 'purchase_required' | 'completed',
          item_source_type: dbItem.item_source_type as 'in_stock' | 'production' | 'out_of_stock',
          production_estimated_date: dbItem.production_estimated_date,
          unit_price: dbItem.unit_price,
          discount_percent: dbItem.discount_percent,
          ipi_percent: dbItem.ipi_percent,
          icms_percent: dbItem.icms_percent,
          total_value: dbItem.total_value,
          sla_days: dbItem.sla_days,
          is_imported: dbItem.is_imported,
          import_lead_time_days: dbItem.import_lead_time_days,
          sla_deadline: dbItem.sla_deadline,
          current_phase: dbItem.current_phase,
          phase_started_at: dbItem.phase_started_at,
          userId: dbItem.user_id
        }));
        setItems(mappedItems);
      }
      
      // Recarregar histórico
      loadHistory();
      return;
    }
    
    setItems(newItems);
  };

  // Update received quantity and item status
  const handleUpdateReceivedQuantity = async (itemId: string, receivedQty: number, requestedQty: number) => {
    const currentItem = items.find(i => i.id === itemId);
    if (!currentItem) return;

    const oldQty = currentItem.deliveredQuantity;
    const oldItemStatus = currentItem.item_status || 'in_stock';
    
    // Determinar novo status baseado na quantidade recebida
    let newItemStatus = oldItemStatus;
    if (receivedQty >= requestedQty) {
      newItemStatus = 'completed';
    }
    
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ 
          delivered_quantity: receivedQty,
          item_status: newItemStatus
        })
        .eq('id', itemId);
        
      if (error) throw error;
      
      // NOVO: Registrar histórico de quantidade
      if (oldQty !== receivedQty) {
        await recordItemChange(itemId, 'delivered_quantity', oldQty, receivedQty);
      }
      
      // NOVO: Registrar histórico de status se mudou
      if (oldItemStatus !== newItemStatus) {
        await recordItemChange(itemId, 'item_status', oldItemStatus, newItemStatus, 'Quantidade completada');
      }
      
      // Reload items from database
      const { data: updatedItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
        
      if (updatedItems) {
        setItems(updatedItems.map(item => ({
          id: item.id,
          itemCode: item.item_code,
          itemDescription: cleanItemDescription(item.item_description),
          unit: item.unit,
          requestedQuantity: item.requested_quantity,
          warehouse: item.warehouse,
          deliveryDate: item.delivery_date,
          deliveredQuantity: item.delivered_quantity,
          received_status: (item.received_status as 'pending' | 'partial' | 'completed') || 'pending',
          item_source_type: (item.item_source_type as 'in_stock' | 'production' | 'out_of_stock') || 'in_stock',
          item_status: (item.item_status as 'in_stock' | 'awaiting_production' | 'purchase_required' | 'completed') || 'in_stock',
          production_estimated_date: item.production_estimated_date,
          userId: item.user_id,
          sla_days: item.sla_days,
          is_imported: item.is_imported,
          import_lead_time_days: item.import_lead_time_days,
          sla_deadline: item.sla_deadline,
          current_phase: item.current_phase,
          phase_started_at: item.phase_started_at
        })));
      }
      
      toast({
        title: "✅ Quantidade atualizada",
        description: newItemStatus === 'completed' 
          ? `Item concluído: ${receivedQty} de ${requestedQty} recebidos` 
          : `${receivedQty} de ${requestedQty} recebidos`
      });
      
      // Recarregar histórico
      loadHistory();
    } catch (error) {
      console.error("Error updating received quantity:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a quantidade recebida.",
        variant: "destructive"
      });
    }
  };

  // Mark item as completed (OK button) - agora atualiza item_status diretamente
  const handleMarkAsCompleted = async (item: OrderItem) => {
    if (!item.id) return;
    
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ 
          delivered_quantity: item.requestedQuantity,
          item_status: 'completed'
        })
        .eq('id', item.id);
        
      if (error) throw error;
      
      // Registrar no histórico
      await recordItemChange(item.id, 'item_status', item.item_status || 'in_stock', 'completed', 'Marcado como concluído');
      await recordItemChange(item.id, 'delivered_quantity', item.deliveredQuantity, item.requestedQuantity);
      
      // Recarregar items
      const { data: updatedItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
        
      if (updatedItems) {
        setItems(updatedItems.map(item => ({
          id: item.id,
          itemCode: item.item_code,
          itemDescription: cleanItemDescription(item.item_description),
          unit: item.unit,
          requestedQuantity: item.requested_quantity,
          warehouse: item.warehouse,
          deliveryDate: item.delivery_date,
          deliveredQuantity: item.delivered_quantity,
          received_status: (item.received_status as 'pending' | 'partial' | 'completed') || 'pending',
          item_source_type: (item.item_source_type as 'in_stock' | 'production' | 'out_of_stock') || 'in_stock',
          item_status: (item.item_status as 'in_stock' | 'awaiting_production' | 'purchase_required' | 'completed') || 'in_stock',
          production_estimated_date: item.production_estimated_date,
          userId: item.user_id,
          sla_days: item.sla_days,
          is_imported: item.is_imported,
          import_lead_time_days: item.import_lead_time_days,
          sla_deadline: item.sla_deadline,
          current_phase: item.current_phase,
          phase_started_at: item.phase_started_at
        })));
      }
      
      toast({
        title: "✅ Item concluído",
        description: "Item marcado como totalmente recebido e concluído"
      });
      
      loadHistory();
    } catch (error) {
      console.error("Error marking as completed:", error);
      toast({
        title: "Erro",
        description: "Não foi possível marcar o item como concluído.",
        variant: "destructive"
      });
    }
  };

  // Get badge for received status
  const getReceiveStatusBadge = (status?: string, deliveredQty?: number, requestedQty?: number) => {
    let actualStatus = status || 'pending';
    
    // Recalculate status if not set
    if (!status && deliveredQty !== undefined && requestedQty !== undefined) {
      if (deliveredQty === 0) {
        actualStatus = 'pending';
      } else if (deliveredQty < requestedQty) {
        actualStatus = 'partial';
      } else {
        actualStatus = 'completed';
      }
    }
    
    const variants = {
      pending: { className: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Pendente', icon: '⏳' },
      partial: { className: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Parcial', icon: '📦' },
      completed: { className: 'bg-green-100 text-green-800 border-green-300', label: 'Completo', icon: '✓' }
    };
    
    const config = variants[actualStatus as keyof typeof variants] || variants.pending;
    
    return (
      <Badge className={config.className} variant="outline">
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </Badge>
    );
  };

  // Handle status change with validation and immediate save
  const handleStatusChange = async (newStatus: string) => {
    // Prevenir chamadas simultâneas
    if (isChangingStatus) {
      console.warn('⚠️ Já existe uma mudança de status em andamento');
      return;
    }
    
    setIsChangingStatus(true);
    console.log('🔄 Mudando status para:', newStatus);
    
    // Check if it's exception status
    if (newStatus === 'exception') {
      setPendingExceptionStatus(newStatus);
      setShowExceptionDialog(true);
      setIsChangingStatus(false);
      return;
    }
  
    if (newStatus === 'completed') {
      // Check for pending items
      const pending = items.filter(item => 
        (item.received_status !== 'completed' && item.received_status !== undefined) || 
        (item.deliveredQuantity < item.requestedQuantity)
      );
      
      if (pending.length > 0) {
        setPendingCompletionStatus(newStatus);
        setShowCompleteDialog(true);
        setIsChangingStatus(false);
        return;
      }
    }
  
    // Salvar imediatamente no banco de dados
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const oldStatus = order.status;
      
      // Detectar mudança para fase "Gerar Ordem"
      const orderGenerationStatuses = ['order_generation_pending', 'order_in_creation', 'order_generated'];
      const isMovingToOrderGeneration = orderGenerationStatuses.includes(newStatus);
      
      let updateData: any = { status: newStatus };
      
      // Se está mudando para fase "Gerar Ordem", calcular novo prazo baseado no SLA
      if (isMovingToOrderGeneration) {
        // Buscar SLA padrão do tipo de pedido
        const { data: orderTypeConfig } = await supabase
          .from('order_type_config')
          .select('default_sla_days')
          .eq('order_type', order.type)
          .single();
        
        if (orderTypeConfig?.default_sla_days) {
          // Calcular nova data de entrega: hoje + SLA padrão
          const today = new Date();
          const newDeliveryDate = new Date(today);
          newDeliveryDate.setDate(newDeliveryDate.getDate() + orderTypeConfig.default_sla_days);
          
          updateData.delivery_date = newDeliveryDate.toISOString().split('T')[0];
          
          // Também atualizar no formulário
          setValue("deliveryDeadline", updateData.delivery_date);
          
          console.log(`📅 Calculando prazo: hoje + ${orderTypeConfig.default_sla_days} dias = ${updateData.delivery_date}`);
        }
      }
      
      // Atualizar status no banco
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);
      
      if (updateError) throw updateError;

      // Registrar no histórico
      const { error: historyError } = await supabase
        .from('order_history')
        .insert({
          order_id: order.id,
          user_id: user.id,
          old_status: oldStatus,
          new_status: newStatus
        });
      
      if (historyError) console.error('Erro ao registrar histórico:', historyError);

      // Atualizar o formulário
      setValue("status", newStatus as any, { shouldDirty: false, shouldTouch: false });
      
      // Atualizar o pedido no estado do componente pai
      const updatedOrder = { ...order, status: newStatus as any };
      if (updateData.delivery_date) {
        updatedOrder.deliveryDeadline = updateData.delivery_date;
      }
      onSave(updatedOrder);
      
      const description = isMovingToOrderGeneration && updateData.delivery_date
        ? `Pedido agora está: ${getStatusLabel(newStatus)} - Prazo calculado automaticamente`
        : `Pedido agora está: ${getStatusLabel(newStatus)}`;
      
      toast({
        title: "✅ Status atualizado",
        description
      });
      
      console.log('✅ Status salvo no banco:', newStatus);
      
      // Recarregar histórico
      loadHistory();
    } catch (error: any) {
      console.error("Erro ao salvar status:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o status.",
        variant: "destructive",
      });
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Confirm completion with or without justification
  const handleConfirmCompletion = async (note?: string) => {
    if (pendingCompletionStatus) {
      setValue("status", pendingCompletionStatus as any);
      
      if (note) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");
          
          const pending = items.filter(item => 
            (item.received_status !== 'completed' && item.received_status !== undefined) || 
            (item.deliveredQuantity < item.requestedQuantity)
          );
          
          const { error } = await supabase.from('order_completion_notes').insert({
            order_id: order.id,
            user_id: user.id,
            note: note,
            pending_items: pending.map(i => ({
              itemCode: i.itemCode,
              itemDescription: i.itemDescription,
              requested: i.requestedQuantity,
              delivered: i.deliveredQuantity,
              status: i.received_status
            }))
          });
          
          if (error) throw error;
          
          toast({
            title: "Pedido concluído com justificativa",
            description: "A observação foi registrada no sistema."
          });
        } catch (error) {
          console.error("Error saving completion note:", error);
          toast({
            title: "Erro",
            description: "Não foi possível salvar a justificativa.",
            variant: "destructive"
          });
        }
      }
    }
    
    setShowCompleteDialog(false);
    setPendingCompletionStatus(null);
  };

  // Confirm exception with mandatory comment
  const handleConfirmException = async (comment: string, responsible: string) => {
    if (!pendingExceptionStatus) return;
    
    setSavingException(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      // Format the comment with structured information
      const formattedComment = `🚨 EXCEÇÃO REGISTRADA\n\n📋 Descrição:\n${comment}\n\n👤 Responsável: ${responsible}\n\n⏰ Registrado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`;
      
      // Insert comment in order_comments table
      const { error: commentError } = await supabase
        .from('order_comments')
        .insert({
          order_id: order.id,
          user_id: user.id,
          comment: formattedComment
        });
      
      if (commentError) throw commentError;
      
      // Apply exception status
      setValue("status", pendingExceptionStatus as any);
      
      toast({
        title: "Exceção registrada",
        description: "O comentário foi salvo e o status foi atualizado para Exceção.",
        variant: "default"
      });
      
      // Reload comments to display the new one
      loadComments();
      
    } catch (error) {
      console.error("Error saving exception:", error);
      toast({
        title: "Erro ao registrar exceção",
        description: "Não foi possível salvar o comentário da exceção.",
        variant: "destructive"
      });
    } finally {
      setSavingException(false);
      setShowExceptionDialog(false);
      setPendingExceptionStatus(null);
    }
  };

  // Download order summary
  const downloadOrderSummary = () => {
    const summary = `
=====================================
        RESUMO DO PEDIDO
=====================================

Pedido Nº: ${order.orderNumber}
Data: ${format(new Date(order.createdDate), 'dd/MM/yyyy HH:mm')}
Tipo: ${order.type === 'production' ? 'Produção' : order.type === 'sales' ? 'Vendas' : 'Materiais'}
Cliente: ${order.client}
Status: ${getStatusLabel(order.status)}
Prioridade: ${order.priority === 'high' ? 'Alta' : order.priority === 'medium' ? 'Média' : 'Baixa'}

-------------------------------------
            ITENS
-------------------------------------
${items.map((item, i) => `
${i + 1}. ${item.itemCode} - ${item.itemDescription}
   Solicitado: ${item.requestedQuantity} ${item.unit}
   Entregue: ${item.deliveredQuantity} ${item.unit}
   Status Recebimento: ${item.received_status === 'completed' ? 'Completo' : item.received_status === 'partial' ? 'Parcial' : 'Pendente'}
   Armazém: ${item.warehouse}
   Data Entrega: ${format(new Date(item.deliveryDate), 'dd/MM/yyyy')}
`).join('\n')}

-------------------------------------
         INFORMAÇÕES ADICIONAIS
-------------------------------------
Prazo de Entrega: ${format(new Date(order.deliveryDeadline), 'dd/MM/yyyy')}
Chamado Desk: ${order.deskTicket || 'N/A'}

${(order as any).lab_ticket_id ? `
-------------------------------------
          LABORATÓRIO
-------------------------------------
Ticket ID: ${(order as any).lab_ticket_id}
Status Lab: ${(order as any).lab_status || 'N/A'}
Notas: ${(order as any).lab_notes || 'Nenhuma'}
` : ''}

=====================================
    Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}
=====================================
    `;
    
    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pedido_${order.orderNumber}_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download iniciado",
      description: `Resumo do pedido ${order.orderNumber} está sendo baixado.`
    });
  };

  const handleDelete = async () => {
    if (!order?.id) return;
    
    setDeleting(true);
    try {
      // 1. Excluir itens do pedido
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', order.id);
      
      if (itemsError) throw itemsError;
      
      // 2. Excluir anexos do storage e da tabela
      if (attachments.length > 0) {
        // Excluir arquivos do storage
        const filePaths = attachments.map(a => a.file_path);
        await supabase.storage.from('order-attachments').remove(filePaths);
        
        // Excluir registros da tabela
        await supabase
          .from('order_attachments')
          .delete()
          .eq('order_id', order.id);
      }
      
      // 3. Excluir comentários
      await supabase
        .from('order_comments')
        .delete()
        .eq('order_id', order.id);
      
      // 4. Excluir histórico
      await supabase
        .from('order_history')
        .delete()
        .eq('order_id', order.id);
      
      // 5. Excluir notas de conclusão
      await supabase
        .from('order_completion_notes')
        .delete()
        .eq('order_id', order.id);
      
      // 6. Excluir mudanças de data
      await supabase
        .from('delivery_date_changes')
        .delete()
        .eq('order_id', order.id);
      
      // 7. Excluir pedido
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', order.id);
      
      if (orderError) throw orderError;
      
      toast({
        title: "Pedido excluído",
        description: `Pedido ${order.orderNumber} foi excluído com sucesso.`,
      });
      
      setShowDeleteConfirm(false);
      onOpenChange(false);
      
      // Aguardar fechamento do dialog antes de recarregar
      setTimeout(() => {
        if (onDelete) {
          onDelete();
        }
      }, 100);
    } catch (error: any) {
      console.error('Erro ao excluir pedido:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o pedido.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const onSubmit = async (data: Order) => {
    console.log('💾 [INICIO] Salvando pedido com dados:', data);
    
    try {
      const updatedOrder = { 
        ...data, 
        id: order.id, 
        items
      };
      
      // ✨ Track ALL field changes for complete history
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
        const fieldsToTrack = [
          { key: 'freight_type', label: 'Tipo de Frete', category: 'shipping_info' },
          { key: 'carrier_name', label: 'Transportadora', category: 'shipping_info' },
          { key: 'tracking_code', label: 'Código de Rastreio', category: 'shipping_info' },
          // ✨ Novos campos de dimensões
          { key: 'package_volumes', label: 'Volumes', category: 'dimensions' },
          { key: 'package_weight_kg', label: 'Peso (Kg)', category: 'dimensions' },
          { key: 'package_height_m', label: 'Altura (m)', category: 'dimensions' },
          { key: 'package_width_m', label: 'Largura (m)', category: 'dimensions' },
          { key: 'package_length_m', label: 'Comprimento (m)', category: 'dimensions' },
        ];
        
        const changes: Array<{field_name: string, old_value: string | null, new_value: string | null, category: string}> = [];
        
        for (const field of fieldsToTrack) {
          const oldValue = (order as any)[field.key];
          const newValue = (data as any)[field.key];
          
          if (oldValue != newValue) {
            changes.push({
              field_name: field.key,
              old_value: oldValue != null ? String(oldValue) : null,
              new_value: newValue != null ? String(newValue) : null,
              category: field.category
            });
          }
        }
        
        // Insert changes into order_changes table
        if (changes.length > 0) {
          for (const change of changes) {
            await supabase.from('order_changes').insert({
              order_id: order.id,
              changed_by: user.id,
              field_name: change.field_name,
              old_value: change.old_value,
              new_value: change.new_value,
              change_type: 'update',
              change_category: change.category
            });
          }
          console.log(`✅ ${changes.length} mudanças registradas no histórico`);
        }
      }
    } catch (error) {
      console.error('❌ [ERRO] Error logging field changes:', error);
      // Não bloquear o save se o tracking falhar
    }
    
    // Check if delivery date changed
    if (order.deliveryDeadline !== data.deliveryDeadline) {
      const oldDate = new Date(order.deliveryDeadline);
      const newDate = new Date(data.deliveryDeadline);
      const diffDays = Math.ceil((newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Validação: Atrasos >= 3 dias exigem categorização
      if (Math.abs(diffDays) >= 3) {
        setPendingOrderData(updatedOrder);
        setShowDateChangeDialog(true);
        setDateChangeCategory("other"); // Reset para forçar seleção
        setDateChangeReason(""); // Forçar preenchimento
        return;
      }
      
      setPendingOrderData(updatedOrder);
      setShowDateChangeDialog(true);
      return;
    }
    
    onSave(updatedOrder);
    onOpenChange(false);
    console.log('✅ [SUCESSO] Pedido salvo com sucesso');
    } catch (error: any) {
      console.error('❌ [ERRO CRÍTICO] Falha ao salvar pedido:', error);
      toast({
        title: "Erro ao salvar",
        description: "Por favor, tente novamente. Se o problema persistir, recarregue a página.",
        variant: "destructive"
      });
    } finally {
      console.log('🏁 [FIM] Processo de salvamento concluído');
    }
  };
  
  const handleDateChangeSubmit = async () => {
    if (!pendingOrderData) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      // NOVO: Inserir mudança de data DIRETAMENTE (sem setTimeout)
      console.log('🔄 Registrando mudança de prazo:', {
        order_id: order.id,
        order_number: order.orderNumber,
        order_item_id: null,
        old_date: order.deliveryDeadline,
        new_date: pendingOrderData.deliveryDeadline,
        category: dateChangeCategory,
        reason: dateChangeReason || '(sem descrição)',
        factory_followup: factoryFollowupRequired
      });

      const { error: changeError } = await supabase
        .from('delivery_date_changes')
        .insert({
          order_id: order.id,
          order_item_id: null, // Mudança do pedido completo, não de item
          old_date: order.deliveryDeadline,
          new_date: pendingOrderData.deliveryDeadline,
          changed_by: user.id,
          change_source: 'manual',
          change_category: dateChangeCategory,
          reason: dateChangeReason || null,
          factory_followup_required: factoryFollowupRequired
        });
      
      if (changeError) {
        console.error('❌ Erro ao inserir delivery_date_changes:', changeError);
        throw changeError;
      }

      console.log('✅ Mudança de prazo registrada com sucesso');
      
      // Agora salvar o pedido
      onSave(pendingOrderData);
      
      // Reset e fechar
      setShowDateChangeDialog(false);
      setPendingOrderData(null);
      setDateChangeCategory("other");
      setDateChangeReason("");
      setFactoryFollowupRequired(false);
      onOpenChange(false);
      
      toast({
        title: "Pedido atualizado",
        description: "Mudança de prazo registrada com sucesso."
      });
    } catch (error) {
      console.error("Error saving date change:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a mudança de prazo.",
        variant: "destructive"
      });
    }
  };
  
  const handleItemDateChangeSubmit = async () => {
    if (!pendingItemDateChange) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      // Inserir diretamente na tabela delivery_date_changes
      const { error } = await supabase
        .from('delivery_date_changes')
        .insert({
          order_item_id: pendingItemDateChange.itemId,
          order_id: order.id,
          old_date: pendingItemDateChange.oldDate,
          new_date: pendingItemDateChange.newDate,
          changed_by: user.id,
          change_source: 'manual',
          change_category: dateChangeCategory,
          reason: dateChangeReason || null,
          factory_followup_required: factoryFollowupRequired
        });
      
      if (error) throw error;
      
      // Agora sim atualizar o item no banco
      const { error: updateError } = await supabase
        .from('order_items')
        .update({ delivery_date: pendingItemDateChange.newDate })
        .eq('id', pendingItemDateChange.itemId);
      
      if (updateError) throw updateError;
      
      // Atualizar estado local
      const newItems = [...items];
      newItems[pendingItemDateChange.itemIndex].deliveryDate = pendingItemDateChange.newDate;
      setItems(newItems);
      
      // Reset states
      setShowItemDateChangeDialog(false);
      setPendingItemDateChange(null);
      setDateChangeCategory("other");
      setDateChangeReason("");
      setFactoryFollowupRequired(false);
      
      toast({
        title: "Item atualizado",
        description: "Mudança de prazo registrada com sucesso."
      });
    } catch (error) {
      console.error("Error saving item date change:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a mudança de prazo.",
        variant: "destructive"
      });
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "Pendente",
      planned: "Planejado",
      in_production: "Em Produção",
      in_transit: "Em Trânsito",
      delivered: "Entregue",
      completed: "Concluído",
      cancelled: "Cancelado",
      exception: "Exceção",
      in_analysis: "Em Análise",
      awaiting_approval: "Aguardando Aprovação",
      separation_started: "Separação Iniciada",
      awaiting_material: "Aguardando Material",
      separation_completed: "Separação Concluída",
      production_completed: "Produção Concluída",
      in_quality_check: "Em Conferência de Qualidade",
      in_packaging: "Em Embalagem",
      ready_for_shipping: "Pronto para Expedição",
      released_for_shipping: "Liberado para Expedição",
      in_expedition: "Em Expedição",
      pickup_scheduled: "Coleta Agendada",
      awaiting_pickup: "Aguardando Coleta",
      collected: "Coletado",
      on_hold: "Em Espera",
      delayed: "Atrasado",
      returned: "Devolvido"
    };
    return statusMap[status] || status;
  };

  const getEventIcon = (oldStatus: string, newStatus: string) => {
    if (newStatus === "cancelled") return <XCircle className="h-4 w-4 text-red-500" />;
    if (newStatus === "completed" || newStatus === "delivered") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (newStatus === "exception") return <AlertCircle className="h-4 w-4 text-orange-500" />;
    if (newStatus === "pending") return <FileText className="h-4 w-4 text-blue-500" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getEventBadgeVariant = (status: string): "default" | "destructive" | "secondary" => {
    if (status === "completed" || status === "delivered") return "default";
    if (status === "cancelled") return "destructive";
    if (status === "exception") return "destructive";
    return "secondary";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-4">
          <DialogHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Pedido #{order?.orderNumber}</DialogTitle>
                <DialogDescription>
                  Visualize e edite os detalhes do pedido ou acompanhe seu histórico de movimentações
                </DialogDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={downloadOrderSummary}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Baixar Resumo
              </Button>
            </div>
          </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 h-9">
            <TabsTrigger value="edit" className="flex items-center gap-1.5 data-[state=active]:bg-blue-500 data-[state=active]:text-white text-xs">
              <Edit className="h-3.5 w-3.5" />
              Editar
            </TabsTrigger>
            <TabsTrigger value="indicators" className="flex items-center gap-1.5 data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Indicadores
            </TabsTrigger>
            <TabsTrigger value="lab" className="flex items-center gap-1.5 data-[state=active]:bg-purple-500 data-[state=active]:text-white text-xs">
              <FileText className="h-3.5 w-3.5" />
              Laboratório
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5 data-[state=active]:bg-green-500 data-[state=active]:text-white text-xs">
              <History className="h-3.5 w-3.5" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex items-center gap-1.5 data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              Comentários
            </TabsTrigger>
            <TabsTrigger value="attachments" className="flex items-center gap-1.5 data-[state=active]:bg-red-500 data-[state=active]:text-white text-xs">
              <FileText className="h-3.5 w-3.5" />
              Anexos
              {attachments.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{attachments.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-3">
            <ScrollArea className="h-[calc(95vh-200px)] pr-3">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="type">Tipo de Pedido</Label>
                    <Controller
                      name="type"
                      control={control}
                      render={({ field }) => (
                        <OrderTypeSelector 
                          value={field.value} 
                          onValueChange={field.onChange} 
                        />
                      )}
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">Prioridade</Label>
                    <Select onValueChange={(value) => setValue("priority", value as any)} defaultValue={order?.priority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="client">Cliente</Label>
                    <Input {...register("client", { required: true })} />
                  </div>
                  <div>
                    <Label htmlFor="deskTicket">Nº Chamado Desk</Label>
                    <Input {...register("deskTicket", { required: true })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="totvsOrderNumber">Nº Pedido TOTVS</Label>
                    <Input 
                      {...register("totvsOrderNumber" as any)} 
                      placeholder="Ex: 123456"
                      maxLength={50}
                    />
                  </div>
                  {order.issueDate && (
                    <div>
                      <Label htmlFor="issueDate">Data de Emissão (TOTVS)</Label>
                      <Input 
                        type="date"
                        value={order.issueDate ? format(new Date(order.issueDate), 'yyyy-MM-dd') : ''}
                        disabled
                        className="bg-muted cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Data original do pedido (não editável)
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label htmlFor="deliveryDeadline">Prazo de Entrega</Label>
                    <Input {...register("deliveryDeadline", { required: true })} type="date" />
                  </div>
                </div>

                {/* Configurações de Firmware e Imagem */}
                <Collapsible open={labConfigOpen} onOpenChange={setLabConfigOpen} className="border-t pt-4">
                  <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-muted/50 p-2 rounded-lg transition-colors">
                    <Label className="text-lg font-semibold flex items-center gap-2 cursor-pointer">
                      <Settings className="h-5 w-5" />
                      Configuração de Placas (Laboratório)
                    </Label>
                    <ChevronDown className={`h-5 w-5 transition-transform ${labConfigOpen ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Firmware Card */}
                      <Card className="p-4 space-y-3 bg-blue-50 dark:bg-blue-950 border-blue-200">
                        <div className="flex items-center space-x-2">
                          <Controller
                            name="requires_firmware"
                            control={control}
                            render={({ field }) => (
                              <Checkbox 
                                id="edit_requires_firmware"
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                          <Label htmlFor="edit_requires_firmware" className="font-semibold cursor-pointer">
                            🔧 Requer Firmware Específico
                          </Label>
                        </div>
                        
                        <div>
                          <Label htmlFor="firmware_project_name">Nome do Projeto/Firmware</Label>
                          <Input 
                            {...register("firmware_project_name")}
                            placeholder="Ex: FW_PLACA_V2.3.1"
                            maxLength={200}
                            className="bg-white dark:bg-gray-900"
                          />
                        </div>
                        
                        {getValues("requires_firmware") && getValues("firmware_project_name") && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                            ✅ {getValues("firmware_project_name")}
                          </Badge>
                        )}
                      </Card>

                      {/* Imagem Card */}
                      <Card className="p-4 space-y-3 bg-purple-50 dark:bg-purple-950 border-purple-200">
                        <div className="flex items-center space-x-2">
                          <Controller
                            name="requires_image"
                            control={control}
                            render={({ field }) => (
                              <Checkbox 
                                id="edit_requires_image"
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                          <Label htmlFor="edit_requires_image" className="font-semibold cursor-pointer">
                            💾 Requer Imagem Específica
                          </Label>
                        </div>
                        
                        <div>
                          <Label htmlFor="image_project_name">Nome da Imagem</Label>
                          <Input 
                            {...register("image_project_name")}
                            placeholder="Ex: IMG_LINUX_2024_Q1"
                            maxLength={200}
                            className="bg-white dark:bg-gray-900"
                          />
                        </div>
                        
                        {getValues("requires_image") && getValues("image_project_name") && (
                          <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                            ✅ {getValues("image_project_name")}
                          </Badge>
                        )}
                      </Card>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Seção de Frete e Transporte */}
                <Collapsible open={freightInfoOpen} onOpenChange={setFreightInfoOpen} className="border-t pt-4">
                  <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-muted/50 p-2 rounded-lg transition-colors">
                    <Label className="text-lg font-semibold flex items-center gap-2 cursor-pointer">
                      <Package className="h-5 w-5" />
                      Informações de Frete e Transporte
                    </Label>
                    <ChevronDown className={`h-5 w-5 transition-transform ${freightInfoOpen ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="space-y-3 mt-3">
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <Label htmlFor="freight_modality">Modalidade de Frete</Label>
                        <Controller
                          name="freight_modality"
                          control={control}
                          render={({ field }) => (
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || ""}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="FOB ou CIF" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="FOB">FOB - Free On Board</SelectItem>
                                <SelectItem value="CIF">CIF - Cost, Insurance and Freight</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div>
                        <Label htmlFor="freight_type">Modo de Envio</Label>
                        <Controller
                          name="freight_type"
                          control={control}
                          render={({ field }) => (
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || ""}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o modo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="aereo">Aéreo</SelectItem>
                                <SelectItem value="transportadora">Transportadora</SelectItem>
                                <SelectItem value="correios">Correios</SelectItem>
                                <SelectItem value="frota_propria">Frota Própria</SelectItem>
                                <SelectItem value="retirada">Retirada no Local</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div>
                        <Label htmlFor="carrier_name">Nome da Transportadora/Empresa</Label>
                        <Input 
                          {...register("carrier_name")}
                          placeholder="Ex: Azul Cargo, Correios, Jadlog"
                          maxLength={100}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                      </div>

                      <div>
                        <Label htmlFor="tracking_code">Código de Rastreamento</Label>
                        <Input 
                          {...register("tracking_code")}
                          placeholder="Ex: BR123456789BR"
                          maxLength={100}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                        />
                      </div>
                    </div>

                    {(getValues("freight_type") || getValues("freight_modality")) && (
                      <Card className="p-3 bg-green-50 dark:bg-green-950 border-green-200">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          {getValues("freight_modality") && (
                            <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-300">
                              {getValues("freight_modality")}
                            </Badge>
                          )}
                          {getValues("freight_type") && (
                            <>
                              {getValues("freight_modality") && <span className="text-muted-foreground">•</span>}
                              <span className="font-medium">
                                Modo de envio: {
                                  getValues("freight_type") === "aereo" ? "Aéreo" :
                                  getValues("freight_type") === "transportadora" ? "Transportadora" :
                                  getValues("freight_type") === "correios" ? "Correios" :
                                  getValues("freight_type") === "frota_propria" ? "Frota Própria" :
                                  "Retirada no Local"
                                }
                              </span>
                            </>
                          )}
                          {getValues("carrier_name") && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span>{getValues("carrier_name")}</span>
                            </>
                          )}
                          {getValues("tracking_code") && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="font-mono text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">
                                {getValues("tracking_code")}
                              </span>
                            </>
                          )}
                        </div>
                      </Card>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* ✨ Seção de Dimensões e Volumes */}
                <Collapsible open={dimensionsOpen} onOpenChange={setDimensionsOpen} className="border-t pt-4">
                  <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-muted/50 p-2 rounded-lg transition-colors">
                    <Label className="text-lg font-semibold flex items-center gap-2 cursor-pointer">
                      <Package className="h-5 w-5 text-primary" />
                      Dimensões e Volumes
                    </Label>
                    <ChevronDown className={`h-5 w-5 transition-transform ${dimensionsOpen ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="space-y-4 mt-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="package_volumes">Volumes (Quantidade)</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="1"
                          {...register("package_volumes")}
                          className="bg-white dark:bg-gray-900"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Número de volumes/pacotes</p>
                      </div>
                      
                      <div>
                        <Label htmlFor="package_weight_kg">Peso Total (Kg)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="0.000"
                          {...register("package_weight_kg")}
                          className="bg-white dark:bg-gray-900"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Peso em quilogramas</p>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Dimensões (centímetros)</Label>
                      <Input
                        type="text"
                        placeholder="Ex: 30 x 40 x 50"
                        defaultValue={
                          order?.package_height_m && order?.package_width_m && order?.package_length_m
                            ? `${Math.round(order.package_height_m * 100)} x ${Math.round(order.package_width_m * 100)} x ${Math.round(order.package_length_m * 100)}`
                            : ''
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          // Parse formato "30 x 40 x 50" ou "30x40x50" ou "30 40 50"
                          const match = value.match(/(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)/i) || 
                                       value.match(/(\d+)\s+(\d+)\s+(\d+)/);
                          
                          if (match) {
                            const [_, height, width, length] = match;
                            setValue("package_height_m", Number(height) / 100);
                            setValue("package_width_m", Number(width) / 100);
                            setValue("package_length_m", Number(length) / 100);
                          }
                        }}
                        className="bg-white dark:bg-gray-900"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Altura x Largura x Comprimento (em centímetros)
                      </p>
                    </div>
                    
                    {/* Preview card */}
                    {(getValues("package_volumes") || getValues("package_weight_kg") || 
                      getValues("package_height_m") || getValues("package_width_m") || 
                      getValues("package_length_m")) && (
                      <Card className="p-3 bg-purple-50 dark:bg-purple-950 border-purple-200">
                        <div className="flex items-start gap-3">
                          <Package className="h-5 w-5 text-purple-600 mt-0.5" />
                          <div className="space-y-1 flex-1">
                            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                              Informações de Embalagem
                            </p>
                            <div className="text-sm text-purple-700 dark:text-purple-300">
                              {getValues("package_volumes") && (
                                <div><span className="font-medium">{getValues("package_volumes")}</span> volume(s)</div>
                              )}
                              {getValues("package_weight_kg") && (
                                <div><span className="font-medium">{getValues("package_weight_kg")} Kg</span> de peso total</div>
                              )}
                              {(getValues("package_height_m") || getValues("package_width_m") || getValues("package_length_m")) && (
                                <div className="font-mono text-xs mt-1 bg-white dark:bg-gray-800 px-2 py-1 rounded inline-block">
                                  {getValues("package_height_m") || 0} x {getValues("package_width_m") || 0} x {getValues("package_length_m") || 0} cm
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <div className="pt-3 border-t">
                  <Label className="text-sm font-medium mb-2 block">Status do Pedido</Label>
                  <PhaseButtons
                    order={{...order, status: getValues("status") || order.status}}
                    onStatusChange={(orderId, newStatus) => handleStatusChange(newStatus)}
                  />
                </div>
                
                {/* Hidden input para garantir que o status seja enviado no formulário */}
                <input type="hidden" {...register("status")} />

                <div className="space-y-3 pt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">Itens do Pedido</Label>
                    <Button type="button" onClick={addItem} size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Adicionar Item
                    </Button>
                  </div>

                  {items.length === 0 ? (
                    <Card className="p-4 text-center text-muted-foreground text-sm">
                      Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                    </Card>
                  ) : (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">Código</TableHead>
                            <TableHead className="min-w-[200px]">Descrição</TableHead>
                            <TableHead className="w-[80px]">UND</TableHead>
                            <TableHead className="w-[100px]">Qtd. Sol.</TableHead>
                            <TableHead className="w-[100px]">Armazém</TableHead>
                              <TableHead className="w-[140px]">Data Entrega</TableHead>
                              <TableHead className="w-[180px]">Situação</TableHead>
                              <TableHead className="w-[120px]">Importação?</TableHead>
                              <TableHead className="w-[120px]">Qtd. Recebida</TableHead>
                              <TableHead className="w-[100px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item, index) => (
                            <TableRow 
                              key={index}
                              data-status={item.item_status}
                              className={`
                                transition-colors
                                ${item.item_status === 'completed' 
                                  ? 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-900/30' 
                                  : 'hover:bg-muted/50'
                                }
                                ${item.deliveredQuantity >= item.requestedQuantity && item.deliveredQuantity > 0
                                  ? 'border-l-4 border-l-green-500'
                                  : ''
                                }
                              `}
                            >
                              <TableCell>
                                <Input
                                  value={item.itemCode}
                                  onChange={(e) => updateItem(index, "itemCode", e.target.value)}
                                  placeholder="ITEM-001"
                                  className="h-8 text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.itemDescription}
                                  onChange={(e) => updateItem(index, "itemDescription", e.target.value)}
                                  placeholder="Descrição"
                                  className="h-8 text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.unit}
                                  onChange={(e) => updateItem(index, "unit", e.target.value)}
                                  placeholder="UND"
                                  className="h-8 text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.requestedQuantity}
                                  onChange={(e) => updateItem(index, "requestedQuantity", parseFloat(e.target.value) || 0)}
                                  min="0"
                                  className="h-8 text-sm"
                                />
                              </TableCell>
                              <TableCell className="p-1">
                                <Input
                                  value={item.warehouse}
                                  onChange={(e) => updateItem(index, "warehouse", e.target.value)}
                                  placeholder="Armazém"
                                  className="h-8 text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="date"
                                  value={item.deliveryDate}
                                  onChange={(e) => updateItem(index, "deliveryDate", e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Select 
                                  value={item.item_status || 'in_stock'}
                                  onValueChange={(value: 'in_stock' | 'awaiting_production' | 'purchase_required' | 'completed') => updateItem(index, "item_status", value)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="in_stock">✅ Disponível em Estoque</SelectItem>
                                    <SelectItem value="awaiting_production">🏭 Aguardando Produção</SelectItem>
                                    <SelectItem value="purchase_required">🛒 Solicitar Compra</SelectItem>
                                    <SelectItem value="completed">✓ Concluído</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {item.item_source_type === 'out_of_stock' && (
                                  <div className="flex flex-col gap-1">
                                    <Select 
                                      value={item.is_imported ? 'yes' : 'no'}
                                      onValueChange={(value) => {
                                        updateItem(index, "is_imported", value === 'yes');
                                        if (value === 'no') {
                                          updateItem(index, "import_lead_time_days", null);
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="no">Não</SelectItem>
                                        <SelectItem value="yes">Sim</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    {item.is_imported && (
                                      <Input
                                        type="number"
                                        value={item.import_lead_time_days || ''}
                                        onChange={(e) => updateItem(index, "import_lead_time_days", parseInt(e.target.value) || null)}
                                        placeholder="Prazo import."
                                        className="h-8 text-sm"
                                        title="Prazo de importação em dias"
                                      />
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.deliveredQuantity}
                                  onChange={(e) => {
                                    const newQty = parseFloat(e.target.value) || 0;
                                    
                                    // Se o item já foi salvo, atualizar no banco
                                    if (item.id) {
                                      handleUpdateReceivedQuantity(item.id, newQty, item.requestedQuantity);
                                    } else {
                                      // Se ainda não foi salvo, apenas atualiza localmente
                                      const validQty = Math.max(0, Math.min(newQty, item.requestedQuantity));
                                      updateItem(index, "deliveredQuantity", validQty);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // Validar ao sair do campo
                                    if (!item.id) {
                                      const newQty = Math.max(0, Math.min(parseFloat(e.target.value) || 0, item.requestedQuantity));
                                      updateItem(index, "deliveredQuantity", newQty);
                                    }
                                  }}
                                  min="0"
                                  max={item.requestedQuantity}
                                  className="h-8 text-sm"
                                  placeholder="0"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMarkAsCompleted(item)}
                                    disabled={!item.id || item.item_status === 'completed'}
                                    className="h-8 gap-1 text-green-700 border-green-300 hover:bg-green-50"
                                    title="Marcar como totalmente recebido e concluído"
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                    OK
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItem(index)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center gap-2 pt-3 sticky bottom-0 bg-background">
                  <Button 
                    type="button" 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir Pedido
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm">
                      Salvar Alterações
                    </Button>
                  </div>
                </div>
              </form>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="indicators" className="mt-4">
            <ScrollArea className="h-[calc(95vh-200px)] pr-4">
              <OrderMetricsTab order={order} items={items} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="lab" className="mt-4">
            <LabWorkView
              orderId={order.id}
              items={items}
              requiresFirmware={order.requires_firmware}
              firmwareProjectName={order.firmware_project_name}
              requiresImage={order.requires_image}
              imageProjectName={order.image_project_name}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[calc(100vh-240px)]">
              <EnhancedOrderTimeline orderId={order.id} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Cliente</p>
                  <p className="text-sm text-muted-foreground">{order?.client}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Chamado Desk</p>
                  <p className="text-sm text-muted-foreground">{order?.deskTicket}</p>
                </div>
              </div>

              {/* Add new comment section */}
              <div className="border rounded-lg p-4 space-y-3">
                {!showCommentInput ? (
                  <Button 
                    type="button"
                    onClick={() => setShowCommentInput(true)}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Comentário
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                      <span>Novo Comentário</span>
                    </div>
                    <Textarea
                      placeholder="Digite seu comentário aqui..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowCommentInput(false);
                          setNewComment("");
                        }}
                        disabled={savingComment}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveComment}
                        disabled={!newComment.trim() || savingComment}
                        className="gap-2"
                      >
                        {savingComment ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          "Salvar Comentário"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Comments list */}
              {loadingComments ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <Card className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhum comentário registrado ainda
                  </p>
                </Card>
              ) : (
                <ScrollArea className="h-[calc(95vh-450px)]">
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{comment.user_name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(comment.created_at), "dd/MM/yyyy HH:mm")}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-6">
                          {comment.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent value="attachments" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Anexos do Pedido</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{attachments.length} arquivo(s)</Badge>
                  <Button
                    size="sm"
                    onClick={() => document.getElementById('attachment-upload')?.click()}
                    disabled={uploadingAttachment}
                    className="gap-2"
                  >
                    {uploadingAttachment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Anexar Arquivo
                      </>
                    )}
                  </Button>
                  <input
                    id="attachment-upload"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleUploadAttachment(file);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </div>

              {loadingAttachments ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : attachments.length === 0 ? (
                <Card className="p-6 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum anexo encontrado</p>
                </Card>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {attachments.map((attachment) => {
                      const isImage = attachment.file_type?.startsWith('image/');
                      const isPDF = attachment.file_type === 'application/pdf';
                      const isWord = attachment.file_type?.includes('word');
                      const isExcel = attachment.file_type?.includes('excel') || attachment.file_type?.includes('spreadsheet');
                      
                      const getFileIcon = () => {
                        if (isImage) return <ImageIcon className="h-10 w-10 text-blue-500" />;
                        if (isPDF) return <FileText className="h-10 w-10 text-red-600" />;
                        if (isWord) return <FileText className="h-10 w-10 text-blue-600" />;
                        if (isExcel) return <FileSpreadsheet className="h-10 w-10 text-green-600" />;
                        return <File className="h-10 w-10 text-gray-500" />;
                      };

                      const getImageUrl = (filePath: string) => {
                        const { data } = supabase.storage
                          .from('order-attachments')
                          .getPublicUrl(filePath);
                        return data.publicUrl;
                      };

                      return (
                        <Card key={attachment.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              {getFileIcon()}
                              <div className="flex-1">
                                <p className="font-medium">{attachment.file_name}</p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                  <span>{(attachment.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                  <span>•</span>
                                  <span>{format(new Date(attachment.uploaded_at), "dd/MM/yyyy 'às' HH:mm")}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Enviado por: {attachment.profiles?.full_name || attachment.profiles?.email || 'Usuário'}
                                </p>
                                
                                {/* Preview de imagem */}
                                {isImage && (
                                  <div className="mt-3">
                                    <img 
                                      src={getImageUrl(attachment.file_path)} 
                                      alt={attachment.file_name}
                                      className="max-w-full h-auto rounded border max-h-64 object-contain"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadPDF(attachment.file_path, attachment.file_name)}
                                className="gap-2"
                              >
                                <Download className="h-4 w-4" />
                                Baixar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteAttachment(attachment.id, attachment.file_path, attachment.file_name)}
                                className="gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                Excluir
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>
        </DialogContent>
      </Dialog>

      {/* Date Change Category Dialog */}
      <Dialog open={showDateChangeDialog} onOpenChange={setShowDateChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📅 Mudança de Prazo Detectada</DialogTitle>
            <DialogDescription>
              Por favor, categorize o motivo desta mudança de prazo para melhor rastreamento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-md text-sm space-y-1">
              <div><strong>Data anterior:</strong> {order?.deliveryDeadline ? format(new Date(order.deliveryDeadline), "dd/MM/yyyy") : '-'}</div>
              <div><strong>Nova data:</strong> {pendingOrderData?.deliveryDeadline ? format(new Date(pendingOrderData.deliveryDeadline), "dd/MM/yyyy") : '-'}</div>
            </div>
            
            <div>
              <Label>Motivo da mudança</Label>
              <select
                value={dateChangeCategory}
                onChange={(e) => {
                  setDateChangeCategory(e.target.value);
                  setFactoryFollowupRequired(e.target.value === 'factory_delay');
                }}
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
              >
                <option value="factory_delay">🏭 Atraso da Fábrica</option>
                <option value="justified">✅ Mudança Justificada</option>
                <option value="client_request">👤 Pedido do Cliente</option>
                <option value="logistics_issue">🚚 Problema Logístico</option>
                <option value="internal_error">⚠️ Erro Interno</option>
                <option value="other">📋 Outro</option>
              </select>
            </div>
            
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={dateChangeReason}
                onChange={(e) => setDateChangeReason(e.target.value)}
                placeholder="Contexto adicional sobre a mudança..."
                rows={3}
              />
            </div>
            
            {dateChangeCategory === 'factory_delay' && (
              <div className="flex items-center space-x-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                <Checkbox
                  id="followup"
                  checked={factoryFollowupRequired}
                  onCheckedChange={(checked) => setFactoryFollowupRequired(checked as boolean)}
                />
                <Label htmlFor="followup" className="text-sm font-normal cursor-pointer">
                  Requer cobrança de prazo com a fábrica
                </Label>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDateChangeDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDateChangeSubmit}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompleteOrderDialog
        pendingItems={items.filter(item => 
          (item.received_status !== 'completed' && item.received_status !== undefined) || 
          (item.deliveredQuantity < item.requestedQuantity)
        )}
        open={showCompleteDialog}
        onConfirm={handleConfirmCompletion}
        onCancel={() => {
          setShowCompleteDialog(false);
          setPendingCompletionStatus(null);
        }}
      />

      <ExceptionCommentDialog
        open={showExceptionDialog}
        onConfirm={handleConfirmException}
        onCancel={() => {
          setShowExceptionDialog(false);
          setPendingExceptionStatus(null);
        }}
        saving={savingException}
      />
      
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Excluir Pedido"
        description={`Tem certeza que deseja excluir o pedido ${order?.orderNumber}? Esta ação é irreversível e excluirá o pedido e todos os seus itens, comentários, anexos e histórico do sistema.`}
        onConfirm={handleDelete}
        variant="destructive"
        confirmText={deleting ? "Excluindo..." : "Sim, excluir"}
        cancelText="Cancelar"
      />

      {/* Date Change Category Dialog for Items */}
      <Dialog open={showItemDateChangeDialog} onOpenChange={setShowItemDateChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📅 Mudança de Prazo de Item</DialogTitle>
            <DialogDescription>
              Categorize a mudança de prazo deste item para rastreamento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-md text-sm space-y-1">
              <div><strong>Data anterior:</strong> {pendingItemDateChange?.oldDate ? format(new Date(pendingItemDateChange.oldDate), "dd/MM/yyyy") : '-'}</div>
              <div><strong>Nova data:</strong> {pendingItemDateChange?.newDate ? format(new Date(pendingItemDateChange.newDate), "dd/MM/yyyy") : '-'}</div>
            </div>
            
            <div>
              <Label>Motivo da mudança</Label>
              <select
                value={dateChangeCategory}
                onChange={(e) => {
                  setDateChangeCategory(e.target.value);
                  setFactoryFollowupRequired(e.target.value === 'factory_delay');
                }}
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
              >
                <option value="factory_delay">🏭 Atraso da Fábrica</option>
                <option value="justified">✅ Mudança Justificada</option>
                <option value="client_request">👤 Pedido do Cliente</option>
                <option value="logistics_issue">🚚 Problema Logístico</option>
                <option value="internal_error">⚠️ Erro Interno</option>
                <option value="other">📋 Outro</option>
              </select>
            </div>
            
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={dateChangeReason}
                onChange={(e) => setDateChangeReason(e.target.value)}
                placeholder="Contexto adicional sobre a mudança..."
                rows={3}
              />
            </div>
            
            {dateChangeCategory === 'factory_delay' && (
              <div className="flex items-center space-x-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                <Checkbox
                  id="item-followup"
                  checked={factoryFollowupRequired}
                  onCheckedChange={(checked) => setFactoryFollowupRequired(checked as boolean)}
                />
                <Label htmlFor="item-followup" className="text-sm font-normal cursor-pointer">
                  Requer cobrança de prazo com a fábrica
                </Label>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDateChangeDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleItemDateChangeSubmit}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};