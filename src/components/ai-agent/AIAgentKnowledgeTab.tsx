import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Book, Search, Tag, Truck, Users, Globe } from "lucide-react";
import { toast } from "sonner";
import { AgentType, KnowledgeBase } from "@/hooks/useAIAgentAdmin";
import { cn } from "@/lib/utils";

interface Props {
  items: KnowledgeBase[];
  allItems: KnowledgeBase[];
  selectedAgentType: AgentType;
  onAdd: (item: Omit<KnowledgeBase, 'id' | 'created_at'>) => Promise<{ data: any; error: any }>;
  onUpdate: (id: string, updates: Partial<KnowledgeBase>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
}

const CATEGORIES = [
  { value: 'geral', label: 'Geral' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'produtos', label: 'Produtos' },
  { value: 'atendimento', label: 'Atendimento' },
  { value: 'logistica', label: 'Logística' },
  { value: 'garantia', label: 'Garantia' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'frete', label: 'Frete' },
  { value: 'cotacao', label: 'Cotação' },
];

const AGENT_TYPE_OPTIONS = [
  { value: 'general', label: 'Geral (Ambos)', icon: <Globe className="h-4 w-4" />, color: 'text-purple-500' },
  { value: 'carrier', label: 'Transportadoras', icon: <Truck className="h-4 w-4" />, color: 'text-amber-500' },
  { value: 'customer', label: 'Clientes', icon: <Users className="h-4 w-4" />, color: 'text-blue-500' },
];

export function AIAgentKnowledgeTab({ items, allItems, selectedAgentType, onAdd, onUpdate, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [filterAgentType, setFilterAgentType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeBase | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'geral',
    content: '',
    keywords: '',
    priority: 0,
    is_active: true,
    agent_type: selectedAgentType as string,
  });

  // Filter items based on search and agent type filter
  const filteredItems = (filterAgentType === 'all' ? allItems : items).filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase()) ||
      item.keywords?.some(k => k.toLowerCase().includes(search.toLowerCase()));
    
    const matchesFilter = filterAgentType === 'all' || 
      item.agent_type === filterAgentType || 
      item.agent_type === 'general';
    
    return matchesSearch && matchesFilter;
  });

  const handleOpenDialog = (item?: KnowledgeBase) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        category: item.category,
        content: item.content,
        keywords: item.keywords?.join(', ') || '',
        priority: item.priority,
        is_active: item.is_active,
        agent_type: item.agent_type || 'general',
      });
    } else {
      setEditingItem(null);
      setFormData({
        title: '',
        category: 'geral',
        content: '',
        keywords: '',
        priority: 0,
        is_active: true,
        agent_type: selectedAgentType,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const keywordsArray = formData.keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const data = {
      title: formData.title,
      category: formData.category,
      content: formData.content,
      keywords: keywordsArray,
      priority: formData.priority,
      is_active: formData.is_active,
      agent_type: formData.agent_type,
    };

    if (editingItem) {
      const { error } = await onUpdate(editingItem.id, data);
      if (error) {
        toast.error("Erro ao atualizar");
      } else {
        toast.success("Conhecimento atualizado");
        setDialogOpen(false);
      }
    } else {
      const { error } = await onAdd(data);
      if (error) {
        toast.error("Erro ao adicionar");
      } else {
        toast.success("Conhecimento adicionado");
        setDialogOpen(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este conhecimento?")) return;
    
    const { error } = await onDelete(id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Conhecimento excluído");
    }
  };

  const handleToggleActive = async (item: KnowledgeBase) => {
    await onUpdate(item.id, { is_active: !item.is_active });
  };

  const getAgentTypeBadge = (agentType: string) => {
    const option = AGENT_TYPE_OPTIONS.find(o => o.value === agentType);
    if (!option) return null;
    
    return (
      <Badge 
        variant="outline" 
        className={cn("text-xs flex items-center gap-1", option.color)}
      >
        {option.icon}
        {option.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conhecimento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Agent Type Filter */}
          <Tabs 
            value={filterAgentType} 
            onValueChange={setFilterAgentType}
            className="w-auto"
          >
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs px-3">
                Todos
              </TabsTrigger>
              <TabsTrigger value="carrier" className="text-xs px-3">
                <Truck className="h-3 w-3 mr-1" />
                Transp.
              </TabsTrigger>
              <TabsTrigger value="customer" className="text-xs px-3">
                <Users className="h-3 w-3 mr-1" />
                Clientes
              </TabsTrigger>
              <TabsTrigger value="general" className="text-xs px-3">
                <Globe className="h-3 w-3 mr-1" />
                Geral
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Conhecimento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Editar Conhecimento' : 'Novo Conhecimento'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Política de Garantia"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Agent Type Selector */}
              <div className="space-y-2">
                <Label>Agente que usará este conhecimento</Label>
                <Select
                  value={formData.agent_type}
                  onValueChange={(value) => setFormData({ ...formData, agent_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <span className={option.color}>{option.icon}</span>
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  "Geral" será usado por ambos os agentes (Transportadoras e Clientes)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Conteúdo do conhecimento que o agente usará para responder..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label>Palavras-chave (separadas por vírgula)</Label>
                <Input
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  placeholder="garantia, defeito, reparo, troca"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prioridade (0-10)</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    min={0}
                    max={10}
                  />
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label>Ativo</Label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingItem ? 'Salvar Alterações' : 'Adicionar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="flex gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">{filteredItems.length} itens</Badge>
        <Badge variant="outline" className="text-amber-600">
          <Truck className="h-3 w-3 mr-1" />
          {allItems.filter(i => i.agent_type === 'carrier').length} transp.
        </Badge>
        <Badge variant="outline" className="text-blue-600">
          <Users className="h-3 w-3 mr-1" />
          {allItems.filter(i => i.agent_type === 'customer').length} clientes
        </Badge>
        <Badge variant="outline" className="text-purple-600">
          <Globe className="h-3 w-3 mr-1" />
          {allItems.filter(i => i.agent_type === 'general').length} geral
        </Badge>
      </div>

      {/* Items Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredItems.map(item => (
          <Card key={item.id} className={!item.is_active ? 'opacity-60' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Book className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleOpenDialog(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{item.category}</Badge>
                <Badge variant="outline">Prioridade: {item.priority}</Badge>
                {getAgentTypeBadge(item.agent_type)}
                <Switch
                  checked={item.is_active}
                  onCheckedChange={() => handleToggleActive(item)}
                  className="ml-auto"
                />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3">{item.content}</p>
              {item.keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {item.keywords.map((keyword, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {keyword}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Book className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum conhecimento encontrado</p>
          <p className="text-sm">Adicione conhecimento para o agente usar nas respostas</p>
        </div>
      )}
    </div>
  );
}