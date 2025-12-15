import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Book, Search, Tag, Truck, Users, Globe, AlertTriangle, FileText, MapPin, BarChart3, List } from "lucide-react";
import { toast } from "sonner";
import { AgentType, KnowledgeBase } from "@/hooks/useAIAgentAdmin";
import { cn } from "@/lib/utils";
import { AIAgentRAGPanel } from "./AIAgentRAGPanel";

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
  { value: 'status_tracking', label: 'Status e Rastreio' },
  { value: 'atraso', label: 'Procedimento de Atraso' },
  { value: 'extravio', label: 'Extravio/Perda' },
  { value: 'avaria', label: 'Avaria/Dano' },
  { value: 'reentrega', label: 'Reentrega' },
  { value: 'devolucao', label: 'Devolução/Logística Reversa' },
  { value: 'sla', label: 'Políticas de SLA' },
  { value: 'excecao', label: 'Exceções (Greve, Clima)' },
];

const AGENT_TYPE_OPTIONS = [
  { value: 'general', label: 'Geral (Ambos)', icon: <Globe className="h-4 w-4" />, color: 'text-purple-500' },
  { value: 'carrier', label: 'Transportadoras', icon: <Truck className="h-4 w-4" />, color: 'text-amber-500' },
  { value: 'customer', label: 'Clientes', icon: <Users className="h-4 w-4" />, color: 'text-blue-500' },
];

const CARRIERS = [
  { value: '', label: 'Todas (Geral)' },
  { value: 'correios', label: 'Correios' },
  { value: 'jadlog', label: 'Jadlog' },
  { value: 'azul_cargo', label: 'Azul Cargo' },
  { value: 'loggi', label: 'Loggi' },
  { value: 'total_express', label: 'Total Express' },
  { value: 'braspress', label: 'Braspress' },
  { value: 'jamef', label: 'Jamef' },
  { value: 'tnt', label: 'TNT/FedEx' },
  { value: 'outros', label: 'Outras' },
];

const OCCURRENCE_TYPES = [
  { value: '', label: 'Nenhum (Geral)' },
  { value: 'atraso', label: 'Atraso' },
  { value: 'extravio', label: 'Extravio/Perda' },
  { value: 'avaria', label: 'Avaria/Dano' },
  { value: 'reentrega', label: 'Reentrega' },
  { value: 'devolucao', label: 'Devolução' },
  { value: 'endereco_incorreto', label: 'Endereço Incorreto' },
  { value: 'ausente', label: 'Destinatário Ausente' },
  { value: 'recusa', label: 'Recusa' },
];

const SLA_CATEGORIES = [
  { value: '', label: 'Todos' },
  { value: 'dentro_sla', label: 'Dentro do SLA' },
  { value: 'warning_sla', label: 'Alerta SLA (próximo)' },
  { value: 'fora_sla', label: 'Fora do SLA' },
];

const DOCUMENT_TYPES = [
  { value: 'procedimento', label: 'Procedimento' },
  { value: 'politica', label: 'Política' },
  { value: 'script', label: 'Script de Atendimento' },
  { value: 'contrato', label: 'Contrato/SLA' },
  { value: 'faq', label: 'FAQ' },
  { value: 'manual', label: 'Manual' },
];

