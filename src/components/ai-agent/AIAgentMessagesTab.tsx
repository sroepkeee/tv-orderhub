import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Truck, 
  Users, 
  Phone, 
  MessageSquare, 
  Send, 
  Inbox,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { ConversationSummaryPanel } from "./ConversationSummaryPanel";

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
}

interface Message {
  id: string;
  message_content: string;
  message_direction: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  contact_type: string;
}

interface Props {
  selectedAgentType?: 'carrier' | 'customer';
}

export function AIAgentMessagesTab({ selectedAgentType = 'carrier' }: Props) {
  const [activeTab, setActiveTab] = useState("todas");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  
  // Message input state
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    connected: whatsappConnected,
    loading: whatsappLoading,
    phoneNumber,
    connectedAt,
    refresh: refreshWhatsApp
  } = useWhatsAppStatus();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
            message_direction: msg.message_direction
          };
        }
        if (msg.message_direction === 'inbound' && !msg.read_at) {
          acc[carrierId].unread_count = (acc[carrierId].unread_count || 0) + 1;
        }
        return acc;
      }, {});

      setConversations(Object.values(grouped).sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      ));
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (carrierId: string) => {
    try {
      const { data, error } = await supabase
        .from('carrier_conversations')
        .select('*')
        .eq('carrier_id', carrierId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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
      .channel('ai-agent-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'carrier_conversations'
      }, () => {
        setSyncing(true);
        loadConversations();
        if (selectedConversation) {
          loadMessages(selectedConversation.carrier_id);
        }
        setTimeout(() => setSyncing(false), 1000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations, loadMessages, selectedConversation]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !whatsappConnected) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('mega-api-send', {
        body: {
          carrierId: selectedConversation.carrier_id,
          message: newMessage.trim(),
          conversationType: 'direct'
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

  // Filter conversations
  const getFilteredConversations = () => {
    let filtered = conversations;

    if (activeTab === 'cotacoes') {
      filtered = conversations.filter(c => c.contact_type === 'carrier');
    } else if (activeTab === 'clientes') {
      filtered = conversations.filter(c => c.contact_type === 'customer');
    } else if (activeTab === 'recebidas') {
      filtered = conversations.filter(c => c.message_direction === 'inbound');
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

  return (
    <div className="space-y-3">
      {/* Compact WhatsApp Status Bar */}
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${
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
          {syncing && (
            <Badge variant="outline" className="text-xs animate-pulse ml-2">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Sincronizando
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refreshWhatsApp} disabled={whatsappLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${whatsappLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex gap-3 h-[calc(100vh-280px)]">
        {/* Conversations List */}
        <Card className="w-80 flex-shrink-0 flex flex-col">
          <CardHeader className="pb-2 px-3 pt-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-4 h-8">
                <TabsTrigger value="todas" className="text-xs px-2">Todas</TabsTrigger>
                <TabsTrigger value="cotacoes" className="text-xs px-2">
                  <Truck className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="clientes" className="text-xs px-2">
                  <Users className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="recebidas" className="text-xs px-2">
                  <Inbox className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative mt-2">
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
                  {filteredConversations.map(conversation => (
                    <button
                      key={conversation.carrier_id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`w-full flex items-start gap-2.5 p-2.5 text-left transition-colors ${
                        selectedConversation?.carrier_id === conversation.carrier_id
                          ? 'bg-primary/10'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <Avatar className={`h-9 w-9 ${getAvatarColor(conversation.contact_name)}`}>
                        <AvatarFallback className="text-white text-xs">
                          {getInitials(conversation.contact_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate pr-2">
                            {conversation.contact_name}
                          </p>
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
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conversation Details */}
        <Card className="flex-1 flex flex-col">
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
                      <CardTitle className="text-sm">{selectedConversation.contact_name}</CardTitle>
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
                  <Button 
                    variant={showSummary ? "default" : "outline"} 
                    size="sm" 
                    className="gap-1.5 h-8"
                    onClick={() => setShowSummary(!showSummary)}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span className="text-xs">Resumo IA</span>
                  </Button>
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
                        messages.map(message => (
                          <div
                            key={message.id}
                            className={`flex ${message.message_direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[75%] px-3 py-2 rounded-lg ${
                                message.message_direction === 'outbound'
                                  ? 'bg-[#dcf8c6] dark:bg-green-900/50'
                                  : 'bg-muted'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">{message.message_content}</p>
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
                                </span>
                                {message.message_direction === 'outbound' && (
                                  <span className={`text-[10px] ${message.read_at ? 'text-blue-500' : 'text-muted-foreground'}`}>
                                    {message.read_at ? '✓✓' : message.delivered_at ? '✓✓' : '✓'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Message Input */}
                  <div className="p-3 border-t flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Input 
                        placeholder={whatsappConnected ? "Digite uma mensagem..." : "WhatsApp não conectado"}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!whatsappConnected || sending}
                        className="flex-1 h-9 text-sm"
                      />
                      <Button 
                        size="icon" 
                        className="h-9 w-9"
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
                  <div className="w-72 flex-shrink-0 bg-muted/20">
                    <ConversationSummaryPanel 
                      carrierId={selectedConversation.carrier_id}
                      contactName={selectedConversation.contact_name}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">Selecione uma conversa</p>
                <p className="text-xs mt-1">Escolha um contato para ver as mensagens</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
