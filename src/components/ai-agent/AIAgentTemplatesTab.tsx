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
import { Plus, Pencil, Trash2, FileText, MessageSquare, Mail, Copy, Eye } from "lucide-react";
import { toast } from "sonner";

interface NotificationTemplate {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  content: string;
  variables: string[];
  category: string;
  is_active: boolean;
}

interface Props {
  templates: NotificationTemplate[];
  onAdd: (template: Omit<NotificationTemplate, 'id'>) => Promise<{ data: any; error: any }>;
  onUpdate: (id: string, updates: Partial<NotificationTemplate>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
}

const AVAILABLE_VARIABLES = [
  { key: 'customer_name', label: 'Nome do Cliente' },
  { key: 'order_number', label: 'Número do Pedido' },
  { key: 'items_count', label: 'Quantidade de Itens' },
  { key: 'delivery_date', label: 'Data de Entrega' },
  { key: 'carrier_name', label: 'Transportadora' },
  { key: 'tracking_code', label: 'Código de Rastreio' },
  { key: 'status', label: 'Status Atual' },
  { key: 'signature', label: 'Assinatura' },
];

const CATEGORIES = [
  { value: 'status', label: 'Atualização de Status' },
  { value: 'reminder', label: 'Lembrete' },
  { value: 'confirmation', label: 'Confirmação' },
  { value: 'custom', label: 'Personalizado' },
];

export function AIAgentTemplatesTab({ templates, onAdd, onUpdate, onDelete }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    channel: 'whatsapp',
    subject: '',
    content: '',
    category: 'status',
    is_active: true,
  });

  const handleOpenDialog = (template?: NotificationTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        channel: template.channel,
        subject: template.subject || '',
        content: template.content,
        category: template.category,
        is_active: template.is_active,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        channel: 'whatsapp',
        subject: '',
        content: '',
        category: 'status',
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Extrair variáveis do conteúdo
    const variableMatches = formData.content.match(/\{\{(\w+)\}\}/g) || [];
    const variables = variableMatches.map(v => v.replace(/\{\{|\}\}/g, ''));

    const data = {
      name: formData.name,
      channel: formData.channel,
      subject: formData.channel === 'email' ? formData.subject : null,
      content: formData.content,
      variables,
      category: formData.category,
      is_active: formData.is_active,
    };

    if (editingTemplate) {
      const { error } = await onUpdate(editingTemplate.id, data);
      if (error) {
        toast.error("Erro ao atualizar template");
      } else {
        toast.success("Template atualizado");
        setDialogOpen(false);
      }
    } else {
      const { error } = await onAdd(data);
      if (error) {
        toast.error("Erro ao criar template");
      } else {
        toast.success("Template criado");
        setDialogOpen(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    
    const { error } = await onDelete(id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Template excluído");
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = formData.content.substring(0, start) + `{{${variable}}}` + formData.content.substring(end);
      setFormData({ ...formData, content: newContent });
    } else {
      setFormData({ ...formData, content: formData.content + `{{${variable}}}` });
    }
  };

  const duplicateTemplate = async (template: NotificationTemplate) => {
    const { error } = await onAdd({
      ...template,
      name: `${template.name} (Cópia)`,
    });
    if (error) {
      toast.error("Erro ao duplicar");
    } else {
      toast.success("Template duplicado");
    }
  };

  const renderPreview = (content: string) => {
    let preview = content;
    const sampleData: Record<string, string> = {
      customer_name: 'João Silva',
      order_number: '139502',
      items_count: '3',
      delivery_date: '25/12/2025',
      carrier_name: 'Correios',
      tracking_code: 'BR123456789',
      status: 'Em Trânsito',
      signature: 'Equipe Imply',
    };
    
    for (const [key, value] of Object.entries(sampleData)) {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    
    return preview;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Templates de Mensagem</h3>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie templates para WhatsApp e E-mail
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Editar Template' : 'Novo Template de Mensagem'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Nome do Template</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Pedido Entregue"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Canal</Label>
                  <Select
                    value={formData.channel}
                    onValueChange={(value) => setFormData({ ...formData, channel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                          WhatsApp
                        </div>
                      </SelectItem>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-600" />
                          E-mail
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
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

              {formData.channel === 'email' && (
                <div className="space-y-2">
                  <Label>Assunto do E-mail</Label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Ex: Seu pedido #{{order_number}} foi entregue!"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Variáveis Disponíveis</Label>
                <div className="flex flex-wrap gap-1">
                  {AVAILABLE_VARIABLES.map(v => (
                    <Button
                      key={v.key}
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(v.key)}
                      className="text-xs"
                    >
                      {`{{${v.key}}}`}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Conteúdo da Mensagem</Label>
                <Textarea
                  id="template-content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder={formData.channel === 'whatsapp' 
                    ? "Use *negrito*, _itálico_ e emojis 😊" 
                    : "Use HTML: <b>negrito</b>, <i>itálico</i>, <p>parágrafo</p>"}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {formData.channel === 'whatsapp' 
                    ? 'Formatação WhatsApp: *negrito* _itálico_ ~tachado~' 
                    : 'Formatação HTML: <b>, <i>, <p>, <ul>, <li>, etc.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label>Template Ativo</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              {/* Preview */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <Label className="text-sm font-medium mb-2 block">Pré-visualização</Label>
                <div className={`p-3 rounded-lg ${formData.channel === 'whatsapp' ? 'bg-green-50 dark:bg-green-950/30' : 'bg-white dark:bg-gray-900'}`}>
                  {formData.channel === 'email' && formData.subject && (
                    <div className="font-semibold mb-2 pb-2 border-b">
                      {renderPreview(formData.subject)}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm">
                    {renderPreview(formData.content) || 'Digite o conteúdo para ver a pré-visualização...'}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map(template => (
          <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {template.channel === 'whatsapp' 
                    ? <MessageSquare className="h-4 w-4 text-green-600" />
                    : <Mail className="h-4 w-4 text-blue-600" />
                  }
                  <CardTitle className="text-base">{template.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setPreviewTemplate(template);
                      setPreviewOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => duplicateTemplate(template)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleOpenDialog(template)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={template.channel === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                  {template.channel}
                </Badge>
                <Badge variant="outline">{template.category}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                {template.content}
              </p>
              {template.variables.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {template.variables.map((v, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum template configurado</p>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pré-visualização: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className={`p-4 rounded-lg ${previewTemplate.channel === 'whatsapp' ? 'bg-green-50 dark:bg-green-950/30' : 'bg-gray-50 dark:bg-gray-900'}`}>
              {previewTemplate.channel === 'email' && previewTemplate.subject && (
                <div className="font-semibold mb-2 pb-2 border-b">
                  {renderPreview(previewTemplate.subject)}
                </div>
              )}
              <div className="whitespace-pre-wrap">
                {renderPreview(previewTemplate.content)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
