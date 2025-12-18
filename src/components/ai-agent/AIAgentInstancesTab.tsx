import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Bot, Plus, Edit, Trash2, Phone, Settings, 
  Sparkles, Brain, Zap, Users, Package, Headphones,
  MessageCircle, Ban, User
} from 'lucide-react';

interface AgentInstance {
  id: string;
  instance_name: string;
  agent_type: string;
  whatsapp_number: string | null;
  whatsapp_instance_id: string | null;
  description: string | null;
  is_active: boolean;
  personality_traits: any;
  specializations: string[];
  response_style: any;
  emoji_library: string[];
  max_message_length: number;
  created_at: string;
  // New identity fields
  system_prompt: string | null;
  auto_reply_enabled: boolean;
  personality: string | null;
  tone_of_voice: string | null;
  language: string | null;
  custom_instructions: string | null;
  signature: string | null;
  use_signature: boolean;
  llm_model: string | null;
  auto_reply_delay_ms: number;
  conversation_style: string | null;
  closing_style: string | null;
  avoid_repetition: boolean;
  forbidden_phrases: string[] | null;
}

const AGENT_TYPE_CONFIG = {
  carrier: { label: 'Logística', icon: Package, color: 'bg-blue-500' },
  customer: { label: 'Cliente', icon: Users, color: 'bg-green-500' },
  after_sales: { label: 'Pós-Venda', icon: Headphones, color: 'bg-purple-500' },
  commercial: { label: 'Comercial', icon: Zap, color: 'bg-amber-500' },
  general: { label: 'Geral', icon: Bot, color: 'bg-gray-500' },
};

const TONE_OPTIONS = [
  { value: 'formal', label: 'Formal' },
  { value: 'informal', label: 'Informal' },
  { value: 'amigavel', label: 'Amigável' },
  { value: 'profissional', label: 'Profissional' },
];

const CONVERSATION_STYLE_OPTIONS = [
  { value: 'chatty', label: '🗣️ Conversacional' },
  { value: 'concise', label: '📝 Conciso' },
  { value: 'formal', label: '👔 Formal' },
];

const CLOSING_STYLE_OPTIONS = [
  { value: 'varied', label: '🎲 Variado' },
  { value: 'fixed', label: '📌 Fixo' },
  { value: 'none', label: '❌ Nenhum' },
];

const LLM_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Rápido)' },
  { value: 'gpt-4o', label: 'GPT-4o (Avançado)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
];

