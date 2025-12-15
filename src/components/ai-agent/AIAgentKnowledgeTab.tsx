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
import { Plus, Pencil, Trash2, Book, Search, Tag } from "lucide-react";
import { toast } from "sonner";

interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
}

interface Props {
  items: KnowledgeItem[];
  onAdd: (item: Omit<KnowledgeItem, 'id' | 'created_at'>) => Promise<{ data: any; error: any }>;
  onUpdate: (id: string, updates: Partial<KnowledgeItem>) => Promise<{ error: any }>;
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
];

export function AIAgentKnowledgeTab({ items, onAdd, onUpdate, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'geral',
    content: '',
    keywords: '',
    priority: 0,
    is_active: true,
  });

  const filteredItems = items.filter(item =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.content.toLowerCase().includes(search.toLowerCase()) ||
    item.keywords?.some(k => k.toLowerCase().includes(search.toLowerCase()))
  );

  const handleOpenDialog = (item?: KnowledgeItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        category: item.category,
        content: item.content,
        keywords: item.keywords?.join(', ') || '',
        priority: item.priority,
        is_active: item.is_active,
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

  const handleToggleActive = async (item: KnowledgeItem) => {
    await onUpdate(item.id, { is_active: !item.is_active });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conhecimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{item.category}</Badge>
                <Badge variant="outline">Prioridade: {item.priority}</Badge>
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
        </div>
      )}
    </div>
  );
}
