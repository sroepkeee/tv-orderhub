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
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Bot, Plus, Edit, Trash2, Phone, MessageSquare, Settings, 
  Sparkles, Brain, Heart, Zap, Users, Package, Headphones 
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
}

const AGENT_TYPE_CONFIG = {
  carrier: { label: 'Logística', icon: Package, color: 'bg-blue-500' },
  customer: { label: 'Cliente', icon: Users, color: 'bg-green-500' },
  after_sales: { label: 'Pós-Venda', icon: Headphones, color: 'bg-purple-500' },
  commercial: { label: 'Comercial', icon: Zap, color: 'bg-amber-500' },
  general: { label: 'Geral', icon: Bot, color: 'bg-gray-500' },
};

const TONE_OPTIONS = [
  { value: 'professional', label: 'Profissional' },
  { value: 'friendly', label: 'Amigável' },
  { value: 'empathetic', label: 'Empático' },
  { value: 'casual', label: 'Casual' },
];

const FORMALITY_OPTIONS = [
  { value: 'formal', label: 'Formal' },
  { value: 'semi-formal', label: 'Semi-formal' },
  { value: 'informal', label: 'Informal' },
];

const EMPATHY_OPTIONS = [
  { value: 'low', label: 'Baixo' },
  { value: 'medium', label: 'Médio' },
  { value: 'high', label: 'Alto' },
];

export default function AIAgentInstancesTab() {
  const [instances, setInstances] = useState<AgentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<AgentInstance | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    instance_name: '',
    agent_type: 'general',
    whatsapp_number: '',
    description: '',
    specializations: '',
    emoji_library: '😊,👍,✅,📦,🚚',
    max_message_length: 150,
    tone: 'professional',
    formality: 'semi-formal',
    empathy_level: 'medium',
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
      setInstances(data || []);
    } catch (error) {
      console.error('Error loading instances:', error);
      toast.error('Erro ao carregar instâncias');
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
      specializations: '',
      emoji_library: '😊,👍,✅,📦,🚚',
      max_message_length: 150,
      tone: 'professional',
      formality: 'semi-formal',
      empathy_level: 'medium',
    });
    setEditingInstance(null);
  };

  const openEditDialog = (instance: AgentInstance) => {
    setEditingInstance(instance);
    setFormData({
      instance_name: instance.instance_name,
      agent_type: instance.agent_type,
      whatsapp_number: instance.whatsapp_number || '',
      description: instance.description || '',
      specializations: instance.specializations?.join(', ') || '',
      emoji_library: instance.emoji_library?.join(',') || '😊,👍,✅',
      max_message_length: instance.max_message_length || 150,
      tone: String(instance.response_style?.tone || 'professional'),
      formality: String(instance.response_style?.formality || 'semi-formal'),
      empathy_level: String(instance.response_style?.empathy_level || 'medium'),
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
        specializations: formData.specializations.split(',').map(s => s.trim()).filter(Boolean),
        emoji_library: formData.emoji_library.split(',').map(s => s.trim()).filter(Boolean),
        max_message_length: formData.max_message_length,
        response_style: {
          tone: formData.tone,
          formality: formData.formality,
          empathy_level: formData.empathy_level,
        },
      };

      if (editingInstance) {
        const { error } = await supabase
          .from('ai_agent_instances')
          .update(payload)
          .eq('id', editingInstance.id);
        if (error) throw error;
        toast.success('Instância atualizada!');
      } else {
        const { error } = await supabase
          .from('ai_agent_instances')
          .insert(payload);
        if (error) throw error;
        toast.success('Instância criada!');
      }

      setDialogOpen(false);
      resetForm();
      loadInstances();
    } catch (error) {
      console.error('Error saving instance:', error);
      toast.error('Erro ao salvar instância');
    }
  };

  const toggleActive = async (instance: AgentInstance) => {
    try {
      const { error } = await supabase
        .from('ai_agent_instances')
        .update({ is_active: !instance.is_active })
        .eq('id', instance.id);
      if (error) throw error;
      toast.success(instance.is_active ? 'Instância desativada' : 'Instância ativada');
      loadInstances();
    } catch (error) {
      console.error('Error toggling instance:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const deleteInstance = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta instância?')) return;
    try {
      const { error } = await supabase
        .from('ai_agent_instances')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Instância excluída');
      loadInstances();
    } catch (error) {
      console.error('Error deleting instance:', error);
      toast.error('Erro ao excluir instância');
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
            Instâncias de Agentes
          </h2>
          <p className="text-muted-foreground">
            Gerencie múltiplos agentes de IA, cada um com sua personalidade e número WhatsApp
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Instância
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingInstance ? 'Editar Instância' : 'Nova Instância de Agente'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da Instância *</Label>
                  <Input
                    value={formData.instance_name}
                    onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })}
                    placeholder="Ex: Agente Pós-Venda"
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
                <Label>Número WhatsApp</Label>
                <Input
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                  placeholder="5551999999999"
                />
                <p className="text-xs text-muted-foreground">Número dedicado para este agente (com código do país)</p>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o propósito e especialidades deste agente..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Especializações (separadas por vírgula)</Label>
                <Input
                  value={formData.specializations}
                  onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
                  placeholder="garantia, suporte, troca, devolução"
                />
              </div>

              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Estilo de Resposta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Tom</Label>
                      <Select
                        value={formData.tone}
                        onValueChange={(value) => setFormData({ ...formData, tone: value })}
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
                      <Label>Formalidade</Label>
                      <Select
                        value={formData.formality}
                        onValueChange={(value) => setFormData({ ...formData, formality: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FORMALITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Empatia</Label>
                      <Select
                        value={formData.empathy_level}
                        onValueChange={(value) => setFormData({ ...formData, empathy_level: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EMPATHY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={!formData.instance_name}>
                  {editingInstance ? 'Salvar Alterações' : 'Criar Instância'}
                </Button>
              </div>
            </div>
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
                      <Badge variant="secondary" className="text-xs">
                        {config.label}
                      </Badge>
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

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Heart className="h-3 w-3" />
                  <span>Empatia: {String(instance.response_style?.empathy_level || 'medium')}</span>
                  <span>•</span>
                  <MessageSquare className="h-3 w-3" />
                  <span>Max: {instance.max_message_length} chars</span>
                </div>

                {instance.emoji_library?.length > 0 && (
                  <div className="text-lg">
                    {instance.emoji_library.slice(0, 8).join(' ')}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(instance)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteInstance(instance.id)}
                  >
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
          <p className="text-muted-foreground">Nenhuma instância de agente criada</p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeira Instância
          </Button>
        </Card>
      )}
    </div>
  );
}