export default function AIAgentInstancesTab() {
  const [instances, setInstances] = useState<AgentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<AgentInstance | null>(null);
  const [activeTab, setActiveTab] = useState('identity');
  
  // Form state - organized by sections
  const [formData, setFormData] = useState({
    // Basic Info
    instance_name: '',
    agent_type: 'general',
    whatsapp_number: '',
    description: '',
    is_active: true,
    
    // Identity
    personality: 'Profissional, amigável e prestativo',
    tone_of_voice: 'informal',
    language: 'pt-BR',
    signature: '',
    use_signature: false,
    
    // AI Configuration
    system_prompt: '',
    custom_instructions: '',
    llm_model: 'gpt-4o-mini',
    auto_reply_enabled: true,
    auto_reply_delay_ms: 1000,
    
    // Conversation Style
    conversation_style: 'chatty',
    closing_style: 'varied',
    avoid_repetition: true,
    forbidden_phrases: 'Qualquer dúvida, estou à disposição\nFico no aguardo\nAbraço, Equipe Imply',
    
    // Response Style
    specializations: '',
    emoji_library: '😊,👍,✅,📦,🚚',
    max_message_length: 150,
  });

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agent_instances')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setInstances((data || []) as AgentInstance[]);
    } catch (error) {
      console.error('Error loading instances:', error);
      toast.error('Erro ao carregar agentes');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      instance_name: '',
      agent_type: 'general',
      whatsapp_number: '',
      description: '',
      is_active: true,
      personality: 'Profissional, amigável e prestativo',
      tone_of_voice: 'informal',
      language: 'pt-BR',
      signature: '',
      use_signature: false,
      system_prompt: '',
      custom_instructions: '',
      llm_model: 'gpt-4o-mini',
      auto_reply_enabled: true,
      auto_reply_delay_ms: 1000,
      conversation_style: 'chatty',
      closing_style: 'varied',
      avoid_repetition: true,
      forbidden_phrases: 'Qualquer dúvida, estou à disposição\nFico no aguardo\nAbraço, Equipe Imply',
      specializations: '',
      emoji_library: '😊,👍,✅,📦,🚚',
      max_message_length: 150,
    });
    setEditingInstance(null);
    setActiveTab('identity');
  };

  const openEditDialog = (instance: AgentInstance) => {
    setEditingInstance(instance);
    setFormData({
      instance_name: instance.instance_name,
      agent_type: instance.agent_type,
      whatsapp_number: instance.whatsapp_number || '',
      description: instance.description || '',
      is_active: instance.is_active,
      personality: instance.personality || 'Profissional, amigável e prestativo',
      tone_of_voice: instance.tone_of_voice || 'informal',
      language: instance.language || 'pt-BR',
      signature: instance.signature || '',
      use_signature: instance.use_signature || false,
      system_prompt: instance.system_prompt || '',
      custom_instructions: instance.custom_instructions || '',
      llm_model: instance.llm_model || 'gpt-4o-mini',
      auto_reply_enabled: instance.auto_reply_enabled ?? true,
      auto_reply_delay_ms: instance.auto_reply_delay_ms || 1000,
      conversation_style: instance.conversation_style || 'chatty',
      closing_style: instance.closing_style || 'varied',
      avoid_repetition: instance.avoid_repetition ?? true,
      forbidden_phrases: instance.forbidden_phrases?.join('\n') || '',
      specializations: instance.specializations?.join(', ') || '',
      emoji_library: instance.emoji_library?.join(',') || '😊,👍,✅',
      max_message_length: instance.max_message_length || 150,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        instance_name: formData.instance_name,
        agent_type: formData.agent_type,
        whatsapp_number: formData.whatsapp_number || null,
        description: formData.description || null,
        is_active: formData.is_active,
        // Identity
        personality: formData.personality,
        tone_of_voice: formData.tone_of_voice,
        language: formData.language,
        signature: formData.signature || null,
        use_signature: formData.use_signature,
        // AI Config
        system_prompt: formData.system_prompt || null,
        custom_instructions: formData.custom_instructions || null,
        llm_model: formData.llm_model,
        auto_reply_enabled: formData.auto_reply_enabled,
        auto_reply_delay_ms: formData.auto_reply_delay_ms,
        // Conversation Style
        conversation_style: formData.conversation_style,
        closing_style: formData.closing_style,
        avoid_repetition: formData.avoid_repetition,
        forbidden_phrases: formData.forbidden_phrases.split('\n').map(s => s.trim()).filter(Boolean),
        // Response Style
        specializations: formData.specializations.split(',').map(s => s.trim()).filter(Boolean),
        emoji_library: formData.emoji_library.split(',').map(s => s.trim()).filter(Boolean),
        max_message_length: formData.max_message_length,
        response_style: {
          tone: formData.tone_of_voice,
          formality: formData.tone_of_voice === 'formal' ? 'formal' : 'semi-formal',
          empathy_level: 'medium',
        },
      };

      if (editingInstance) {
        const { error } = await supabase
          .from('ai_agent_instances')
          .update(payload)
          .eq('id', editingInstance.id);
        if (error) throw error;
        toast.success('Agente atualizado!');
      } else {
        const { error } = await supabase
          .from('ai_agent_instances')
          .insert(payload);
        if (error) throw error;
        toast.success('Agente criado!');
      }

      setDialogOpen(false);
      resetForm();
      loadInstances();
    } catch (error) {
      console.error('Error saving instance:', error);
      toast.error('Erro ao salvar agente');
    }
  };

  const toggleActive = async (instance: AgentInstance) => {
    try {
      const { error } = await supabase
        .from('ai_agent_instances')
        .update({ is_active: !instance.is_active })
        .eq('id', instance.id);
      if (error) throw error;
      toast.success(instance.is_active ? 'Agente desativado' : 'Agente ativado');
      loadInstances();
    } catch (error) {
      console.error('Error toggling instance:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const deleteInstance = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este agente?')) return;
    try {
      const { error } = await supabase
        .from('ai_agent_instances')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Agente excluído');
      loadInstances();
    } catch (error) {
      console.error('Error deleting instance:', error);
      toast.error('Erro ao excluir agente');
    }
  };

  const getAgentConfig = (type: string) => {
    return AGENT_TYPE_CONFIG[type as keyof typeof AGENT_TYPE_CONFIG] || AGENT_TYPE_CONFIG.general;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Agentes de IA
          </h2>
          <p className="text-muted-foreground">
            Configure múltiplos agentes, cada um com sua identidade, personalidade e número WhatsApp
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Agente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                {editingInstance ? 'Editar Agente' : 'Novo Agente de IA'}
              </DialogTitle>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="identity" className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Identidade
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex items-center gap-1">
                  <Brain className="h-4 w-4" />
                  IA
                </TabsTrigger>
                <TabsTrigger value="style" className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  Estilo
                </TabsTrigger>
                <TabsTrigger value="config" className="flex items-center gap-1">
                  <Settings className="h-4 w-4" />
                  Config
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto pr-2">
                {/* Tab: Identity */}
                <TabsContent value="identity" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Agente *</Label>
                      <Input
                        value={formData.instance_name}
                        onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })}
                        placeholder="Ex: Ana - Pós-Venda"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Agente *</Label>
                      <Select
                        value={formData.agent_type}
                        onValueChange={(value) => setFormData({ ...formData, agent_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(AGENT_TYPE_CONFIG).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <config.icon className="h-4 w-4" />
                                {config.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Número WhatsApp Dedicado</Label>
                    <Input
                      value={formData.whatsapp_number}
                      onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                      placeholder="5551999999999"
                    />
                    <p className="text-xs text-muted-foreground">Este agente responderá mensagens recebidas neste número</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Personalidade</Label>
                    <Textarea
                      value={formData.personality}
                      onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                      placeholder="Descreva a personalidade do agente..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tom de Voz</Label>
                      <Select
                        value={formData.tone_of_voice}
                        onValueChange={(value) => setFormData({ ...formData, tone_of_voice: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TONE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Idioma</Label>
                      <Select
                        value={formData.language}
                        onValueChange={(value) => setFormData({ ...formData, language: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição / Propósito</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descreva o propósito e especialidades deste agente..."
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                    <div>
                      <Label>Usar Assinatura</Label>
                      <p className="text-xs text-muted-foreground">Incluir assinatura no final das mensagens</p>
                    </div>
                    <Switch
                      checked={formData.use_signature}
                      onCheckedChange={(checked) => setFormData({ ...formData, use_signature: checked })}
                    />
                  </div>

                  {formData.use_signature && (
                    <div className="space-y-2">
                      <Label>Assinatura</Label>
                      <Input
                        value={formData.signature}
                        onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                        placeholder="Ex: Equipe Imply"
                      />
                    </div>
                  )}
                </TabsContent>

                {/* Tab: AI Configuration */}
                <TabsContent value="ai" className="space-y-4 mt-0">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <Label className="text-base">Habilitar Auto-Resposta</Label>
                        <p className="text-sm text-muted-foreground">
                          Este agente responderá automaticamente usando IA
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.auto_reply_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, auto_reply_enabled: checked })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Modelo de IA</Label>
                      <Select
                        value={formData.llm_model}
                        onValueChange={(value) => setFormData({ ...formData, llm_model: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LLM_MODELS.map((model) => (
                            <SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Delay antes de responder (ms)</Label>
                      <Input
                        type="number"
                        value={formData.auto_reply_delay_ms}
                        onChange={(e) => setFormData({ ...formData, auto_reply_delay_ms: parseInt(e.target.value) || 1000 })}
                        min={0}
                        max={10000}
                        step={500}
                      />
                      <p className="text-xs text-muted-foreground">Simula digitação natural</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      System Prompt (Instruções Base)
                    </Label>
                    <Textarea
                      value={formData.system_prompt}
                      onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                      placeholder="Você é um assistente especializado em..."
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Define o comportamento base do agente. Use linguagem clara e direta.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Instruções Personalizadas Adicionais</Label>
                    <Textarea
                      value={formData.custom_instructions}
                      onChange={(e) => setFormData({ ...formData, custom_instructions: e.target.value })}
                      placeholder="Regras específicas, informações da empresa, etc..."
                      rows={4}
                    />
                  </div>
                </TabsContent>

                {/* Tab: Conversation Style */}
                <TabsContent value="style" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Estilo de Conversa</Label>
                      <Select
                        value={formData.conversation_style}
                        onValueChange={(value) => setFormData({ ...formData, conversation_style: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONVERSATION_STYLE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Estilo de Fechamento</Label>
                      <Select
                        value={formData.closing_style}
                        onValueChange={(value) => setFormData({ ...formData, closing_style: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CLOSING_STYLE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Evitar repetição de expressões</span>
                    </div>
                    <Switch
                      checked={formData.avoid_repetition}
                      onCheckedChange={(checked) => setFormData({ ...formData, avoid_repetition: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-red-500" />
                      Frases Proibidas
                    </Label>
                    <Textarea
                      value={formData.forbidden_phrases}
                      onChange={(e) => setFormData({ ...formData, forbidden_phrases: e.target.value })}
                      placeholder="Qualquer dúvida, estou à disposição&#10;Fico no aguardo"
                      rows={4}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Uma frase por linha. O agente NUNCA usará estas frases.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Biblioteca de Emojis</Label>
                      <Input
                        value={formData.emoji_library}
                        onChange={(e) => setFormData({ ...formData, emoji_library: e.target.value })}
                        placeholder="😊,👍,✅,📦"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tamanho Máximo (caracteres)</Label>
                      <Input
                        type="number"
                        value={formData.max_message_length}
                        onChange={(e) => setFormData({ ...formData, max_message_length: parseInt(e.target.value) || 150 })}
                        min={50}
                        max={500}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Additional Config */}
                <TabsContent value="config" className="space-y-4 mt-0">
                  <div className="space-y-2">
                    <Label>Especializações (separadas por vírgula)</Label>
                    <Input
                      value={formData.specializations}
                      onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
                      placeholder="garantia, suporte, troca, devolução, rastreamento"
                    />
                    <p className="text-xs text-muted-foreground">
                      Define os tópicos que este agente domina
                    </p>
                  </div>

                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resumo da Configuração</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tipo:</span>
                        <Badge variant="secondary">{getAgentConfig(formData.agent_type).label}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Auto-resposta:</span>
                        <Badge variant={formData.auto_reply_enabled ? "default" : "outline"}>
                          {formData.auto_reply_enabled ? 'Ativa' : 'Desativada'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Modelo:</span>
                        <span>{formData.llm_model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tom:</span>
                        <span>{formData.tone_of_voice}</span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={!formData.instance_name}>
                  {editingInstance ? 'Salvar Alterações' : 'Criar Agente'}
                </Button>
              </div>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Instances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {instances.map((instance) => {
          const config = getAgentConfig(instance.agent_type);
          const IconComponent = config.icon;
          
          return (
            <Card key={instance.id} className={`relative ${!instance.is_active ? 'opacity-60' : ''}`}>
              <div className={`absolute top-0 left-0 right-0 h-1 ${config.color} rounded-t-lg`} />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${config.color} text-white`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{instance.instance_name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {config.label}
                        </Badge>
                        {instance.auto_reply_enabled && (
                          <Badge variant="outline" className="text-xs border-green-500/50 text-green-600">
                            <Sparkles className="h-3 w-3 mr-1" />
                            IA Ativa
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={instance.is_active}
                    onCheckedChange={() => toggleActive(instance)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {instance.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {instance.description}
                  </p>
                )}

                {instance.whatsapp_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-green-500" />
                    <span className="font-mono">{instance.whatsapp_number}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Brain className="h-3 w-3" />
                  <span>{instance.llm_model || 'gpt-4o-mini'}</span>
                  <span>•</span>
                  <span>{instance.tone_of_voice || 'informal'}</span>
                </div>

                {instance.specializations?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {instance.specializations.slice(0, 4).map((spec, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {spec}
                      </Badge>
                    ))}
                    {instance.specializations.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{instance.specializations.length - 4}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(instance)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteInstance(instance.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {instances.length === 0 && (
        <Card className="p-8 text-center">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum agente configurado</h3>
          <p className="text-muted-foreground mb-4">
            Crie seu primeiro agente de IA para começar a automatizar atendimentos
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeiro Agente
          </Button>
        </Card>
      )}
    </div>
  );
}
