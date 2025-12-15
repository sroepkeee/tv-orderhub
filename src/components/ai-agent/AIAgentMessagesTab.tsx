import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, 
  Truck, 
  Users, 
  Phone, 
  MessageSquare, 
  Send, 
  Inbox,
  TestTube,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";

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

interface AINotification {
  id: string;
  channel: string;
  recipient: string;
  message_content: string;
  subject: string | null;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export function AIAgentMessagesTab() {
  const [activeTab, setActiveTab] = useState("todas");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<AINotification[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Test message state
  const [testNumber, setTestNumber] = useState("51993291603");
  const [testMessage, setTestMessage] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const {
    connected: whatsappConnected,
    status: whatsappStatus,
    loading: whatsappLoading,
    phoneNumber,
    connectedAt,
    refresh: refreshWhatsApp
  } = useWhatsAppStatus();

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

      // Group by carrier and get latest message
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
        // Count unread inbound messages
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

  // Load AI notifications
  const loadNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ai_notification_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
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
    loadNotifications();
  }, [loadConversations, loadNotifications]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.carrier_id);
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
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_notification_log'
      }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations, loadNotifications, loadMessages, selectedConversation]);

  // Send test message
  const handleSendTest = async () => {
    if (!testMessage.trim() || !testNumber.trim()) {
      toast.error('Preencha o número e a mensagem');
      return;
    }

    setSendingTest(true);
    try {
      // Find carrier by phone number
      const { data: carrier } = await supabase
        .from('carriers')
        .select('id')
        .eq('whatsapp', testNumber.replace(/\D/g, ''))
        .maybeSingle();

      if (!carrier) {
        toast.error('Transportadora não encontrada para este número');
        setSendingTest(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('mega-api-send', {
        body: {
          carrierId: carrier.id,
          message: testMessage,
          conversationType: 'test'
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Mensagem de teste enviada!');
        setTestMessage('');
        loadConversations();
      } else {
        throw new Error(data?.error || 'Erro ao enviar mensagem');
      }
    } catch (error: any) {
      console.error('Error sending test message:', error);
      toast.error(error.message || 'Erro ao enviar mensagem de teste');
    } finally {
      setSendingTest(false);
    }
  };

  // Filter conversations based on active tab
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="h-3 w-3 text-muted-foreground" />;
      case 'delivered':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'read':
        return <CheckCircle2 className="h-3 w-3 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
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
    <div className="space-y-4">
      {/* WhatsApp Status Card */}
      <Card className={whatsappConnected ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${whatsappConnected ? 'bg-green-500' : 'bg-amber-500'}`}>
                {whatsappConnected ? (
                  <Wifi className="h-5 w-5 text-white" />
                ) : (
                  <WifiOff className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">WhatsApp</span>
                  {whatsappConnected ? (
                    <Badge className="bg-green-500 text-white">Conectado</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-500 text-white">Desconectado</Badge>
                  )}
                  {syncing && (
                    <Badge variant="outline" className="animate-pulse">
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Sincronizando...
                    </Badge>
                  )}
                </div>
                {whatsappConnected && phoneNumber && (
                  <p className="text-sm text-muted-foreground font-mono">
                    {formatPhoneNumber(phoneNumber)}
                    {connectedAt && (
                      <span className="ml-2">
                        • Conectado {formatDistanceToNow(connectedAt, { addSuffix: true, locale: ptBR })}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={refreshWhatsApp} disabled={whatsappLoading}>
              <RefreshCw className={`h-4 w-4 ${whatsappLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Message Card */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <TestTube className="h-4 w-4" />
            Enviar Mensagem de Teste
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Input 
              placeholder="Número (ex: 51993291603)" 
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              className="w-48 bg-background"
            />
            <Input 
              placeholder="Mensagem de teste..."
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="flex-1 bg-background"
              onKeyDown={(e) => e.key === 'Enter' && handleSendTest()}
            />
            <Button 
              onClick={handleSendTest} 
              disabled={sendingTest || !whatsappConnected}
              className="gap-2"
            >
              {sendingTest ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar
            </Button>
          </div>
          {!whatsappConnected && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ WhatsApp não conectado. Conecte-se na aba "Conexões" para enviar mensagens.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Main Content with Tabs */}
      <div className="flex gap-4 h-[calc(100vh-420px)]">
        {/* Conversations List */}
        <Card className="w-96 flex-shrink-0">
          <CardHeader className="pb-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="todas" className="text-xs">Todas</TabsTrigger>
                <TabsTrigger value="cotacoes" className="text-xs">
                  <Truck className="h-3 w-3 mr-1" />
                  Cotações
                </TabsTrigger>
                <TabsTrigger value="clientes" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  Clientes
                </TabsTrigger>
                <TabsTrigger value="recebidas" className="text-xs">
                  <Inbox className="h-3 w-3 mr-1" />
                  Recebidas
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-560px)]">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Carregando...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhuma conversa encontrada
                </div>
              ) : (
                <div className="divide-y">
                  {filteredConversations.map(conversation => (
                    <button
                      key={conversation.carrier_id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${
                        selectedConversation?.carrier_id === conversation.carrier_id
                          ? 'bg-primary/10'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <Avatar className={`h-10 w-10 ${getAvatarColor(conversation.contact_name)}`}>
                        <AvatarFallback className="text-white text-xs">
                          {getInitials(conversation.contact_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">
                            {conversation.contact_name}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(conversation.last_message_at), 'HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {conversation.message_direction === 'outbound' && (
                            <span className="text-blue-500 text-xs">✓✓</span>
                          )}
                          <p className="text-xs text-muted-foreground truncate">
                            {conversation.last_message.slice(0, 50)}...
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4">
                            {conversation.contact_type === 'carrier' ? 'Transportadora' : 'Cliente'}
                          </Badge>
                          {conversation.message_direction === 'inbound' && (
                            <Badge variant="secondary" className="text-[10px] h-4 bg-green-100 text-green-700">
                              Recebida
                            </Badge>
                          )}
                        </div>
                      </div>
                      {conversation.unread_count > 0 && (
                        <Badge className="h-5 min-w-5 flex items-center justify-center bg-green-500">
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
              <CardHeader className="pb-3 border-b flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar className={`h-10 w-10 ${getAvatarColor(selectedConversation.contact_name)}`}>
                    <AvatarFallback className="text-white text-xs">
                      {getInitials(selectedConversation.contact_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-base">{selectedConversation.contact_name}</CardTitle>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      {selectedConversation.contact_phone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3" />
                          {selectedConversation.contact_phone}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {selectedConversation.contact_type === 'carrier' ? 'Transportadora' : 'Cliente'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        Nenhuma mensagem nesta conversa
                      </div>
                    ) : (
                      messages.map(message => (
                        <div
                          key={message.id}
                          className={`flex ${message.message_direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] p-3 rounded-lg ${
                              message.message_direction === 'outbound'
                                ? 'bg-[#dcf8c6] dark:bg-green-900/50 text-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.message_content}</p>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
                              </span>
                              {message.message_direction === 'outbound' && (
                                <span className={`text-xs ${message.read_at ? 'text-blue-500' : 'text-muted-foreground'}`}>
                                  {message.read_at ? '✓✓' : message.delivered_at ? '✓✓' : '✓'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Input (read-only for now) */}
              <div className="p-4 border-t flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Input placeholder="Use o painel de teste acima para enviar mensagens" className="flex-1" disabled />
                  <Button size="icon" disabled>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Selecione uma conversa</p>
                <p className="text-sm">ou envie uma mensagem de teste acima</p>
              </div>
            </div>
          )}
        </Card>

        {/* AI Notifications Panel */}
        {activeTab === 'clientes' && (
          <Card className="w-80 flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Notificações AI
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-560px)]">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nenhuma notificação enviada
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.slice(0, 20).map(notification => (
                      <div key={notification.id} className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {notification.channel}
                          </Badge>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(notification.status)}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(notification.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground truncate">
                          {notification.recipient}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message_content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
