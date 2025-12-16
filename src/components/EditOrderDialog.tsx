import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { Calendar, User, FileText, CheckCircle, XCircle, Clock, History, Edit, Plus, Trash2, Loader2, MessageSquare, Download, Package, AlertCircle, BarChart3, Settings, Image as ImageIcon, File, FileSpreadsheet, ChevronDown, Send, Truck, Save, ShoppingCart, Factory, Info, Building2, Wrench, Ruler, MapPin } from "lucide-react";
import { SENDER_OPTIONS, COST_CENTERS, deriveBusinessAreaFromOrder } from "@/lib/senderOptions";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
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
import { cleanItemDescription, cn } from "@/lib/utils";
import { OrderMetricsTab } from "./metrics/OrderMetricsTab";
import { EnhancedOrderTimeline } from "./EnhancedOrderTimeline";
import { LabWorkView } from "./LabWorkView";
import { CarriersTabContent } from "./carriers/CarriersTabContent";
import { VolumeManager } from "./VolumeManager";
import { OrderComments } from "./OrderComments";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfilesCache } from "@/hooks/useProfilesCache";
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
export const EditOrderDialog = ({
  order,
  open,
  onOpenChange,
  onSave,
  onDelete
}: EditOrderDialogProps) => {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    getValues,
    control,
    watch
  } = useForm<Order>();
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const { getProfiles } = useProfilesCache();
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = sessionStorage.getItem('activeTab');
    if (savedTab) {
      sessionStorage.removeItem('activeTab');
      return savedTab;
    }
    return "edit";
  });
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
  const [isSavingShipping, setIsSavingShipping] = useState(false);
  
  // ✨ Estados para lazy loading de abas
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['edit']));

  // Estados para controlar seções colapsáveis
  const [labConfigOpen, setLabConfigOpen] = useState(false);
  const [freightInfoOpen, setFreightInfoOpen] = useState(false);

  // ✨ Estados para rastrear alterações não salvas
  const [originalItems, setOriginalItems] = useState<OrderItem[]>([]);
  const [originalFormValues, setOriginalFormValues] = useState<Partial<Order>>({});
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  
  // ✨ Ref para ignorar próxima atualização realtime (evitar reload desnecessário)
  const ignoreNextRealtimeUpdateRef = useRef(false);

  // Ref para rastrear últimos valores dos campos de frete
  const lastShippingRef = useRef({
    freight_modality: null as string | null,
    freight_type: null as string | null,
    carrier_name: null as string | null,
    tracking_code: null as string | null
  });

  // Ref para timeouts de debounce
  const saveTimers = useRef<Record<string, any>>({});
  // ✨ Handler para lazy loading de abas
  const handleTabChange = async (tab: string) => {
    setActiveTab(tab);
    
    // Carregar dados apenas se a aba ainda não foi carregada
    if (!loadedTabs.has(tab)) {
      if (tab === 'attachments') {
        await loadAttachments();
      }
      
      setLoadedTabs(prev => new Set([...prev, tab]));
    }
  };

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({
      data: {
        user
      }
    }) => {
      setCurrentUserId(user?.id || null);
    });
  }, [open]);

  // ✨ Verificar se há alterações não salvas
  const hasUnsavedChanges = useCallback((): boolean => {
    // Verificar mudanças nos itens
    if (items.length !== originalItems.length) return true;
    
    for (let i = 0; i < items.length; i++) {
      const current = items[i];
      const original = originalItems.find(o => o.id === current.id);
      if (!original) return true;
      
      // Campos que são salvos apenas no "Salvar Alterações"
      if (current.production_order_number !== original.production_order_number) return true;
      if (current.deliveredQuantity !== original.deliveredQuantity) return true;
      if (current.itemCode !== original.itemCode) return true;
      if (current.itemDescription !== original.itemDescription) return true;
      if (current.requestedQuantity !== original.requestedQuantity) return true;
      if (current.unit !== original.unit) return true;
      if (current.warehouse !== original.warehouse) return true;
      if (current.deliveryDate !== original.deliveryDate) return true;
      if (current.item_status !== original.item_status) return true;
    }
    
    // Verificar mudanças no formulário
    const currentValues = getValues();
    if (currentValues.deliveryDeadline !== originalFormValues.deliveryDeadline) return true;
    if (currentValues.client !== originalFormValues.client) return true;
    if (currentValues.deskTicket !== originalFormValues.deskTicket) return true;
    if (currentValues.type !== originalFormValues.type) return true;
    if (currentValues.priority !== originalFormValues.priority) return true;
    
    return false;
  }, [items, originalItems, getValues, originalFormValues]);

  // ✨ Verificar se um campo específico foi modificado
  const isFieldModified = useCallback((itemId: string, field: string): boolean => {
    return modifiedFields.has(`${itemId}_${field}`);
  }, [modifiedFields]);

  // ✨ Interceptar tentativa de fechar o diálogo
  const handleCloseAttempt = useCallback((open: boolean) => {
    if (!open && hasUnsavedChanges()) {
      // Mostrar diálogo de confirmação
      setShowUnsavedChangesDialog(true);
    } else {
      // Fechar diretamente
      onOpenChange(open);
    }
  }, [hasUnsavedChanges, onOpenChange]);


  // ✨ Load history from database (order + items + freight changes) - OTIMIZADO COM CACHE
  const loadHistory = async () => {
    if (!order?.id) return;
    setLoadingHistory(true);
    try {
      // Carregar histórico em paralelo
      const [orderHistoryResult, itemHistoryResult, orderChangesResult] = await Promise.all([
        supabase.from('order_history').select('*').eq('order_id', order.id).order('changed_at', { ascending: false }),
        supabase.from('order_item_history').select(`*, order_items(item_code, item_description)`).eq('order_id', order.id).order('changed_at', { ascending: false }),
        supabase.from('order_changes').select('*').eq('order_id', order.id).order('changed_at', { ascending: false })
      ]);

      const orderHistory = orderHistoryResult.data || [];
      const itemHistory = itemHistoryResult.data || [];
      const orderChanges = orderChangesResult.data || [];

      // ✅ Usar cache de profiles
      const allUserIds = [
        ...(orderHistory.filter(h => h.user_id && h.user_id !== '00000000-0000-0000-0000-000000000000').map(h => h.user_id)),
        ...(itemHistory.map(h => h.user_id)),
        ...(orderChanges.map(h => h.changed_by))
      ];
      const userIds = [...new Set(allUserIds)];
      const profiles = await getProfiles(userIds);

      // Mesclar histórico com nomes de usuários
      const orderHistoryWithNames = orderHistory.map(event => {
        let userName = 'Sistema';
        if (event.user_id === '00000000-0000-0000-0000-000000000000') {
          userName = 'Sistema Laboratório';
        } else if (event.user_id) {
          const profile = profiles.find((p: any) => p.id === event.user_id);
          userName = profile?.full_name || profile?.email || 'Usuário';
        }
        return { ...event, user_name: userName, type: 'order' as const };
      });

      const itemHistoryWithNames = itemHistory.map(event => {
        const profile = profiles.find((p: any) => p.id === event.user_id);
        const userName = profile?.full_name || profile?.email || 'Usuário';
        return { ...event, user_name: userName, type: 'item' as const };
      });

      const orderChangesWithNames = orderChanges.map(event => {
        const profile = profiles.find((p: any) => p.id === event.changed_by);
        const userName = profile?.full_name || profile?.email || 'Usuário';
        return { ...event, user_name: userName, type: 'change' as const };
      });

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

  // ✨ Load comments from database - OTIMIZADO COM CACHE
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

      // ✅ Usar cache de profiles
      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      const profiles = await getProfiles(userIds);
      
      const commentsWithNames = commentsData?.map(comment => ({
        ...comment,
        user_name: profiles?.find((p: any) => p.id === comment.user_id)?.full_name || 
                   profiles?.find((p: any) => p.id === comment.user_id)?.email || 
                   'Usuário'
      })) || [];
      
      setComments(commentsWithNames);
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  // ✨ Load attachments from database - OTIMIZADO COM CACHE
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

      // ✅ Usar cache de profiles
      const userIds = [...new Set(attachmentsData?.map(a => a.uploaded_by) || [])];
      const profiles = await getProfiles(userIds);

      // Combine attachments with user profiles
      const attachmentsWithProfiles = attachmentsData?.map(attachment => ({
        ...attachment,
        profiles: profiles.find((p: any) => p.id === attachment.uploaded_by)
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
      console.log('📥 Iniciando download:', {
        filePath,
        fileName
      });
      const {
        data,
        error
      } = await supabase.storage.from('order-attachments').download(filePath);
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
      const {
        error: storageError
      } = await supabase.storage.from('order-attachments').remove([filePath]);
      if (storageError) throw storageError;

      // Delete from database
      const {
        error: dbError
      } = await supabase.from('order_attachments').delete().eq('id', attachmentId);
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Tipos aceitos
      const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

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
      const {
        data: uploadData,
        error: uploadError
      } = await supabase.storage.from('order-attachments').upload(filePath, file, {
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
      const {
        error: attachmentError
      } = await supabase.from('order_attachments').insert(attachmentData);
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const {
        error
      } = await supabase.from('order_comments').insert({
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
        freight_modality: (order as any).freight_modality,
        carrier_name: (order as any).carrier_name,
        freight_type: (order as any).freight_type,
        freight_value: (order as any).freight_value,
        tracking_code: (order as any).tracking_code,
        customer_whatsapp: (order as any).customer_whatsapp || ''
      };
      reset(orderData);

      // ✨ Armazenar valores originais do formulário
      setOriginalFormValues({
        deliveryDeadline: order.deliveryDeadline,
        deskTicket: order.deskTicket,
        client: order.client,
        type: order.type,
        priority: order.priority
      });

      // ✨ Limpar campos modificados ao abrir
      setModifiedFields(new Set());

      // Inicializar ref com valores atuais
      lastShippingRef.current = {
        freight_modality: (order as any).freight_modality ?? null,
        freight_type: (order as any).freight_type ?? null,
        carrier_name: (order as any).carrier_name ?? null,
        tracking_code: (order as any).tracking_code ?? null
      };

      // ✅ OTIMIZAÇÃO 1: Usar items já carregados se disponíveis
      if (order.items && order.items.length > 0) {
        const mappedItems = order.items.map(item => ({
          id: item.id,
          itemCode: item.itemCode,
          itemDescription: cleanItemDescription(item.itemDescription),
          unit: item.unit,
          requestedQuantity: item.requestedQuantity,
          warehouse: item.warehouse,
          deliveryDate: item.deliveryDate,
          deliveredQuantity: item.deliveredQuantity,
          received_status: item.received_status,
          item_source_type: item.item_source_type,
          item_status: item.item_status,
          production_estimated_date: item.production_estimated_date,
          is_imported: item.is_imported,
          import_lead_time_days: item.import_lead_time_days,
          sla_deadline: item.sla_deadline,
          current_phase: item.current_phase,
          phase_started_at: item.phase_started_at,
          userId: item.userId,
          purchase_action_started: item.purchase_action_started,
          production_order_number: item.production_order_number,
          purchase_action_started_at: item.purchase_action_started_at,
          purchase_action_started_by: item.purchase_action_started_by
        }));
        setItems(mappedItems);
        setOriginalItems(JSON.parse(JSON.stringify(mappedItems)));
      } else {
        // Fallback: carregar do banco se não estiver disponível
        loadItems();
      }

      setActiveTab("edit");
      setShowCommentInput(false);
      setNewComment("");
      
      // ✅ OTIMIZAÇÃO 2: Resetar abas carregadas
      setLoadedTabs(new Set(['edit']));
    }
  }, [open, order, reset]);
  
  // ✨ Derivar business_area usando função compartilhada
  const handleBusinessAreaDerivation = (senderCompany: string | undefined, costCenter: string | undefined) => {
    const businessArea = deriveBusinessAreaFromOrder(senderCompany, costCenter);
    setValue('business_area' as any, businessArea);
  };
  
  // ✨ Obter label da área de negócio
  const getBusinessAreaLabel = (area: string | null | undefined): string => {
    switch (area) {
      case 'ssm': return 'Manutenção (SSM)';
      case 'filial': return 'Filial';
      case 'projetos': return 'Projetos';
      case 'ecommerce': return 'E-commerce';
      default: return 'N/A';
    }
  };

  // Auto-save para campos de frete com debounce
  useEffect(() => {
    if (!open || !order?.id) return;
    const saveShippingField = async (key: 'freight_modality' | 'freight_type' | 'carrier_name' | 'tracking_code', value: string | null) => {
      if (!order?.id) return;
      const trimmedValue = typeof value === 'string' ? value.trim() : value;

      // Evitar saves redundantes
      if (lastShippingRef.current[key] === trimmedValue) return;
      setIsSavingShipping(true);
      try {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        // Validar tamanho para strings
        if (typeof trimmedValue === 'string' && trimmedValue.length > 100) {
          toast({
            title: 'Valor muito longo',
            description: 'O campo deve ter no máximo 100 caracteres.',
            variant: 'destructive'
          });
          return;
        }

        // Persistir na tabela orders
        const {
          error: updErr
        } = await supabase.from('orders').update({
          [key]: trimmedValue
        }).eq('id', order.id);
        if (updErr) throw updErr;

        // Registrar histórico
        const {
          error: histErr
        } = await supabase.from('order_changes').insert({
          order_id: order.id,
          changed_by: user.id,
          field_name: key,
          old_value: lastShippingRef.current[key],
          new_value: trimmedValue,
          change_type: 'update',
          change_category: 'shipping_info'
        });
        if (histErr) throw histErr;
        lastShippingRef.current[key] = trimmedValue;
        console.log(`✅ Auto-save: ${key} atualizado`);
      } catch (e: any) {
        console.error('Erro ao salvar info de frete:', e);
        toast({
          title: 'Erro ao salvar frete',
          description: e?.message || 'Tente novamente.',
          variant: 'destructive'
        });
      } finally {
        setIsSavingShipping(false);
      }
    };
    const subscription = watch((values, {
      name
    }) => {
      if (!name) return;
      if (['freight_modality', 'freight_type', 'carrier_name', 'tracking_code'].includes(name)) {
        const val = (values as any)[name] ?? null;

        // Limpar timeout anterior
        clearTimeout(saveTimers.current[name]);

        // Agendar novo save com debounce de 300ms
        saveTimers.current[name] = setTimeout(() => {
          saveShippingField(name as any, val);
        }, 300);
      }
    });
    return () => {
      subscription.unsubscribe();
      // Limpar timeouts pendentes
      Object.values(saveTimers.current).forEach(clearTimeout);
    };
  }, [open, order?.id, watch]);

  // Função reutilizável para carregar items (fallback quando não disponível no order)
  const loadItems = async () => {
    if (!order?.id) return;
    
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });
    
    const mappedItems = (itemsData || []).map(item => ({
      id: item.id,
      itemCode: item.item_code,
      itemDescription: cleanItemDescription(item.item_description),
      unit: item.unit,
      requestedQuantity: item.requested_quantity,
      warehouse: item.warehouse,
      deliveryDate: item.delivery_date,
      deliveredQuantity: item.delivered_quantity,
      received_status: item.received_status as "pending" | "partial" | "completed",
      item_source_type: item.item_source_type as "in_stock" | "production" | "out_of_stock",
      item_status: item.item_status as "pending" | "in_stock" | "awaiting_production" | "purchase_required" | "completed",
      production_estimated_date: item.production_estimated_date,
      is_imported: item.is_imported,
      import_lead_time_days: item.import_lead_time_days,
      sla_deadline: item.sla_deadline,
      current_phase: item.current_phase,
      phase_started_at: item.phase_started_at,
      userId: item.user_id,
      purchase_action_started: item.purchase_action_started,
      production_order_number: item.production_order_number,
      purchase_action_started_at: item.purchase_action_started_at,
      purchase_action_started_by: item.purchase_action_started_by
    }));
    setItems(mappedItems);
    setOriginalItems(JSON.parse(JSON.stringify(mappedItems)));
  };

  // Real-time subscription for history, comments, attachments and items updates
  useEffect(() => {
    if (!open || !order?.id) return;
    
    const historyChannel = supabase.channel(`order_history_${order.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'order_history',
      filter: `order_id=eq.${order.id}`
    }, () => {
      loadHistory();
    }).subscribe();
    
    const commentsChannel = supabase.channel(`order_comments_${order.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'order_comments',
      filter: `order_id=eq.${order.id}`
    }, () => {
      loadComments();
    }).subscribe();
    
    const attachmentsChannel = supabase.channel(`order_attachments_${order.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'order_attachments',
      filter: `order_id=eq.${order.id}`
    }, () => {
      loadAttachments();
    }).subscribe();
    
    // NOVO: Subscription para atualizar items em tempo real
    const itemsChannel = supabase.channel(`order_items_${order.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'order_items',
      filter: `order_id=eq.${order.id}`
    }, () => {
      // ✨ Ignorar se a mudança foi feita pelo próprio usuário
      if (ignoreNextRealtimeUpdateRef.current) {
        ignoreNextRealtimeUpdateRef.current = false;
        return;
      }
      console.log('🔄 Items atualizados - recarregando dados...');
      loadItems();
    }).subscribe();
    
    return () => {
      supabase.removeChannel(historyChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(attachmentsChannel);
      supabase.removeChannel(itemsChannel);
    };
  }, [open, order?.id]);

  // Limpar sessionStorage ao fechar diálogo
  useEffect(() => {
    if (!open) {
      sessionStorage.removeItem('activeTab');
      sessionStorage.removeItem('scrollToComment');
    }
  }, [open]);
  
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
    setItems(items.filter((_, i) => i !== index));
  };

  // NOVO: Registrar mudança de item no histórico
  const recordItemChange = async (itemId: string, field: 'received_status' | 'delivered_quantity' | 'item_source_type' | 'item_status' | 'warehouse' | 'purchase_action_started' | 'production_order_number', oldValue: any, newValue: any, notes?: string) => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
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
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    // ✨ Rastrear se o campo foi modificado em relação ao original
    if (oldItem.id) {
      const original = originalItems.find(o => o.id === oldItem.id);
      if (original) {
        const fieldKey = `${oldItem.id}_${field}`;
        const isModified = (original as any)[field] !== value;
        
        setModifiedFields(prev => {
          const newSet = new Set(prev);
          if (isModified) {
            newSet.add(fieldKey);
          } else {
            newSet.delete(fieldKey);
          }
          return newSet;
        });
      }
    }

    // NOVO: Detectar mudança de armazém
    if (field === 'warehouse' && oldItem.warehouse !== value && oldItem.id) {
      console.log(`📦 Armazém mudou: ${oldItem.warehouse} → ${value}`);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        // Salvar no banco
        const { error } = await supabase
          .from('order_items')
          .update({ warehouse: value })
          .eq('id', oldItem.id);
        
        if (error) throw error;

        // Registrar no histórico
        await recordItemChange(oldItem.id, 'warehouse' as any, oldItem.warehouse, value, 'Armazém alterado');

        // Registrar em order_changes também
        await supabase.from('order_changes').insert({
          order_id: order.id,
          changed_by: user.id,
          field_name: `item_warehouse_${oldItem.itemCode}`,
          old_value: oldItem.warehouse,
          new_value: value,
          change_type: 'update',
          change_category: 'item_update'
        });

        // Atualizar estado local
        setItems(newItems);

        // Mostrar aviso sobre TOTVS
        toast({
          title: "⚠️ Armazém alterado",
          description: `Armazém alterado de "${oldItem.warehouse}" para "${value}". LEMBRE-SE: Atualize o pedido no TOTVS para faturamento correto!`,
          variant: "default",
          duration: 8000, // 8 segundos para dar tempo de ler
        });

        console.log(`✅ Armazém atualizado no banco e histórico`);
        
        // Recarregar histórico
        loadHistory();
        return;
      } catch (error: any) {
        console.error('Erro ao atualizar armazém:', error);
        toast({
          title: "Erro ao atualizar armazém",
          description: error?.message || "Não foi possível salvar a alteração.",
          variant: "destructive"
        });
        return; // Não atualizar UI se falhou
      }
    }

    // Atualizar apenas o estado local para production_order_number
    // O salvamento será feito quando clicar em "Salvar Alterações"

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

      // ✨ Ignorar próximo evento realtime
      ignoreNextRealtimeUpdateRef.current = true;

      // Salvar no banco
      const {
        error
      } = await supabase.from('order_items').update({
        item_status: value
      }).eq('id', oldItem.id);
      if (error) {
        console.error('Error updating item_status:', error);
        ignoreNextRealtimeUpdateRef.current = false;
        toast({
          title: "Erro ao atualizar situação",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      await recordItemChange(oldItem.id, 'item_status', oldItem.item_status || 'in_stock', value, `Situação alterada`);
        const statusLabels = {
          in_stock: '✅ Disponível em Estoque',
          awaiting_production: '🏭 Aguardando Produção',
          purchase_required: '🛒 Solicitar Compra',
          purchase_requested: '🛒 Solicitado Compra',
          completed: '✓ Concluído'
        };
      toast({
        title: "Situação atualizada",
        description: `Item alterado para: ${statusLabels[value as keyof typeof statusLabels]}`
      });

      // 🎯 Automação: mover pedido para fase de Compras se item marcado como purchase_required
      if (value === 'purchase_required') {
        const purchaseStatuses = ['purchase_pending', 'purchase_quoted', 'purchase_ordered', 'purchase_received'];
        const currentStatus = watch('status') || order.status;
        
        if (!purchaseStatuses.includes(currentStatus)) {
          const { data: { user } } = await supabase.auth.getUser();
          
          const { error: orderError } = await supabase
            .from('orders')
            .update({ status: 'purchase_pending' })
            .eq('id', order.id);
          
          if (!orderError && user) {
            await supabase.from('order_changes').insert({
              order_id: order.id,
              changed_by: user.id,
              field_name: 'status',
              old_value: currentStatus,
              new_value: 'purchase_pending',
              change_type: 'update',
              change_category: 'phase_change'
            });
            
            setValue('status', 'purchase_pending');
            
            toast({
              title: "📦 Pedido movido para Compras",
              description: `O pedido foi movido automaticamente para a fase de Compras.`,
              duration: 5000,
            });
          }
        }
      }

      // 🎯 Automação: quando item muda para "awaiting_production", registrar data de liberação
      if (value === 'awaiting_production') {
        const { data: { user } } = await supabase.auth.getUser();
        const now = new Date().toISOString();
        
        // 1. Atualizar phase_started_at no ITEM
        await supabase.from('order_items').update({
          phase_started_at: now
        }).eq('id', oldItem.id);
        
        // 2. Verificar se pedido já tem production_released_at
        const { data: orderData } = await supabase
          .from('orders')
          .select('production_released_at')
          .eq('id', order.id)
          .single();
        
        // 3. Se não tem, definir agora (primeiro item a entrar em produção)
        if (!orderData?.production_released_at && user) {
          await supabase.from('orders').update({
            production_released: true,
            production_released_at: now,
            production_released_by: user.id
          }).eq('id', order.id);
          
          await supabase.from('order_changes').insert({
            order_id: order.id,
            changed_by: user.id,
            field_name: 'production_released',
            old_value: 'false',
            new_value: 'true',
            change_type: 'update',
            change_category: 'auto_production_release'
          });
          
          toast({
            title: "🏭 Liberado para Produção",
            description: "Data de liberação registrada automaticamente.",
            duration: 4000
          });
        }
        
        // Atualizar item local com phase_started_at
        setItems(prev => prev.map(item => 
          item.id === oldItem.id 
            ? { ...item, item_status: value as OrderItem['item_status'], phase_started_at: now }
            : item
        ));
        
        setOriginalItems(prev => prev.map(item => 
          item.id === oldItem.id 
            ? { ...item, item_status: value as OrderItem['item_status'], phase_started_at: now }
            : item
        ));
        
        return;
      }

      // ✨ Atualizar localmente em vez de recarregar do banco
      setItems(prev => prev.map(item => 
        item.id === oldItem.id 
          ? { ...item, item_status: value as OrderItem['item_status'] }
          : item
      ));
      
      setOriginalItems(prev => prev.map(item => 
        item.id === oldItem.id 
          ? { ...item, item_status: value as OrderItem['item_status'] }
          : item
      ));
      
      // Limpar campo modificado (já que foi salvo)
      setModifiedFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${oldItem.id}_item_status`);
        return newSet;
      });

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
      // ✨ Ignorar próximo evento realtime
      ignoreNextRealtimeUpdateRef.current = true;
      
      const {
        error
      } = await supabase.from('order_items').update({
        delivered_quantity: receivedQty,
        item_status: newItemStatus
      }).eq('id', itemId);
      if (error) throw error;

      // NOVO: Registrar histórico de quantidade
      if (oldQty !== receivedQty) {
        await recordItemChange(itemId, 'delivered_quantity', oldQty, receivedQty);
      }

      // NOVO: Registrar histórico de status se mudou
      if (oldItemStatus !== newItemStatus) {
        await recordItemChange(itemId, 'item_status', oldItemStatus, newItemStatus, 'Quantidade completada');
      }

      // ✨ Atualizar localmente em vez de recarregar do banco
      setItems(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, deliveredQuantity: receivedQty, item_status: newItemStatus as OrderItem['item_status'] }
          : item
      ));
      
      setOriginalItems(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, deliveredQuantity: receivedQty, item_status: newItemStatus as OrderItem['item_status'] }
          : item
      ));
      
      // Limpar campos modificados
      setModifiedFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${itemId}_deliveredQuantity`);
        newSet.delete(`${itemId}_item_status`);
        return newSet;
      });
      
      toast({
        title: newItemStatus === 'completed' ? "✅ Item concluído" : "⚠️ Recebimento parcial",
        description: newItemStatus === 'completed' ? `Item concluído: ${receivedQty} de ${requestedQty} recebidos` : `Recebimento parcial: ${receivedQty} de ${requestedQty} recebidos (faltam ${requestedQty - receivedQty})`
      });

      // Recarregar histórico
      loadHistory();
    } catch (error) {
      console.error("Error updating received quantity:", error);
      ignoreNextRealtimeUpdateRef.current = false;
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
      // ✨ Ignorar próximo evento realtime
      ignoreNextRealtimeUpdateRef.current = true;
      
      const {
        error
      } = await supabase.from('order_items').update({
        delivered_quantity: item.requestedQuantity,
        item_status: 'completed'
      }).eq('id', item.id);
      if (error) throw error;

      // Registrar no histórico
      await recordItemChange(item.id, 'item_status', item.item_status || 'in_stock', 'completed', 'Marcado como concluído');
      await recordItemChange(item.id, 'delivered_quantity', item.deliveredQuantity, item.requestedQuantity);

      // ✨ Atualizar localmente em vez de recarregar do banco
      setItems(prev => prev.map(i => 
        i.id === item.id 
          ? { ...i, deliveredQuantity: item.requestedQuantity, item_status: 'completed' as OrderItem['item_status'] }
          : i
      ));
      
      setOriginalItems(prev => prev.map(i => 
        i.id === item.id 
          ? { ...i, deliveredQuantity: item.requestedQuantity, item_status: 'completed' as OrderItem['item_status'] }
          : i
      ));
      
      // Limpar campos modificados
      setModifiedFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${item.id}_deliveredQuantity`);
        newSet.delete(`${item.id}_item_status`);
        return newSet;
      });
      
      toast({
        title: "✅ Item concluído",
        description: "Item marcado como totalmente recebido e concluído"
      });
      loadHistory();
    } catch (error) {
      console.error("Error marking as completed:", error);
      ignoreNextRealtimeUpdateRef.current = false;
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
      pending: {
        className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        label: 'Pendente',
        icon: '⏳'
      },
      partial: {
        className: 'bg-blue-100 text-blue-800 border-blue-300',
        label: 'Parcial',
        icon: '📦'
      },
      completed: {
        className: 'bg-green-100 text-green-800 border-green-300',
        label: 'Completo',
        icon: '✓'
      }
    };
    const config = variants[actualStatus as keyof typeof variants] || variants.pending;
    return <Badge className={config.className} variant="outline">
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </Badge>;
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
      const pending = items.filter(item => item.received_status !== 'completed' && item.received_status !== undefined || item.deliveredQuantity < item.requestedQuantity);
      if (pending.length > 0) {
        setPendingCompletionStatus(newStatus);
        setShowCompleteDialog(true);
        setIsChangingStatus(false);
        return;
      }
    }

    // Salvar imediatamente no banco de dados
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const oldStatus = order.status;

      // Detectar mudança para fase "Gerar Ordem"
      const orderGenerationStatuses = ['order_generation_pending', 'order_in_creation', 'order_generated'];
      const isMovingToOrderGeneration = orderGenerationStatuses.includes(newStatus);
      let updateData: any = {
        status: newStatus
      };

      // Se está mudando para fase "Gerar Ordem", calcular novo prazo baseado no SLA
      if (isMovingToOrderGeneration) {
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

          // Também atualizar no formulário
          setValue("deliveryDeadline", updateData.delivery_date);
          console.log(`📅 Calculando prazo: hoje + ${orderTypeConfig.default_sla_days} dias = ${updateData.delivery_date}`);
        }
      }

      // Atualizar status no banco
      const {
        error: updateError
      } = await supabase.from('orders').update(updateData).eq('id', order.id);
      if (updateError) throw updateError;

      // Registrar no histórico
      const {
        error: historyError
      } = await supabase.from('order_history').insert({
        order_id: order.id,
        user_id: user.id,
        old_status: oldStatus,
        new_status: newStatus
      });
      if (historyError) console.error('Erro ao registrar histórico:', historyError);

      // Atualizar o formulário
      setValue("status", newStatus as any, {
        shouldDirty: false,
        shouldTouch: false
      });

      // Atualizar o pedido no estado do componente pai
      const updatedOrder = {
        ...order,
        status: newStatus as any
      };
      if (updateData.delivery_date) {
        updatedOrder.deliveryDeadline = updateData.delivery_date;
      }
      onSave(updatedOrder);
      const description = isMovingToOrderGeneration && updateData.delivery_date ? `Pedido agora está: ${getStatusLabel(newStatus)} - Prazo calculado automaticamente` : `Pedido agora está: ${getStatusLabel(newStatus)}`;
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
        variant: "destructive"
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
          const {
            data: {
              user
            }
          } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");
          const pending = items.filter(item => item.received_status !== 'completed' && item.received_status !== undefined || item.deliveredQuantity < item.requestedQuantity);
          const {
            error
          } = await supabase.from('order_completion_notes').insert({
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Format the comment with structured information
      const formattedComment = `🚨 EXCEÇÃO REGISTRADA\n\n📋 Descrição:\n${comment}\n\n👤 Responsável: ${responsible}\n\n⏰ Registrado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`;

      // Insert comment in order_comments table
      const {
        error: commentError
      } = await supabase.from('order_comments').insert({
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
    const blob = new Blob([summary], {
      type: 'text/plain;charset=utf-8'
    });
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
      // 1. Buscar IDs dos itens do pedido para excluir tabelas relacionadas
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', order.id);
      
      if (orderItems && orderItems.length > 0) {
        const itemIds = orderItems.map(i => i.id);
        
        // Excluir trabalhos de laboratório dos itens
        await supabase.from('lab_item_work').delete().in('order_item_id', itemIds);
        
        // Excluir histórico de itens
        await supabase.from('order_item_history').delete().in('order_item_id', itemIds);
      }
      
      // 2. Excluir itens do pedido
      await supabase.from('order_items').delete().eq('order_id', order.id);

      // 3. Buscar IDs das cotações para excluir respostas
      const { data: quotes } = await supabase
        .from('freight_quotes')
        .select('id')
        .eq('order_id', order.id);
      
      if (quotes && quotes.length > 0) {
        const quoteIds = quotes.map(q => q.id);
        // Excluir respostas das cotações
        await supabase.from('freight_quote_responses').delete().in('quote_id', quoteIds);
      }
      
      // 4. Excluir cotações de frete
      await supabase.from('freight_quotes').delete().eq('order_id', order.id);

      // 5. Excluir conversas com transportadoras
      await supabase.from('carrier_conversations').delete().eq('order_id', order.id);

      // 6. Excluir volumes do pedido
      await supabase.from('order_volumes').delete().eq('order_id', order.id);

      // 7. Excluir movimentações de estoque
      await supabase.from('stock_movements').delete().eq('order_id', order.id);

      // 8. Excluir menções
      await supabase.from('mention_tags').delete().eq('order_id', order.id);

      // 9. Excluir alterações do pedido
      await supabase.from('order_changes').delete().eq('order_id', order.id);

      // 10. Excluir anexos do storage e da tabela
      if (attachments.length > 0) {
        // Excluir arquivos do storage
        const filePaths = attachments.map(a => a.file_path);
        await supabase.storage.from('order-attachments').remove(filePaths);

        // Excluir registros da tabela
        await supabase.from('order_attachments').delete().eq('order_id', order.id);
      }

      // 11. Excluir comentários
      await supabase.from('order_comments').delete().eq('order_id', order.id);

      // 12. Excluir histórico
      await supabase.from('order_history').delete().eq('order_id', order.id);

      // 13. Excluir notas de conclusão
      await supabase.from('order_completion_notes').delete().eq('order_id', order.id);

      // 14. Excluir mudanças de data
      await supabase.from('delivery_date_changes').delete().eq('order_id', order.id);

      // 15. Finalmente, excluir o pedido
      const {
        error: orderError
      } = await supabase.from('orders').delete().eq('id', order.id);
      if (orderError) throw orderError;
      
      toast({
        title: "Pedido excluído",
        description: `Pedido ${order.orderNumber} foi excluído com sucesso.`
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
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };
  
  const onSubmit = async (data: Order) => {
    console.log('💾 [INICIO] Salvando pedido com dados:', data);
    try {
      // ✨ Sincronizar dimensões e volumes da tabela order_volumes
      const { data: volumes } = await supabase
        .from('order_volumes')
        .select('*')
        .eq('order_id', order.id);

      if (volumes && volumes.length > 0) {
        const total_volumes = volumes.reduce((sum, vol) => sum + vol.quantity, 0);
        const total_weight_kg = volumes.reduce((sum, vol) => sum + (vol.weight_kg * vol.quantity), 0);
        
        // Atualizar campos resumidos automaticamente
        data.package_volumes = total_volumes;
        data.package_weight_kg = total_weight_kg;
        
        // Dimensões: pegar do primeiro volume (para compatibilidade)
        if (volumes[0]) {
          data.package_length_m = volumes[0].length_cm / 100;
          data.package_width_m = volumes[0].width_cm / 100;
          data.package_height_m = volumes[0].height_cm / 100;
        }
        console.log('✅ Totais calculados dos volumes:', { total_volumes, total_weight_kg });
      }

      const updatedOrder = {
        ...data,
        id: order.id,
        items,
        business_unit: watch('business_unit' as any) || (order as any).business_unit,
        business_area: watch('business_area' as any) || (order as any).business_area,
        cost_center: watch('cost_center' as any) || (order as any).cost_center,
        account_item: watch('account_item' as any) || (order as any).account_item,
        sender_company: watch('sender_company' as any) || (order as any).sender_company
      };

      // ✨ Track ALL field changes for complete history
      try {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (user) {
          const fieldsToTrack = [{
            key: 'freight_modality',
            label: 'Modalidade de Frete',
            category: 'shipping_info'
          }, {
            key: 'freight_type',
            label: 'Tipo de Frete',
            category: 'shipping_info'
          }, {
            key: 'carrier_name',
            label: 'Transportadora',
            category: 'shipping_info'
          }, {
            key: 'tracking_code',
            label: 'Código de Rastreio',
            category: 'shipping_info'
          }];
          const changes: Array<{
            field_name: string;
            old_value: string | null;
            new_value: string | null;
            category: string;
          }> = [];
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
      
      // ✨ Limpar campos modificados após salvar com sucesso
      setModifiedFields(new Set());
      setOriginalItems(JSON.parse(JSON.stringify(items)));
      setOriginalFormValues({
        deliveryDeadline: data.deliveryDeadline,
        deskTicket: data.deskTicket,
        client: data.client,
        type: data.type,
        priority: data.priority
      });
      
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
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
      const {
        error: changeError
      } = await supabase.from('delivery_date_changes').insert({
        order_id: order.id,
        order_item_id: null,
        // Mudança do pedido completo, não de item
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Inserir diretamente na tabela delivery_date_changes
      const {
        error
      } = await supabase.from('delivery_date_changes').insert({
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
      const {
        error: updateError
      } = await supabase.from('order_items').update({
        delivery_date: pendingItemDateChange.newDate
      }).eq('id', pendingItemDateChange.itemId);
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
  return <>
      <Dialog open={open} onOpenChange={handleCloseAttempt}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-4">
          <DialogHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Pedido #{order?.orderNumber}</DialogTitle>
                <DialogDescription>
                  Visualize e edite os detalhes do pedido ou acompanhe seu histórico de movimentações
                </DialogDescription>
              </div>
              <Button variant="outline" size="sm" onClick={downloadOrderSummary} className="gap-2">
                <Download className="h-4 w-4" />
                Baixar Resumo
              </Button>
            </div>
          </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-8 h-9">
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
            <TabsTrigger value="volumes" className="flex items-center gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-white text-xs">
              <Package className="h-3.5 w-3.5" />
              Volumes
            </TabsTrigger>
            <TabsTrigger value="carriers" className="flex items-center gap-1.5 data-[state=active]:bg-teal-500 data-[state=active]:text-white text-xs">
              <Send className="h-3.5 w-3.5" />
              Transportadoras
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
              {attachments.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{attachments.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-3">
            <ScrollArea className="h-[calc(95vh-200px)] pr-3">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="type">Tipo de Pedido</Label>
                    <Controller name="type" control={control} render={({
                      field
                    }) => <OrderTypeSelector value={field.value} onValueChange={field.onChange} />} />
                  </div>
                  <div>
                    <Label htmlFor="priority">Prioridade</Label>
                    <Select onValueChange={value => setValue("priority", value as any)} defaultValue={order?.priority}>
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

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="client">Cliente</Label>
                    <Input {...register("client", {
                      required: true
                    })} />
                  </div>
                  <div>
                    <Label htmlFor="customer_whatsapp" className="flex items-center gap-1">
                      📱 WhatsApp do Cliente
                    </Label>
                    <Input 
                      {...register("customer_whatsapp" as any)} 
                      placeholder="51999999999"
                      maxLength={20}
                      type="tel"
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Para notificações automáticas
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="deskTicket">Nº Chamado Desk</Label>
                    <Input {...register("deskTicket", {
                      required: true
                    })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="totvsOrderNumber">Nº Pedido TOTVS</Label>
                    <Input {...register("totvsOrderNumber" as any)} placeholder="Ex: 123456" maxLength={50} />
                  </div>
                  {order.issueDate && <div>
                      <Label htmlFor="issueDate">Data de Emissão (TOTVS)</Label>
                      <Input type="date" value={order.issueDate ? format(new Date(order.issueDate), 'yyyy-MM-dd') : ''} disabled className="bg-muted cursor-not-allowed" />
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Data original do pedido (não editável)
                      </p>
                    </div>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="deliveryDeadline">Prazo de Entrega</Label>
                    <Input {...register("deliveryDeadline", {
                      required: true
                    })} type="date" />
                  </div>
                </div>

                {/* Seção Empresa Emissora + RATEIO */}
                <Card className="p-4 border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
                  {/* Empresa Emissora */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">Empresa Emissora</h4>
                    </div>
                    <Select 
                      value={(watch('sender_company' as any) || '')} 
                      onValueChange={(value) => {
                        const newValue = value === 'none' ? '' : value;
                        setValue('sender_company' as any, newValue);
                        // Derivar business_area automaticamente baseado na empresa + centro de custo
                        handleBusinessAreaDerivation(newValue, watch('cost_center' as any) || '');
                      }}
                    >
                      <SelectTrigger className="bg-white dark:bg-slate-900">
                        <SelectValue placeholder="Selecionar empresa..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {SENDER_OPTIONS.map(sender => (
                          <SelectItem key={sender.id} value={sender.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{sender.shortName}</span>
                              <span className="text-xs text-muted-foreground">({sender.state})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {watch('sender_company' as any) && (
                      <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                        {(() => {
                          const sender = SENDER_OPTIONS.find(s => s.id === watch('sender_company' as any));
                          return sender ? (
                            <div className="space-y-0.5">
                              <p className="font-medium">{sender.name}</p>
                              <p>CNPJ: {sender.cnpj}</p>
                              <p className="line-clamp-1">{sender.address}</p>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-blue-200 dark:border-blue-800 my-3" />

                  {/* RATEIO */}
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">RATEIO</h4>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {/* BU (Business Unit) */}
                    <div>
                      <Label className="text-xs text-muted-foreground">BU (Business Unit)</Label>
                      <Select 
                        value={watch('business_unit' as any) || ''} 
                        onValueChange={(value) => setValue('business_unit' as any, value === 'none' ? '' : value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecionar BU..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          <SelectItem value="Autoatendimento">Autoatendimento</SelectItem>
                          <SelectItem value="Bowling">Bowling</SelectItem>
                          <SelectItem value="Eleventickets">Eleventickets</SelectItem>
                          <SelectItem value="Painéis">Painéis</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Centro de Custo */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Centro de Custo</Label>
                      <Select 
                        value={watch('cost_center' as any) || ''} 
                        onValueChange={(value) => {
                          const newValue = value === 'none' ? '' : value;
                          setValue('cost_center' as any, newValue);
                          // Derivar business_area automaticamente baseado na empresa + centro de custo
                          handleBusinessAreaDerivation(watch('sender_company' as any) || '', newValue);
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecionar Centro..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {COST_CENTERS.map(cc => (
                            <SelectItem key={cc.code} value={cc.name}>
                              {cc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Projeto (Item Conta) */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Projeto (Item Conta)</Label>
                      <Input 
                        className="mt-1"
                        placeholder="Informe o projeto..."
                        {...register('account_item' as any)}
                      />
                    </div>
                  </div>
                </Card>

                <div className="pt-3 border-t">
                  <Label className="text-sm font-medium mb-2 block">Status do Pedido</Label>
                  <PhaseButtons order={{
                    ...order,
                    status: getValues("status") || order.status
                  }} onStatusChange={(orderId, newStatus) => handleStatusChange(newStatus)} />
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

                  {items.length === 0 ? <Card className="p-4 text-center text-muted-foreground text-sm">
                      Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                    </Card> : <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">
                              <div className="flex items-center gap-1.5">
                                <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                <span>Código</span>
                              </div>
                            </TableHead>
                            <TableHead className="min-w-[200px]">
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5" />
                                <span>Descrição</span>
                              </div>
                            </TableHead>
                            <TableHead className="w-[80px]">UND</TableHead>
                            <TableHead className="w-[100px]">Qtd. Sol.</TableHead>
                            <TableHead className="w-[100px]">
                              <div className="flex items-center gap-1.5">
                                <Package className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                                <span>Armazém</span>
                              </div>
                            </TableHead>
                            <TableHead className="w-[140px]">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                <span>Data Entrega</span>
                              </div>
                            </TableHead>
                            <TableHead className="w-[120px]">
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                <span>Nº Ordem</span>
                              </div>
                            </TableHead>
                            <TableHead className="w-[180px]">Situação</TableHead>
                            <TableHead className="w-[140px]">Compra/Import.</TableHead>
                            <TableHead className="w-[120px]">Qtd. Recebida</TableHead>
                            <TableHead className="w-[100px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item, index) => <TableRow key={index} data-status={item.item_status} className={`
                                transition-colors
                                ${item.item_status === 'completed' ? 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-900/30' : item.deliveredQuantity > 0 && item.deliveredQuantity < item.requestedQuantity ? 'bg-yellow-50 dark:bg-yellow-950/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 border-l-4 border-l-yellow-500' : 'hover:bg-muted/50'}
                                ${item.deliveredQuantity >= item.requestedQuantity && item.deliveredQuantity > 0 ? 'border-l-4 border-l-green-500' : ''}
                              `}>
                              <TableCell>
                                <Input 
                                  value={item.itemCode} 
                                  onChange={e => updateItem(index, "itemCode", e.target.value)} 
                                  placeholder="ITEM-001" 
                                  className="h-8 text-sm font-mono bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 focus-visible:ring-blue-400" 
                                />
                              </TableCell>
                              <TableCell>
                                <Input 
                                  value={item.itemDescription} 
                                  onChange={e => updateItem(index, "itemDescription", e.target.value)} 
                                  placeholder="Descrição" 
                                  className="h-8 text-sm bg-background/80 dark:bg-muted/40" 
                                />
                              </TableCell>
                              <TableCell>
                                <Input 
                                  value={item.unit} 
                                  onChange={e => updateItem(index, "unit", e.target.value)} 
                                  placeholder="UND" 
                                  className="h-8 text-sm bg-background/80 dark:bg-muted/40" 
                                />
                              </TableCell>
                              <TableCell>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  value={item.requestedQuantity} 
                                  onChange={e => updateItem(index, "requestedQuantity", parseFloat(e.target.value) || 0)} 
                                  min="0" 
                                  className="h-8 text-sm bg-background/80 dark:bg-muted/40" 
                                />
                              </TableCell>
                              <TableCell className="p-1">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                                  <Input 
                                    value={item.warehouse} 
                                    onChange={e => updateItem(index, "warehouse", e.target.value)} 
                                    placeholder="Armazém" 
                                    className="h-8 text-sm bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800 focus-visible:ring-teal-400" 
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input 
                                  type="date" 
                                  value={item.deliveryDate} 
                                  onChange={e => updateItem(index, "deliveryDate", e.target.value)} 
                                  className="h-8 text-sm bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 focus-visible:ring-purple-400" 
                                />
                              </TableCell>
                              <TableCell>
                                <div className="relative">
                                  {/* Label dinâmica baseada no status */}
                                  {(item.item_status === 'purchase_required' || item.item_status === 'purchase_requested') && (
                                    <div className="flex items-center gap-1 mb-1">
                                      <ShoppingCart className="h-3 w-3 text-orange-500" />
                                      <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">O.C</span>
                                    </div>
                                  )}
                                  {item.item_status === 'awaiting_production' && (
                                    <div className="flex items-center gap-1 mb-1">
                                      <Factory className="h-3 w-3 text-blue-500" />
                                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">O.P</span>
                                    </div>
                                  )}
                                  <Input 
                                    value={item.production_order_number || ''} 
                                    onChange={e => updateItem(index, "production_order_number", e.target.value)} 
                                    placeholder={
                                      (item.item_status === 'purchase_required' || item.item_status === 'purchase_requested') 
                                        ? "OC-000" 
                                        : "OP-000"
                                    }
                                    className={cn(
                                      "h-8 text-sm font-mono",
                                      (item.item_status === 'purchase_required' || item.item_status === 'purchase_requested')
                                        ? "bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800 focus-visible:ring-orange-400"
                                        : item.item_status === 'awaiting_production'
                                        ? "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 focus-visible:ring-blue-400"
                                        : "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 focus-visible:ring-amber-400",
                                      item.id && isFieldModified(item.id, 'production_order_number') && "ring-2 ring-orange-400 border-orange-400"
                                    )}
                                  />
                                  {item.id && isFieldModified(item.id, 'production_order_number') && (
                                    <span 
                                      className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" 
                                      title="Campo modificado - não salvo" 
                                    />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select value={item.item_status || 'in_stock'} onValueChange={(value: 'pending' | 'in_stock' | 'awaiting_production' | 'purchase_required' | 'purchase_requested' | 'completed') => updateItem(index, "item_status", value)}>
                                  <SelectTrigger className={`h-8 text-sm ${
                                    item.item_status === 'completed' ? 'bg-green-100 dark:bg-green-900/50 border-green-400 text-green-900 dark:text-green-100' :
                                    item.item_status === 'purchase_required' || item.item_status === 'purchase_requested' ? 'bg-orange-100 dark:bg-orange-900/50 border-orange-400 text-orange-900 dark:text-orange-100' :
                                    item.item_status === 'awaiting_production' ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 text-blue-900 dark:text-blue-100' :
                                    'bg-muted/50'
                                  }`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">⏳ Pendente</SelectItem>
                                    <SelectItem value="in_stock">✅ Disponível em Estoque</SelectItem>
                                    <SelectItem value="awaiting_production">🏭 Aguardando Produção</SelectItem>
                                    <SelectItem value="purchase_required">🛒 Solicitar Compra</SelectItem>
                                    <SelectItem value="purchase_requested">🛒 Solicitado Compra</SelectItem>
                                    <SelectItem value="completed">✓ Concluído</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1.5">
                                  {/* Checkbox para confirmar andamento na compra */}
                                  <div className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/50 transition-colors">
                                    <Checkbox
                                      id={`purchase-${index}`}
                                      checked={item.purchase_action_started || false}
                                      onCheckedChange={async (checked) => {
                                        // Garantir que checked é boolean
                                        const isChecked = checked === true;
                                        
                                        if (item.id) {
                                          try {
                                            const { data: { user } } = await supabase.auth.getUser();
                                            if (!user) throw new Error('Usuário não autenticado');

                                            // Atualizar no banco
                                            const { error } = await supabase
                                              .from('order_items')
                                              .update({
                                                purchase_action_started: isChecked,
                                                purchase_action_started_at: isChecked ? new Date().toISOString() : null,
                                                purchase_action_started_by: isChecked ? user.id : null,
                                                item_status: isChecked ? 'purchase_requested' : 'purchase_required'
                                              })
                                              .eq('id', item.id);

                                            if (error) throw error;

                                            // Registrar no histórico
                                            await recordItemChange(
                                              item.id,
                                              'purchase_action_started',
                                              item.purchase_action_started ? 'true' : 'false',
                                              isChecked ? 'true' : 'false',
                                              isChecked ? 'Compra iniciada' : 'Compra desmarcada'
                                            );

                                            // Atualizar estado local
                                            updateItem(index, "purchase_action_started", isChecked);
                                            updateItem(index, "item_status", isChecked ? 'purchase_requested' : 'purchase_required');

                                            // Invalidar cache do React Query para atualizar a página de Produção
                                            await queryClient.invalidateQueries({ queryKey: ['production-items'] });

                                            toast({
                                              title: isChecked ? "Compra iniciada" : "Compra desmarcada",
                                              description: isChecked 
                                                ? "Status atualizado para 'Solicitado Compra'" 
                                                : "Status voltou para 'Solicitar Compra'",
                                              duration: 3000
                                            });

                                            // Recarregar itens e histórico
                                            await loadItems();
                                            loadHistory();
                                          } catch (error: any) {
                                            console.error('Erro ao atualizar compra:', error);
                                            // Reverter estado local em caso de erro
                                            updateItem(index, "purchase_action_started", !isChecked);
                                            toast({
                                              title: "Erro ao atualizar",
                                              description: error.message || "Não foi possível atualizar o status da compra",
                                              variant: "destructive"
                                            });
                                          }
                                        } else {
                                          // Se item não foi salvo ainda, apenas atualiza localmente
                                          updateItem(index, "purchase_action_started", isChecked);
                                          updateItem(index, "item_status", isChecked ? 'purchase_requested' : 'purchase_required');
                                        }
                                      }}
                                      className="h-4 w-4"
                                      disabled={!item.id}
                                    />
                                    <Label 
                                      htmlFor={`purchase-${index}`} 
                                      className={`text-xs cursor-pointer select-none ${
                                        item.purchase_action_started 
                                          ? 'text-green-600 dark:text-green-400 font-semibold' 
                                          : 'text-muted-foreground'
                                      }`}
                                    >
                                      {item.purchase_action_started ? '✓ Compra OK' : 'Iniciar compra'}
                                    </Label>
                                  </div>

                                  {/* Divider visual se houver campos de importação */}
                                  {item.item_source_type === 'out_of_stock' && (
                                    <div className="border-t border-muted my-0.5" />
                                  )}

                                  {/* Campos de importação (só aparecem para out_of_stock) */}
                                  {item.item_source_type === 'out_of_stock' && (
                                    <>
                                      <Select 
                                        value={item.is_imported ? 'yes' : 'no'} 
                                        onValueChange={value => {
                                          updateItem(index, "is_imported", value === 'yes');
                                          if (value === 'no') {
                                            updateItem(index, "import_lead_time_days", null);
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="no">🇧🇷 Nacional</SelectItem>
                                          <SelectItem value="yes">🌍 Importado</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      
                                      {item.is_imported && (
                                        <Input
                                          type="number"
                                          value={item.import_lead_time_days || ''}
                                          onChange={e => updateItem(index, "import_lead_time_days", parseInt(e.target.value) || null)}
                                          placeholder="Prazo (dias)"
                                          className="h-7 text-xs"
                                          title="Prazo de importação em dias"
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-0.5">
                                  <div className="relative">
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      value={item.deliveredQuantity} 
                                      onChange={e => {
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
                                      onBlur={e => {
                                        // Validar ao sair do campo
                                        if (!item.id) {
                                          const newQty = Math.max(0, Math.min(parseFloat(e.target.value) || 0, item.requestedQuantity));
                                          updateItem(index, "deliveredQuantity", newQty);
                                        }
                                      }} 
                                      min="0" 
                                      max={item.requestedQuantity} 
                                      className={cn(
                                        "h-8 text-sm bg-background/80 dark:bg-muted/40",
                                        item.id && isFieldModified(item.id, 'deliveredQuantity') && "ring-2 ring-orange-400 border-orange-400"
                                      )}
                                      placeholder="0" 
                                    />
                                    {item.id && isFieldModified(item.id, 'deliveredQuantity') && (
                                      <span 
                                        className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" 
                                        title="Campo modificado - não salvo" 
                                      />
                                    )}
                                  </div>
                                  {item.requestedQuantity > 0 && (
                                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                                      <div 
                                        className={`h-full transition-all ${
                                          item.deliveredQuantity >= item.requestedQuantity ? 'bg-green-500' :
                                          item.deliveredQuantity > 0 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${Math.min(100, (item.deliveredQuantity / item.requestedQuantity) * 100)}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button type="button" variant="outline" size="sm" onClick={() => handleMarkAsCompleted(item)} disabled={!item.id || item.item_status === 'completed'} className="h-8 gap-1 text-green-700 border-green-300 hover:bg-green-50" title="Marcar como totalmente recebido e concluído">
                                    <CheckCircle className="h-3 w-3" />
                                    OK
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>)}
                        </TableBody>
                      </Table>
                    </div>}
                </div>

                <div className="flex justify-between items-center gap-2 pt-3 sticky bottom-0 bg-background">
                  <Button type="button" variant="destructive" size="default" onClick={() => setShowDeleteConfirm(true)} className="gap-2 px-6 py-2 text-base">
                    <Trash2 className="h-5 w-5" />
                    Excluir Pedido
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="default" onClick={() => handleCloseAttempt(false)} className="px-6 py-2 text-base">
                      Cancelar
                    </Button>
                    <Button type="submit" size="default" className="gap-2 px-6 py-2 text-base">
                      <Save className="h-5 w-5" />
                      {modifiedFields.size > 0 && (
                        <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200">
                          {modifiedFields.size}
                        </Badge>
                      )}
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
            <ScrollArea className="h-[calc(95vh-200px)] pr-4">
              <div className="space-y-4">
                {/* Seção de Configuração de Firmware/Imagem */}
                <Card className="p-4 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <Settings className="h-5 w-5" />
                    Configuração de Firmware e Imagem
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Firmware Card */}
                    <Card className="p-4 space-y-3 bg-blue-50 dark:bg-blue-950 border-blue-200">
                      <div className="flex items-center space-x-2">
                        <Controller
                          name="requires_firmware"
                          control={control}
                          render={({ field }) => (
                            <Checkbox
                              id="lab_requires_firmware"
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                        <Label htmlFor="lab_requires_firmware" className="font-semibold cursor-pointer">
                          🔧 Requer Firmware Específico
                        </Label>
                      </div>
                      <div>
                        <Label htmlFor="firmware_project_name">Nome do Projeto/Firmware</Label>
                        <Input
                          id="firmware_project_name"
                          {...register("firmware_project_name")}
                          placeholder="Ex: FW_PLACA_V2.3.1"
                          maxLength={200}
                        />
                      </div>
                    </Card>

                    {/* Imagem Card */}
                    <Card className="p-4 space-y-3 bg-purple-50 dark:bg-purple-950 border-purple-200">
                      <div className="flex items-center space-x-2">
                        <Controller
                          name="requires_image"
                          control={control}
                          render={({ field }) => (
                            <Checkbox
                              id="lab_requires_image"
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                        <Label htmlFor="lab_requires_image" className="font-semibold cursor-pointer">
                          💾 Requer Imagem Específica
                        </Label>
                      </div>
                      <div>
                        <Label htmlFor="image_project_name">Nome da Imagem</Label>
                        <Input
                          id="image_project_name"
                          {...register("image_project_name")}
                          placeholder="Ex: IMG_LINUX_2024_Q1"
                          maxLength={200}
                        />
                      </div>
                    </Card>
                  </div>
                </Card>

                {/* Componente LabWorkView */}
                <LabWorkView
                  orderId={order.id}
                  items={items}
                  requiresFirmware={watch("requires_firmware") || false}
                  firmwareProjectName={watch("firmware_project_name")}
                  requiresImage={watch("requires_image") || false}
                  imageProjectName={watch("image_project_name")}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="volumes" className="mt-4">
            <ScrollArea className="h-[calc(95vh-200px)] pr-4">
              <VolumeManager orderId={order.id} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="carriers" className="mt-4">
            <ScrollArea className="h-[calc(95vh-200px)] pr-4">
            <CarriersTabContent 
              order={order}
              freightModality={watch("freight_modality") || ""}
              freightType={watch("freight_type") || ""}
              carrierName={watch("carrier_name") || ""}
              trackingCode={watch("tracking_code") || ""}
              onFreightChange={(field, value) => {
                setValue(field as any, value);
                // Marcar como modificado
                setModifiedFields(prev => new Set(prev).add(field));
              }}
              isSaving={isSavingShipping}
            />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[calc(100vh-240px)]">
              <EnhancedOrderTimeline orderId={order.id} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            <ScrollArea className="h-[calc(95vh-240px)]">
              <OrderComments orderId={order.id} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="attachments" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Anexos do Pedido</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{attachments.length} arquivo(s)</Badge>
                  <Button size="sm" onClick={() => document.getElementById('attachment-upload')?.click()} disabled={uploadingAttachment} className="gap-2">
                    {uploadingAttachment ? <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </> : <>
                        <Plus className="h-4 w-4" />
                        Anexar Arquivo
                      </>}
                  </Button>
                  <input id="attachment-upload" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleUploadAttachment(file);
                      e.target.value = '';
                    }
                  }} />
                </div>
              </div>

              {loadingAttachments ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : attachments.length === 0 ? <Card className="p-6 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum anexo encontrado</p>
                </Card> : <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {attachments.map(attachment => {
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
                      const {
                        data
                      } = supabase.storage.from('order-attachments').getPublicUrl(filePath);
                      return data.publicUrl;
                    };
                    return <Card key={attachment.id} className="p-4">
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
                                {isImage && <div className="mt-3">
                                    <img src={getImageUrl(attachment.file_path)} alt={attachment.file_name} className="max-w-full h-auto rounded border max-h-64 object-contain" />
                                  </div>}
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(attachment.file_path, attachment.file_name)} className="gap-2">
                                <Download className="h-4 w-4" />
                                Baixar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteAttachment(attachment.id, attachment.file_path, attachment.file_name)} className="gap-2">
                                <Trash2 className="h-4 w-4" />
                                Excluir
                              </Button>
                            </div>
                          </div>
                        </Card>;
                  })}
                  </div>
                </ScrollArea>}
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
              <select value={dateChangeCategory} onChange={e => {
              setDateChangeCategory(e.target.value);
              setFactoryFollowupRequired(e.target.value === 'factory_delay');
            }} className="w-full mt-1 px-3 py-2 border rounded-md bg-background">
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
              <Textarea value={dateChangeReason} onChange={e => setDateChangeReason(e.target.value)} placeholder="Contexto adicional sobre a mudança..." rows={3} />
            </div>
            
            {dateChangeCategory === 'factory_delay' && <div className="flex items-center space-x-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                <Checkbox id="followup" checked={factoryFollowupRequired} onCheckedChange={checked => setFactoryFollowupRequired(checked as boolean)} />
                <Label htmlFor="followup" className="text-sm font-normal cursor-pointer">
                  Requer cobrança de prazo com a fábrica
                </Label>
              </div>}
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

      <CompleteOrderDialog pendingItems={items.filter(item => item.received_status !== 'completed' && item.received_status !== undefined || item.deliveredQuantity < item.requestedQuantity)} open={showCompleteDialog} onConfirm={handleConfirmCompletion} onCancel={() => {
      setShowCompleteDialog(false);
      setPendingCompletionStatus(null);
    }} />

      <ExceptionCommentDialog open={showExceptionDialog} onConfirm={handleConfirmException} onCancel={() => {
      setShowExceptionDialog(false);
      setPendingExceptionStatus(null);
    }} saving={savingException} />
      
      <ConfirmationDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm} title="Excluir Pedido" description={`Tem certeza que deseja excluir o pedido ${order?.orderNumber}? Esta ação é irreversível e excluirá o pedido e todos os seus itens, comentários, anexos e histórico do sistema.`} onConfirm={handleDelete} variant="destructive" confirmText={deleting ? "Excluindo..." : "Sim, excluir"} cancelText="Cancelar" />

      {/* Diálogo de Alterações Não Salvas */}
      <AlertDialog open={showUnsavedChangesDialog} onOpenChange={setShowUnsavedChangesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem {modifiedFields.size} alteração(ões) pendente(s) que ainda não foram salvas. O que deseja fazer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:justify-between">
            <AlertDialogCancel onClick={() => setShowUnsavedChangesDialog(false)}>
              Cancelar
            </AlertDialogCancel>
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={() => {
                  setShowUnsavedChangesDialog(false);
                  setItems(originalItems);
                  reset(originalFormValues);
                  setModifiedFields(new Set());
                  onOpenChange(false);
                }}
              >
                Descartar
              </Button>
              <Button 
                onClick={() => {
                  setShowUnsavedChangesDialog(false);
                  handleSubmit(onSubmit)();
                }}
              >
                Salvar e Fechar
              </Button>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <select value={dateChangeCategory} onChange={e => {
              setDateChangeCategory(e.target.value);
              setFactoryFollowupRequired(e.target.value === 'factory_delay');
            }} className="w-full mt-1 px-3 py-2 border rounded-md bg-background">
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
              <Textarea value={dateChangeReason} onChange={e => setDateChangeReason(e.target.value)} placeholder="Contexto adicional sobre a mudança..." rows={3} />
            </div>
            
            {dateChangeCategory === 'factory_delay' && <div className="flex items-center space-x-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                <Checkbox id="item-followup" checked={factoryFollowupRequired} onCheckedChange={checked => setFactoryFollowupRequired(checked as boolean)} />
                <Label htmlFor="item-followup" className="text-sm font-normal cursor-pointer">
                  Requer cobrança de prazo com a fábrica
                </Label>
              </div>}
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
    </>;
};