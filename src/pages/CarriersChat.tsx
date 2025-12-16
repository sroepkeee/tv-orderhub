import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Search, 
  Truck, 
  Users, 
  MessageSquare, 
  Send, 
  Inbox,
  RefreshCw,
  AlertTriangle,
  Frown,
  Meh,
  Smile,
  CircleDot,
  ArrowLeft,
  Settings,
  Package,
  Trash2,
  BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { ConversationSummaryPanel } from "@/components/ai-agent/ConversationSummaryPanel";

interface NavigationState {
  carrierId?: string;
  carrierWhatsapp?: string;
  carrierName?: string;
  orderId?: string;
  orderNumber?: string;
  returnTo?: string;
}

interface SentimentCache {
  carrier_id: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'critical' | null;
  score: number | null;
}

interface Conversation {
  id: string;
  carrier_id: string;
  contact_name: string;
  contact_phone: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  contact_type: string;
  message_direction: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'critical' | null;
  score?: number | null;
}

interface MessageMetadata {
  is_ai_generated?: boolean;
  sent_via?: string;
  model?: string;
  processing_time_ms?: number;
}

interface Message {
  id: string;
  message_content: string;
  message_direction: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  contact_type: string;
  conversation_type: string;
  message_metadata: MessageMetadata | null;
}

const parseMessageMetadata = (metadata: unknown): MessageMetadata | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  return {
    is_ai_generated: m.is_ai_generated as boolean | undefined,
    sent_via: m.sent_via as string | undefined,
    model: m.model as string | undefined,
    processing_time_ms: m.processing_time_ms as number | undefined,
  };
};

type SentimentFilter = 'all' | 'critical' | 'negative' | 'neutral' | 'positive';

