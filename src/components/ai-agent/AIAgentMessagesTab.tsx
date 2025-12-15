import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Search, Bot, Truck, Users, Phone, Mail, MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Agent {
  id: string;
  name: string;
  type: 'quote' | 'customer';
  icon: React.ReactNode;
  contactType: string;
  description: string;
}

interface Conversation {
  id: string;
  contact_name: string;
  contact_phone: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  contact_type: string;
}

interface Message {
  id: string;
  message_content: string;
  message_direction: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

const AGENTS: Agent[] = [
  {
    id: 'quote',
    name: 'Agente de Cotação',
    type: 'quote',
    icon: <Truck className="h-5 w-5" />,
    contactType: 'carrier',
    description: 'Cotações com transportadoras'
  },
  {
    id: 'customer',
    name: 'Agente de Clientes',
    type: 'customer',
    icon: <Users className="h-5 w-5" />,
    contactType: 'customer',
    description: 'Notificações para clientes'
  }
];

export function AIAgentMessagesTab() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(AGENTS[0]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  // Load conversations for selected agent
  useEffect(() => {
    if (!selectedAgent) return;

    const loadConversations = async () => {
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
            carriers!inner(name, whatsapp)
          `)
          .eq('contact_type', selectedAgent.contactType)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Group by carrier and get latest message
        const grouped = (data || []).reduce((acc: Record<string, any>, msg: any) => {
          const carrierId = msg.carrier_id;
          if (!acc[carrierId] || new Date(msg.created_at) > new Date(acc[carrierId].last_message_at)) {
            acc[carrierId] = {
              id: carrierId,
              contact_name: msg.carriers?.name || 'Desconhecido',
              contact_phone: msg.carriers?.whatsapp || '',
              last_message: msg.message_content,
              last_message_at: msg.created_at,
              unread_count: 0,
              contact_type: msg.contact_type
            };
          }
          return acc;
        }, {});

        setConversations(Object.values(grouped));
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [selectedAgent]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('carrier_conversations')
          .select('*')
          .eq('carrier_id', selectedConversation.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();
  }, [selectedConversation]);

  const filteredConversations = conversations.filter(c =>
    c.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contact_phone.includes(searchTerm)
  );

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

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Column 1: Agents */}
      <Card className="w-64 flex-shrink-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-1">
            {AGENTS.map(agent => (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgent(agent);
                  setSelectedConversation(null);
                  setMessages([]);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                  selectedAgent?.id === agent.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <div className={`p-2 rounded-full ${
                  selectedAgent?.id === agent.id ? 'bg-primary-foreground/20' : 'bg-muted'
                }`}>
                  {agent.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{agent.name}</p>
                  <p className={`text-xs truncate ${
                    selectedAgent?.id === agent.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}>
                    {agent.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Column 2: Conversations */}
      <Card className="w-80 flex-shrink-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversas
          </CardTitle>
          <div className="relative mt-2">
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
          <ScrollArea className="h-[calc(100vh-340px)]">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                Carregando...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Nenhuma conversa encontrada
              </div>
            ) : (
              <div className="divide-y">
                {filteredConversations.map(conversation => (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${
                      selectedConversation?.id === conversation.id
                        ? 'bg-muted'
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
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conversation.last_message}
                      </p>
                    </div>
                    {conversation.unread_count > 0 && (
                      <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center">
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

      {/* Column 3: Conversation Details */}
      <Card className="flex-1">
        {selectedConversation ? (
          <>
            {/* Header */}
            <CardHeader className="pb-3 border-b">
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
                      <span className="flex items-center gap-1">
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
            <CardContent className="p-0 flex-1">
              <ScrollArea className="h-[calc(100vh-400px)] p-4">
                <div className="space-y-3">
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex ${message.message_direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.message_direction === 'outbound'
                            ? 'bg-[#dcf8c6] text-foreground'
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
                  ))}
                </div>
              </ScrollArea>
            </CardContent>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex items-center gap-2">
                <Input placeholder="Digite uma mensagem..." className="flex-1" />
                <Button size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Selecione uma conversa</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