const REGIONS = [
  { value: 'sul', label: 'Sul' },
  { value: 'sudeste', label: 'Sudeste' },
  { value: 'centro_oeste', label: 'Centro-Oeste' },
  { value: 'nordeste', label: 'Nordeste' },
  { value: 'norte', label: 'Norte' },
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
    // Logistics fields
    carrier_name: '',
    occurrence_type: '',
    sla_category: '',
    regions: [] as string[],
    document_type: 'procedimento',
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
        carrier_name: (item as any).carrier_name || '',
        occurrence_type: (item as any).occurrence_type || '',
        sla_category: (item as any).sla_category || '',
        regions: (item as any).regions || [],
        document_type: (item as any).document_type || 'procedimento',
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
        carrier_name: '',
        occurrence_type: '',
        sla_category: '',
        regions: [],
        document_type: 'procedimento',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const keywordsArray = formData.keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const data: any = {
      title: formData.title,
      category: formData.category,
      content: formData.content,
      keywords: keywordsArray,
      priority: formData.priority,
      is_active: formData.is_active,
      agent_type: formData.agent_type,
      // Logistics fields
      carrier_name: formData.carrier_name || null,
      occurrence_type: formData.occurrence_type || null,
      sla_category: formData.sla_category || null,
      regions: formData.regions.length > 0 ? formData.regions : null,
      document_type: formData.document_type,
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

  const toggleRegion = (region: string) => {
    setFormData(prev => ({
      ...prev,
      regions: prev.regions.includes(region)
        ? prev.regions.filter(r => r !== region)
        : [...prev.regions, region]
    }));
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

  const isLogisticsCategory = ['logistica', 'frete', 'status_tracking', 'atraso', 'extravio', 'avaria', 'reentrega', 'devolucao', 'sla', 'excecao'].includes(formData.category);

  const [viewMode, setViewMode] = useState<'stats' | 'list'>('list');

  return (
    <div className="space-y-4">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1">
          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'stats' | 'list')} className="w-auto">
            <TabsList className="h-9">
              <TabsTrigger value="stats" className="text-xs px-3">
                <BarChart3 className="h-3 w-3 mr-1" />
                Estatísticas
              </TabsTrigger>
              <TabsTrigger value="list" className="text-xs px-3">
                <List className="h-3 w-3 mr-1" />
                Documentos
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {viewMode === 'list' && (
            <>
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
            </>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Conhecimento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Editar Conhecimento' : 'Novo Conhecimento'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Basic Info */}
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

              {/* Agent Type & Document Type */}
              <div className="grid gap-4 md:grid-cols-2">
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
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Documento</Label>
                  <Select
                    value={formData.document_type}
                    onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Logistics Fields - Show when logistics category selected */}
              {isLogisticsCategory && (
                <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <Truck className="h-4 w-4" />
                      Metadados Logísticos (RAG Contextual)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          Transportadora
                        </Label>
                        <Select
                          value={formData.carrier_name}
                          onValueChange={(value) => setFormData({ ...formData, carrier_name: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {CARRIERS.map(carrier => (
                              <SelectItem key={carrier.value} value={carrier.value}>
                                {carrier.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Tipo de Ocorrência
                        </Label>
                        <Select
                          value={formData.occurrence_type}
                          onValueChange={(value) => setFormData({ ...formData, occurrence_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {OCCURRENCE_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Categoria SLA</Label>
                        <Select
                          value={formData.sla_category}
                          onValueChange={(value) => setFormData({ ...formData, sla_category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {SLA_CATEGORIES.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Regions */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Regiões (opcional)
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {REGIONS.map(region => (
                          <Badge
                            key={region.value}
                            variant={formData.regions.includes(region.value) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleRegion(region.value)}
                          >
                            {region.label}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Clique para selecionar regiões onde este conhecimento se aplica
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Content */}
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Conteúdo do conhecimento que o agente usará para responder..."
                  rows={6}
                />
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <Label>Palavras-chave (separadas por vírgula)</Label>
                <Input
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  placeholder="garantia, defeito, reparo, troca"
                />
              </div>

              {/* Priority & Active */}
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
      <div className="flex gap-2 text-sm text-muted-foreground flex-wrap">
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
        <Badge variant="outline" className="text-orange-600">
          <FileText className="h-3 w-3 mr-1" />
          {allItems.filter(i => (i as any).carrier_name).length} c/ transportadora
        </Badge>
      </div>

      {/* Render Stats Panel or Document List based on viewMode */}
      {viewMode === 'stats' ? (
        <AIAgentRAGPanel 
          items={allItems} 
          selectedAgentType={selectedAgentType} 
          onAddClick={() => handleOpenDialog()}
        />
      ) : (
        <>

      {/* Items Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredItems.map(item => {
          const itemData = item as any;
          return (
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
                  <Badge variant="outline">P: {item.priority}</Badge>
                  {getAgentTypeBadge(item.agent_type)}
                  {itemData.carrier_name && (
                    <Badge variant="outline" className="text-amber-600">
                      <Truck className="h-3 w-3 mr-1" />
                      {CARRIERS.find(c => c.value === itemData.carrier_name)?.label || itemData.carrier_name}
                    </Badge>
                  )}
                  {itemData.occurrence_type && (
                    <Badge variant="outline" className="text-red-600">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {OCCURRENCE_TYPES.find(o => o.value === itemData.occurrence_type)?.label || itemData.occurrence_type}
                    </Badge>
                  )}
                  {itemData.sla_category && (
                    <Badge 
                      variant="outline" 
                      className={cn(
                        itemData.sla_category === 'fora_sla' && 'text-red-600 border-red-300',
                        itemData.sla_category === 'warning_sla' && 'text-orange-600 border-orange-300',
                        itemData.sla_category === 'dentro_sla' && 'text-green-600 border-green-300'
                      )}
                    >
                      {SLA_CATEGORIES.find(s => s.value === itemData.sla_category)?.label}
                    </Badge>
                  )}
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
                    {item.keywords.slice(0, 5).map((keyword, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {keyword}
                      </Badge>
                    ))}
                    {item.keywords.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{item.keywords.length - 5}
                      </Badge>
                    )}
                  </div>
                )}
                {itemData.regions?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {itemData.regions.map((region: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {REGIONS.find(r => r.value === region)?.label || region}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredItems.length === 0 && viewMode === 'list' && (
        <div className="text-center py-12 text-muted-foreground">
          <Book className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum conhecimento encontrado</p>
          <p className="text-sm">Adicione conhecimento para o agente usar nas respostas</p>
        </div>
      )}
      </>
      )}
    </div>
  );
}