const SENTIMENT_CONFIG = {
  critical: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-950/50', border: 'border-red-300 dark:border-red-800', label: 'Crítico' },
  negative: { icon: Frown, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-950/50', border: 'border-orange-300 dark:border-orange-800', label: 'Negativo' },
  neutral: { icon: Meh, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800/50', border: 'border-gray-300 dark:border-gray-700', label: 'Neutro' },
  positive: { icon: Smile, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-950/50', border: 'border-green-300 dark:border-green-800', label: 'Positivo' },
};

export default function CarriersChat() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState("todas");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sentimentCache, setSentimentCache] = useState<Record<string, SentimentCache>>({});
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [sourceOrder, setSourceOrder] = useState<NavigationState | null>(null);
  
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    connected: whatsappConnected,
    loading: whatsappLoading,
    phoneNumber,
    connectedAt,
    refresh: refreshWhatsApp,
    isAuthorized
  } = useWhatsAppStatus();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load sentiment cache
  const loadSentimentCache = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_sentiment_cache')
        .select('carrier_id, sentiment, score');

      if (error) throw error;
      
      const cache: Record<string, SentimentCache> = {};
      (data || []).forEach(item => {
        cache[item.carrier_id] = item as SentimentCache;
      });
      setSentimentCache(cache);
    } catch (error) {
      console.error('Error loading sentiment cache:', error);
    }
  }, []);

  // Load all conversations
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('carrier_conversations')
        .select(`
          id,
          carrier_id,
          message_content,
          message_direction,
          created_at,
          contact_type,
          delivered_at,
          read_at,
          carriers!inner(name, whatsapp)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const grouped = (data || []).reduce((acc: Record<string, Conversation>, msg: any) => {
        const carrierId = msg.carrier_id;
        if (!acc[carrierId] || new Date(msg.created_at) > new Date(acc[carrierId].last_message_at)) {
          acc[carrierId] = {
            id: msg.id,
            carrier_id: carrierId,
            contact_name: msg.carriers?.name || 'Desconhecido',
            contact_phone: msg.carriers?.whatsapp || '',
            last_message: msg.message_content,
            last_message_at: msg.created_at,
            unread_count: 0,
            contact_type: msg.contact_type || 'carrier',
            message_direction: msg.message_direction,
            sentiment: sentimentCache[carrierId]?.sentiment,
            score: sentimentCache[carrierId]?.score,
          };
        }
        if (msg.message_direction === 'inbound' && !msg.read_at) {
          acc[carrierId].unread_count = (acc[carrierId].unread_count || 0) + 1;
        }
        return acc;
      }, {});

      const conversationsWithSentiment = Object.values(grouped).map(conv => ({
        ...conv,
        sentiment: sentimentCache[conv.carrier_id]?.sentiment,
        score: sentimentCache[conv.carrier_id]?.score,
      }));

      setConversations(conversationsWithSentiment.sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      ));
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [sentimentCache]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (carrierId: string) => {
    try {
      const { data, error } = await supabase
        .from('carrier_conversations')
        .select('id, message_content, message_direction, created_at, delivered_at, read_at, contact_type, conversation_type, message_metadata')
        .eq('carrier_id', carrierId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const mappedMessages: Message[] = (data || []).map(msg => ({
        id: msg.id,
        message_content: msg.message_content,
        message_direction: msg.message_direction,
        created_at: msg.created_at,
        delivered_at: msg.delivered_at,
        read_at: msg.read_at,
        contact_type: msg.contact_type || 'carrier',
        conversation_type: msg.conversation_type,
        message_metadata: parseMessageMetadata(msg.message_metadata),
      }));
      
      setMessages(mappedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, []);

  // Real-time update handler
  const handleRealtimeUpdate = useCallback((payload: any) => {
    const { eventType, new: newRecord } = payload;
    
    setSyncing(true);
    setHasNewMessages(true);
    setTimeout(() => {
      setSyncing(false);
      setHasNewMessages(false);
    }, 3000);

    if (eventType === 'INSERT') {
      const carrierId = newRecord?.carrier_id;
      
      setConversations(prev => {
        const existing = prev.find(c => c.carrier_id === carrierId);
        if (existing) {
          return prev.map(c => {
            if (c.carrier_id === carrierId) {
              return {
                ...c,
                last_message: newRecord.message_content,
                last_message_at: newRecord.created_at,
                message_direction: newRecord.message_direction,
                unread_count: newRecord.message_direction === 'inbound' && !newRecord.read_at 
                  ? (c.unread_count || 0) + 1 
                  : c.unread_count,
              };
            }
            return c;
          }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
        }
        loadConversations();
        return prev;
      });

      if (selectedConversation?.carrier_id === carrierId) {
        const mappedMessage: Message = {
          id: newRecord.id,
          message_content: newRecord.message_content,
          message_direction: newRecord.message_direction,
          created_at: newRecord.created_at,
          delivered_at: newRecord.delivered_at,
          read_at: newRecord.read_at,
          contact_type: newRecord.contact_type || 'carrier',
          conversation_type: newRecord.conversation_type,
          message_metadata: parseMessageMetadata(newRecord.message_metadata),
        };
        setMessages(prev => [...prev, mappedMessage]);
      }
    }
  }, [selectedConversation, loadConversations]);

  // Initial load
  useEffect(() => {
    loadSentimentCache();
  }, [loadSentimentCache]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Handle navigation state
  useEffect(() => {
    const navigationState = location.state as NavigationState | null;
    if (navigationState?.carrierId && conversations.length > 0) {
      const conv = conversations.find(c => c.carrier_id === navigationState.carrierId);
      if (conv) {
        setSelectedConversation(conv);
      }
      setSourceOrder(navigationState);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, conversations]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.carrier_id);
      setShowSummary(false);
    }
  }, [selectedConversation, loadMessages]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('carriers-chat-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'carrier_conversations'
      }, handleRealtimeUpdate)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_sentiment_cache'
      }, () => {
        loadSentimentCache();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleRealtimeUpdate, loadSentimentCache]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !whatsappConnected) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-send', {
        body: {
          carrierId: selectedConversation.carrier_id,
          message: newMessage.trim(),
          conversationType: 'general'
        }
      });

      if (error) throw error;
      if (data?.success) {
        setNewMessage('');
        await loadMessages(selectedConversation.carrier_id);
        await loadConversations();
      } else {
        throw new Error(data?.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Delete all conversations
  const handleDeleteAllConversations = async () => {
    try {
      const { error } = await supabase
        .from('carrier_conversations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      
      setConversations([]);
      setSelectedConversation(null);
      setMessages([]);
      
      toast.success('Todas as conversas foram excluídas');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir conversas');
    }
  };

  // Delete carrier conversations
  const handleDeleteCarrierConversations = async (carrierId: string) => {
    try {
      const { error } = await supabase
        .from('carrier_conversations')
        .delete()
        .eq('carrier_id', carrierId);

      if (error) throw error;
      
      setConversations(prev => prev.filter(c => c.carrier_id !== carrierId));
      if (selectedConversation?.carrier_id === carrierId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      
      toast.success('Conversas excluídas');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir conversas');
    }
  };

  // Filter conversations
  const getFilteredConversations = () => {
    let filtered = conversations;

    if (activeTab === 'transportadoras') {
      filtered = filtered.filter(c => c.contact_type === 'carrier');
    } else if (activeTab === 'clientes') {
      filtered = filtered.filter(c => c.contact_type === 'customer');
    } else if (activeTab === 'recebidas') {
      filtered = filtered.filter(c => c.message_direction === 'inbound');
    }

    if (sentimentFilter !== 'all') {
      filtered = filtered.filter(c => c.sentiment === sentimentFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.contact_phone.includes(searchTerm)
      );
    }

    return filtered;
  };

  const filteredConversations = getFilteredConversations();

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
      'bg-orange-500', 'bg-pink-500', 'bg-teal-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatPhoneNumber = (phone: string | undefined) => {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 11) {
      return `+55 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const getSentimentBadge = (sentiment: string | null | undefined, score: number | null | undefined) => {
    if (!sentiment) return null;
    const config = SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG];
    if (!config) return null;
    
    const Icon = config.icon;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] ${config.bg} ${config.border} border`}>
              <Icon className={`h-3 w-3 ${config.color}`} />
              {score !== null && score !== undefined && (
                <span className={`font-medium ${config.color}`}>{score.toFixed(1)}</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p>{config.label}: {score?.toFixed(1)}/10</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const sentimentCounts = {
    all: conversations.length,
    critical: conversations.filter(c => c.sentiment === 'critical').length,
    negative: conversations.filter(c => c.sentiment === 'negative').length,
    neutral: conversations.filter(c => c.sentiment === 'neutral').length,
    positive: conversations.filter(c => c.sentiment === 'positive').length,
  };

  const unreadCount = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">Mensagens</h1>
                <Badge variant="secondary" className="text-xs">
                  {activeTab === 'transportadoras' ? 'Transportadoras' : 
                   activeTab === 'clientes' ? 'Clientes' : 'Todas'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Conversas dos agentes de IA</p>
            </div>
            {syncing && (
              <Badge variant="outline" className="gap-1 animate-pulse bg-blue-50 dark:bg-blue-950/30 border-blue-300">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Sincronizando
              </Badge>
            )}
            {hasNewMessages && !syncing && (
              <Badge variant="outline" className="gap-1 bg-green-50 dark:bg-green-950/30 border-green-300 text-green-600">
                <CircleDot className="h-3 w-3 animate-pulse" />
                Nova mensagem
              </Badge>
            )}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sourceOrder?.orderNumber && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  navigate('/', { 
                    state: { 
                      openOrderId: sourceOrder.orderId,
                      openOrderNumber: sourceOrder.orderNumber 
                    }
                  });
                }}
                className="gap-2"
              >
                <Package className="h-4 w-4" />
                Voltar ao Pedido #{sourceOrder.orderNumber}
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/40"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar Tudo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todas as conversas?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá excluir TODAS as conversas do sistema.
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAllConversations}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Limpar Tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {isAuthorized && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/whatsapp-settings')}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Configurações
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* WhatsApp Status Bar */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
        whatsappConnected 
          ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
          : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${whatsappConnected ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`} />
          <span className="text-sm font-medium">
            {whatsappConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
          </span>
          {whatsappConnected && phoneNumber && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground font-mono">
                {formatPhoneNumber(phoneNumber)}
              </span>
            </>
          )}
          {whatsappConnected && connectedAt && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(connectedAt, { addSuffix: true, locale: ptBR })}
              </span>
            </>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refreshWhatsApp} disabled={whatsappLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${whatsappLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-3 p-3 overflow-hidden">
        {/* Conversations List */}
        <Card className="w-80 flex-shrink-0 flex flex-col">
          <CardHeader className="pb-2 px-3 pt-3 space-y-2">
            {/* Type Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-4 h-8">
                <TabsTrigger value="todas" className="text-xs px-2">Todas</TabsTrigger>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="transportadoras" className="text-xs px-2">
                        <Truck className="h-3 w-3" />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Transportadoras</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="clientes" className="text-xs px-2">
                        <Users className="h-3 w-3" />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Clientes</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="recebidas" className="text-xs px-2">
                        <Inbox className="h-3 w-3" />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Recebidas</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TabsList>
            </Tabs>

            {/* Sentiment Filters */}
            <div className="flex gap-1 flex-wrap">
              <Button
                variant={sentimentFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setSentimentFilter('all')}
              >
                Todas ({sentimentCounts.all})
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={sentimentFilter === 'critical' ? 'default' : 'outline'}
                      size="sm"
                      className={`h-6 text-[10px] px-2 ${sentimentFilter !== 'critical' ? 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30' : 'bg-red-500 hover:bg-red-600'}`}
                      onClick={() => setSentimentFilter('critical')}
                    >
                      <AlertTriangle className="h-3 w-3 mr-0.5" />
                      {sentimentCounts.critical}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Crítico (1-3): Atenção urgente</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={sentimentFilter === 'negative' ? 'default' : 'outline'}
                      size="sm"
                      className={`h-6 text-[10px] px-2 ${sentimentFilter !== 'negative' ? 'border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950/30' : 'bg-orange-500 hover:bg-orange-600'}`}
                      onClick={() => setSentimentFilter('negative')}
                    >
                      <Frown className="h-3 w-3 mr-0.5" />
                      {sentimentCounts.negative}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Negativo (4-5): Requer cuidado</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={sentimentFilter === 'neutral' ? 'default' : 'outline'}
                      size="sm"
                      className={`h-6 text-[10px] px-2 ${sentimentFilter !== 'neutral' ? 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/30' : ''}`}
                      onClick={() => setSentimentFilter('neutral')}
                    >
                      <Meh className="h-3 w-3 mr-0.5" />
                      {sentimentCounts.neutral}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Neutro (6-7): Normal</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={sentimentFilter === 'positive' ? 'default' : 'outline'}
                      size="sm"
                      className={`h-6 text-[10px] px-2 ${sentimentFilter !== 'positive' ? 'border-green-300 text-green-600 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950/30' : 'bg-green-500 hover:bg-green-600'}`}
                      onClick={() => setSentimentFilter('positive')}
                    >
                      <Smile className="h-3 w-3 mr-0.5" />
                      {sentimentCounts.positive}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Positivo (8-10): Satisfatório</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                  <span className="text-xs">Carregando...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Nenhuma conversa</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredConversations.map(conversation => {
                    const sentimentConfig = conversation.sentiment ? SENTIMENT_CONFIG[conversation.sentiment as keyof typeof SENTIMENT_CONFIG] : null;
                    const isCritical = conversation.sentiment === 'critical';
                    
                    return (
                      <button
                        key={conversation.carrier_id}
                        onClick={() => setSelectedConversation(conversation)}
                        className={`w-full flex items-start gap-2.5 p-2.5 text-left transition-colors ${
                          selectedConversation?.carrier_id === conversation.carrier_id
                            ? 'bg-primary/10'
                            : isCritical
                            ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50 dark:hover:bg-red-950/30'
                            : 'hover:bg-muted/50'
                        } ${isCritical ? 'border-l-2 border-l-red-500' : ''}`}
                      >
                        <Avatar className={`h-9 w-9 ${getAvatarColor(conversation.contact_name)}`}>
                          <AvatarFallback className="text-white text-xs">
                            {getInitials(conversation.contact_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {conversation.contact_name}
                              </p>
                              {getSentimentBadge(conversation.sentiment, conversation.score)}
                            </div>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">
                              {format(new Date(conversation.last_message_at), 'HH:mm', { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {conversation.message_direction === 'outbound' && (
                              <span className="text-blue-500 mr-1">✓✓</span>
                            )}
                            {conversation.last_message.slice(0, 40)}...
                          </p>
                        </div>
                        {conversation.unread_count > 0 && (
                          <Badge className="h-4 min-w-4 px-1 flex items-center justify-center bg-green-500 text-[10px]">
                            {conversation.unread_count}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conversation Details */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Header */}
              <CardHeader className="py-2.5 px-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className={`h-9 w-9 ${getAvatarColor(selectedConversation.contact_name)}`}>
                      <AvatarFallback className="text-white text-xs">
                        {getInitials(selectedConversation.contact_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm">{selectedConversation.contact_name}</CardTitle>
                        {getSentimentBadge(selectedConversation.sentiment, selectedConversation.score)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {selectedConversation.contact_phone && (
                          <span className="font-mono">{formatPhoneNumber(selectedConversation.contact_phone)}</span>
                        )}
                        <Badge variant="outline" className="text-[10px] h-4">
                          {selectedConversation.contact_type === 'carrier' ? 'Transportadora' : 'Cliente'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant={showSummary ? "default" : "outline"} 
                      size="sm" 
                      className="gap-1.5 h-8"
                      onClick={() => setShowSummary(!showSummary)}
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span className="text-xs">Resumo IA</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="gap-1.5 h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação irá excluir todas as mensagens com {selectedConversation.contact_name}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteCarrierConversations(selectedConversation.carrier_id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>

              <div className="flex-1 flex overflow-hidden">
                {/* Messages */}
                <CardContent className={`p-0 flex-1 overflow-hidden flex flex-col ${showSummary ? 'border-r' : ''}`}>
                  <ScrollArea className="flex-1 p-3">
                    <div className="space-y-2">
                      {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhuma mensagem</p>
                        </div>
                      ) : (
                        messages.map(message => {
                          const isAiGenerated = message.message_metadata?.is_ai_generated || 
                            message.message_metadata?.sent_via === 'ai_agent_auto_reply';
                          
                          return (
                            <div
                              key={message.id}
                              className={`flex ${message.message_direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[75%] px-3 py-2 rounded-lg ${
                                  message.message_direction === 'outbound'
                                    ? isAiGenerated 
                                      ? 'bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800'
                                      : 'bg-[#dcf8c6] dark:bg-green-900/50'
                                    : 'bg-muted'
                                }`}
                              >
                                {/* AI Badge */}
                                {isAiGenerated && (
                                  <div className="flex items-center gap-1 mb-1">
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-blue-50 dark:bg-blue-950/50 border-blue-300 text-blue-600 dark:text-blue-400">
                                      🤖 IA
                                    </Badge>
                                    {message.message_metadata?.model && (
                                      <span className="text-[9px] text-muted-foreground">
                                        {message.message_metadata.model}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {message.message_content}
                                </p>
                                <div className={`flex items-center gap-1 mt-1 ${
                                  message.message_direction === 'outbound' ? 'justify-end' : 'justify-start'
                                }`}>
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
                                  </span>
                                  {message.message_direction === 'outbound' && (
                                    <span className={message.read_at ? 'text-blue-500' : 'text-muted-foreground'}>
                                      {message.read_at ? '✓✓' : message.delivered_at ? '✓✓' : '✓'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Message Input */}
                  <div className="p-3 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder={whatsappConnected ? "Digite uma mensagem..." : "WhatsApp desconectado"}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!whatsappConnected || sending}
                        className="flex-1"
                      />
                      <Button 
                        size="icon" 
                        onClick={handleSendMessage}
                        disabled={!whatsappConnected || !newMessage.trim() || sending}
                      >
                        {sending ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>

                {/* Summary Panel */}
                {showSummary && (
                  <div className="w-80 flex-shrink-0">
                    <ConversationSummaryPanel 
                      carrierId={selectedConversation.carrier_id}
                      contactName={selectedConversation.contact_name}
                      onClose={() => setShowSummary(false)}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/20">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium mb-1">Selecione uma conversa</p>
                <p className="text-sm">Escolha uma conversa para ver as mensagens</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
