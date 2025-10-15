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
import { Calendar, User, FileText, CheckCircle, XCircle, Clock, History, Edit, Plus, Trash2, Loader2, MessageSquare, Download, Package, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { Order } from "./Dashboard";
import { OrderItem } from "./AddOrderDialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { CompleteOrderDialog } from "./CompleteOrderDialog";
import { ExceptionCommentDialog } from "./ExceptionCommentDialog";
import { PhaseButtons } from "./PhaseButtons";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface HistoryEvent {
  id: string;
  changed_at: string;
  old_status: string;
  new_status: string;
  user_id: string;
  user_name?: string;
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
  const { register, handleSubmit, setValue, reset } = useForm<Order>();
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

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, [open]);

  // Load history from database
  const loadHistory = async () => {
    if (!order?.id) return;
    
    setLoadingHistory(true);
    try {
      const { data: historyData, error } = await supabase
        .from('order_history')
        .select('*')
        .eq('order_id', order.id)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      // Load user profiles for history events
      const userIds = [...new Set(
        historyData
          ?.filter(h => h.user_id && h.user_id !== '00000000-0000-0000-0000-000000000000')
          ?.map(h => h.user_id) || []
      )];

      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        profiles = profilesData || [];
      }

      // Combine history with user names
      const historyWithNames = historyData?.map(event => {
        let userName = 'Sistema';
        
        if (event.user_id === '00000000-0000-0000-0000-000000000000') {
          userName = 'Sistema Laboratório';
        } else if (event.user_id) {
          const profile = profiles.find(p => p.id === event.user_id);
          userName = profile?.full_name || profile?.email || 'Usuário';
        }
        
        return {
          ...event,
          user_name: userName
        };
      }) || [];

      setHistoryEvents(historyWithNames);
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
      const { data, error } = await supabase.storage
        .from('order-attachments')
        .download(filePath);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download iniciado",
        description: `Baixando ${fileName}...`
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Erro no download",
        description: "Não foi possível baixar o arquivo.",
        variant: "destructive"
      });
    }
  };

  // Upload new PDF attachment
  const handleUploadAttachment = async (file: File) => {
    if (!order?.id) return;

    setUploadingAttachment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Validate file
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O PDF deve ter no máximo 10MB.",
          variant: "destructive"
        });
        return;
      }

      if (file.type !== 'application/pdf') {
        toast({
          title: "Tipo inválido",
          description: "Apenas arquivos PDF são aceitos.",
          variant: "destructive"
        });
        return;
      }

      // Upload to storage
      const fileName = `${order.orderNumber}_${Date.now()}.pdf`;
      const filePath = `${user.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('order-attachments')
        .upload(filePath, file, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Save metadata
      const { error: attachmentError } = await supabase
        .from('order_attachments')
        .insert({
          order_id: order.id,
          file_name: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id
        });

      if (attachmentError) throw attachmentError;

      toast({
        title: "Anexo adicionado",
        description: `${file.name} foi anexado com sucesso.`
      });

      loadAttachments();
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
      reset(order);
      setItems(order.items || []);
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

    return () => {
      supabase.removeChannel(historyChannel);
      supabase.removeChannel(commentsChannel);
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

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
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
    
    setItems(newItems);
  };

  // Update received quantity and status
  const handleUpdateReceivedQuantity = async (itemId: string, receivedQty: number, requestedQty: number) => {
    let newStatus = 'pending';
    
    if (receivedQty === 0) {
      newStatus = 'pending';
    } else if (receivedQty < requestedQty) {
      newStatus = 'partial';
    } else if (receivedQty >= requestedQty) {
      newStatus = 'completed';
    }
    
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ 
          delivered_quantity: receivedQty,
          received_status: newStatus 
        })
        .eq('id', itemId);
        
      if (error) throw error;
      
      // Reload items from database
      const { data: updatedItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
        
      if (updatedItems) {
        setItems(updatedItems.map(item => ({
          id: item.id,
          itemCode: item.item_code,
          itemDescription: item.item_description,
          unit: item.unit,
          requestedQuantity: item.requested_quantity,
          warehouse: item.warehouse,
          deliveryDate: item.delivery_date,
          deliveredQuantity: item.delivered_quantity,
          received_status: (item.received_status as 'pending' | 'partial' | 'completed') || 'pending',
          item_source_type: (item.item_source_type as 'in_stock' | 'production' | 'out_of_stock') || 'in_stock',
          production_estimated_date: item.production_estimated_date,
          userId: item.user_id
        })));
      }
      
      toast({
        title: "Quantidade atualizada",
        description: "O status de recebimento foi atualizado."
      });
    } catch (error) {
      console.error("Error updating received quantity:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a quantidade recebida.",
        variant: "destructive"
      });
    }
  };

  // Mark item as completed (OK button)
  const handleMarkAsCompleted = async (item: OrderItem) => {
    if (!item.id) return;
    
    await handleUpdateReceivedQuantity(
      item.id, 
      item.requestedQuantity, 
      item.requestedQuantity
    );
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

  // Handle status change with validation
  const handleStatusChange = (newStatus: string) => {
    // Check if it's exception status
    if (newStatus === 'exception') {
      setPendingExceptionStatus(newStatus);
      setShowExceptionDialog(true);
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
        return;
      }
    }
    
    setValue("status", newStatus as any);
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

  const onSubmit = (data: Order) => {
    const updatedOrder = { ...data, id: order.id, items };
    
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
  };
  
  const handleDateChangeSubmit = async () => {
    if (!pendingOrderData) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      // NOVO: Inserir mudança de data DIRETAMENTE (sem setTimeout)
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
      
      if (changeError) throw changeError;
      
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
        <DialogContent className="max-w-[95vw] max-h-[95vh]">
          <DialogHeader>
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="edit" className="flex items-center gap-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Edit className="h-4 w-4" />
              Editar
            </TabsTrigger>
            <TabsTrigger value="lab" className="flex items-center gap-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white" disabled={!(order as any)?.lab_ticket_id}>
              <FileText className="h-4 w-4" />
              Laboratório
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 data-[state=active]:bg-green-500 data-[state=active]:text-white">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex items-center gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <MessageSquare className="h-4 w-4" />
              Comentários
            </TabsTrigger>
            <TabsTrigger value="attachments" className="flex items-center gap-2 data-[state=active]:bg-red-500 data-[state=active]:text-white">
              <FileText className="h-4 w-4" />
              Anexos
              {attachments.length > 0 && (
                <Badge variant="secondary" className="ml-1">{attachments.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-4">
            <ScrollArea className="h-[calc(95vh-200px)] pr-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Tipo</Label>
                    <Select onValueChange={(value) => setValue("type", value as any)} defaultValue={order?.type}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Produção</SelectItem>
                        <SelectItem value="sales">Vendas</SelectItem>
                        <SelectItem value="materials">Materiais</SelectItem>
                        <SelectItem value="ecommerce">E-commerce</SelectItem>
                      </SelectContent>
                    </Select>
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="client">Cliente</Label>
                    <Input {...register("client", { required: true })} />
                  </div>
                  <div>
                    <Label htmlFor="deskTicket">Nº Chamado Desk</Label>
                    <Input {...register("deskTicket", { required: true })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="totvsOrderNumber">Nº Pedido TOTVS</Label>
                    <Input 
                      {...register("totvsOrderNumber" as any)} 
                      placeholder="Ex: 123456"
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <Label htmlFor="deliveryDeadline">Prazo de Entrega</Label>
                    <Input {...register("deliveryDeadline", { required: true })} type="date" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select onValueChange={handleStatusChange} defaultValue={order?.status}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="planned">Planejado</SelectItem>
                        <SelectItem value="in_production">Em Produção</SelectItem>
                        <SelectItem value="exception">⚠️ Exceção</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium mb-3 block">Atualização Rápida de Status</Label>
                  <PhaseButtons 
                    order={order} 
                    onStatusChange={(orderId, newStatus) => handleStatusChange(newStatus)}
                  />
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">Itens do Pedido</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('edit-attachment-upload')?.click()}
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
                            <FileText className="h-4 w-4" />
                            Anexar PDF
                          </>
                        )}
                      </Button>
                      <input
                        id="edit-attachment-upload"
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUploadAttachment(file);
                            e.target.value = '';
                          }
                        }}
                      />
                      <Button type="button" onClick={addItem} size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Adicionar Item
                      </Button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <Card className="p-6 text-center text-muted-foreground">
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
                            <TableHead className="w-[130px]">Armazém</TableHead>
                            <TableHead className="w-[140px]">Data Entrega</TableHead>
                            <TableHead className="w-[150px]">Situação</TableHead>
                            <TableHead className="w-[120px]">Qtd. Recebida</TableHead>
                            <TableHead className="w-[120px]">Status</TableHead>
                            <TableHead className="w-[100px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item, index) => (
                            <TableRow key={index}>
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
                                  value={item.requestedQuantity}
                                  onChange={(e) => updateItem(index, "requestedQuantity", parseInt(e.target.value) || 0)}
                                  min="0"
                                  className="h-8 text-sm"
                                />
                              </TableCell>
                              <TableCell>
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
                                  value={item.item_source_type || 'in_stock'}
                                  onValueChange={(value: 'in_stock' | 'production' | 'out_of_stock') => updateItem(index, "item_source_type", value)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="in_stock">✅ Estoque</SelectItem>
                                    <SelectItem value="production">🏭 Produção</SelectItem>
                                    <SelectItem value="out_of_stock">⚠️ Sem Estoque</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.deliveredQuantity}
                                  onChange={(e) => {
                                    const newQty = Math.max(0, Math.min(parseInt(e.target.value) || 0, item.requestedQuantity));
                                    const newStatus = newQty === 0 ? 'pending' : (newQty < item.requestedQuantity ? 'partial' : 'completed');
                                    updateItem(index, "deliveredQuantity", newQty);
                                    updateItem(index, "received_status", newStatus);
                                  }}
                                  min="0"
                                  max={item.requestedQuantity}
                                  className="h-10 text-base"
                                />
                              </TableCell>
                              <TableCell>
                                {getReceiveStatusBadge(item.received_status, item.deliveredQuantity, item.requestedQuantity)}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMarkAsCompleted(item)}
                                    disabled={!item.id || item.received_status === 'completed'}
                                    className="h-8 gap-1 text-green-700 border-green-300 hover:bg-green-50"
                                    title="Marcar como totalmente recebido"
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

                <div className="flex justify-between items-center gap-2 pt-4 sticky bottom-0 bg-background">
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir Pedido
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      Salvar Alterações
                    </Button>
                  </div>
                </div>
              </form>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="lab" className="mt-4">
            <ScrollArea className="h-[calc(95vh-200px)] pr-4">
              {!(order as any)?.lab_ticket_id ? (
                <Card className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Este pedido ainda não foi enviado ao laboratório
                  </p>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Lab Information Card */}
                  <Card className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      Informações do Laboratório
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Ticket ID</p>
                        <p className="text-base font-mono">#{(order as any).lab_ticket_id}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status Atual</p>
                        <Badge className={(order as any).lab_status === "in_production" ? "bg-yellow-100 text-yellow-700" :
                                        (order as any).lab_status === "quality_check" ? "bg-blue-100 text-blue-700" :
                                        (order as any).lab_status === "ready" ? "bg-green-100 text-green-700" :
                                        (order as any).lab_status === "error" ? "bg-red-100 text-red-700" :
                                        "bg-gray-100 text-gray-700"}>
                          {(order as any).lab_status === "in_production" ? "Em Produção" :
                           (order as any).lab_status === "quality_check" ? "Controle de Qualidade" :
                           (order as any).lab_status === "ready" ? "Pronto" :
                           (order as any).lab_status === "error" ? "Erro de Produção" :
                           "Desconhecido"}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Data de Envio</p>
                        <p className="text-base flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {(order as any).lab_requested_at 
                            ? format(new Date((order as any).lab_requested_at), "dd/MM/yyyy HH:mm")
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Data de Conclusão</p>
                        <p className="text-base flex items-center gap-1">
                          {(order as any).lab_completed_at ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              {format(new Date((order as any).lab_completed_at), "dd/MM/yyyy HH:mm")}
                            </>
                          ) : (
                            <span className="text-muted-foreground">Em andamento...</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Lab Notes */}
                  {(order as any).lab_notes && (
                    <Card className="p-6 space-y-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-blue-600" />
                        Notas do Laboratório
                      </h3>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{(order as any).lab_notes}</p>
                      </div>
                    </Card>
                  )}

                  {/* Status Timeline */}
                  <Card className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <History className="h-5 w-5 text-blue-600" />
                      Linha do Tempo
                    </h3>
                    <div className="space-y-3 pl-4 border-l-2 border-muted">
                      <div className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-600"></div>
                        <p className="text-sm font-medium">Pedido enviado ao laboratório</p>
                        <p className="text-xs text-muted-foreground">
                          {(order as any).lab_requested_at 
                            ? format(new Date((order as any).lab_requested_at), "dd/MM/yyyy HH:mm")
                            : "-"}
                        </p>
                      </div>
                      {(order as any).lab_status === "in_production" && (
                        <div className="relative pl-6">
                          <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-yellow-600"></div>
                          <p className="text-sm font-medium">Em produção</p>
                          <p className="text-xs text-muted-foreground">Processando...</p>
                        </div>
                      )}
                      {(order as any).lab_status === "quality_check" && (
                        <div className="relative pl-6">
                          <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-600"></div>
                          <p className="text-sm font-medium">Controle de qualidade</p>
                          <p className="text-xs text-muted-foreground">Em verificação...</p>
                        </div>
                      )}
                      {(order as any).lab_status === "ready" && (
                        <div className="relative pl-6">
                          <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-green-600"></div>
                          <p className="text-sm font-medium">Concluído</p>
                          <p className="text-xs text-muted-foreground">
                            {(order as any).lab_completed_at 
                              ? format(new Date((order as any).lab_completed_at), "dd/MM/yyyy HH:mm")
                              : "-"}
                          </p>
                        </div>
                      )}
                      {(order as any).lab_status === "error" && (
                        <div className="relative pl-6">
                          <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-red-600"></div>
                          <p className="text-sm font-medium">Erro de produção</p>
                          <p className="text-xs text-muted-foreground">Verifique as notas do laboratório</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
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

              {loadingHistory ? (
                <div className="flex items-center justify-center h-[400px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : historyEvents.length === 0 ? (
                <Card className="p-8 text-center">
                  <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhuma movimentação registrada ainda
                  </p>
                </Card>
              ) : (
                <ScrollArea className="h-[calc(95vh-300px)]">
                  <div className="space-y-4">
                    {historyEvents.map((event) => (
                      <div key={event.id} className="flex gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0">
                          {getEventIcon(event.old_status, event.new_status)}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Mudança de Status</h4>
                            <Badge variant={getEventBadgeVariant(event.new_status)} className="text-xs">
                              {getStatusLabel(event.new_status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            De <span className="font-medium">{getStatusLabel(event.old_status)}</span> para{" "}
                            <span className="font-medium">{getStatusLabel(event.new_status)}</span>
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(event.changed_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {event.user_name || 'Sistema'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
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
                        Anexar PDF
                      </>
                    )}
                  </Button>
                  <input
                    id="attachment-upload"
                    type="file"
                    accept=".pdf,application/pdf"
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
                    {attachments.map((attachment) => (
                      <Card key={attachment.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <FileText className="h-10 w-10 text-red-600" />
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
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPDF(attachment.file_path, attachment.file_name)}
                            className="gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Baixar
                          </Button>
                        </div>
                      </Card>
                    ))}
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