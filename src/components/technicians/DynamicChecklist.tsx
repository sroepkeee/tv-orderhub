import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Package, FileText, Key, Folder, DollarSign, 
  ChevronDown, ChevronRight, Camera, Check, X, 
  AlertTriangle, Loader2, Upload
} from 'lucide-react';
import { useProcessChecklist } from '@/hooks/useReturnProcesses';
import { 
  ProcessChecklistItem, 
  ChecklistCategory, 
  ItemCondition,
  CATEGORY_LABELS, 
  CONDITION_LABELS, 
  CONDITION_COLORS 
} from '@/types/returnProcess';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DynamicChecklistProps {
  processId: string;
  readOnly?: boolean;
  onComplete?: () => void;
}

const CATEGORY_ICONS: Record<ChecklistCategory, React.ElementType> = {
  itens_fisicos: Package,
  administrativo: FileText,
  acessos: Key,
  documentos: Folder,
  financeiro: DollarSign,
};

export function DynamicChecklist({ processId, readOnly = false, onComplete }: DynamicChecklistProps) {
  const { items, loading, updateItem } = useProcessChecklist(processId);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['itens_fisicos', 'acessos'])
  );
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [itemConditions, setItemConditions] = useState<Record<string, ItemCondition>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  // Agrupar itens por categoria
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<ChecklistCategory, ProcessChecklistItem[]>);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleToggleItem = async (item: ProcessChecklistItem) => {
    if (readOnly) return;

    const newStatus = item.status === 'concluido' ? 'pendente' : 'concluido';
    const condition = itemConditions[item.id] || 'bom';
    const notes = itemNotes[item.id] || item.notes;

    await updateItem(item.id, {
      status: newStatus,
      condition: newStatus === 'concluido' ? condition : null,
      notes
    });
  };

  const handleMarkNotApplicable = async (item: ProcessChecklistItem) => {
    if (readOnly) return;
    await updateItem(item.id, {
      status: 'nao_aplicavel',
      notes: itemNotes[item.id] || 'Não aplicável para este processo'
    });
  };

  const handleUploadEvidence = async (itemId: string, files: FileList) => {
    if (!files.length) return;

    setUploading(itemId);
    try {
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${processId}/${itemId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('technician-returns')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('technician-returns')
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
      }

      const item = items.find(i => i.id === itemId);
      const existingUrls = item?.evidence_urls || [];

      await updateItem(itemId, {
        evidence_urls: [...existingUrls, ...uploadedUrls]
      });

      toast.success(`${files.length} arquivo(s) enviado(s)`);
    } catch (error) {
      console.error('Error uploading evidence:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading(null);
    }
  };

  const getCategoryProgress = (category: ChecklistCategory) => {
    const categoryItems = groupedItems[category] || [];
    const completed = categoryItems.filter(
      i => i.status === 'concluido' || i.status === 'nao_aplicavel'
    ).length;
    return { completed, total: categoryItems.length };
  };

  const overallProgress = items.length > 0
    ? Math.round((items.filter(i => i.status === 'concluido' || i.status === 'nao_aplicavel').length / items.length) * 100)
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Progresso do Checklist</p>
              <p className="text-2xl font-bold">{overallProgress}%</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">
                {items.filter(i => i.status === 'concluido').length} concluídos
              </Badge>
              <Badge variant="outline">
                {items.filter(i => i.status === 'pendente').length} pendentes
              </Badge>
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      {(Object.keys(CATEGORY_LABELS) as ChecklistCategory[]).map((category) => {
        const categoryItems = groupedItems[category];
        if (!categoryItems?.length) return null;

        const Icon = CATEGORY_ICONS[category];
        const { completed, total } = getCategoryProgress(category);
        const isExpanded = expandedCategories.has(category);

        return (
          <Card key={category}>
            <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(category)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">
                        {CATEGORY_LABELS[category]}
                      </CardTitle>
                    </div>
                    <Badge variant={completed === total ? 'default' : 'secondary'}>
                      {completed}/{total}
                    </Badge>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {categoryItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          item.status === 'concluido'
                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                            : item.status === 'nao_aplicavel'
                            ? 'bg-muted/50 border-muted'
                            : 'bg-background'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <Checkbox
                            checked={item.status === 'concluido'}
                            onCheckedChange={() => handleToggleItem(item)}
                            disabled={readOnly || item.status === 'nao_aplicavel'}
                            className="mt-0.5"
                          />

                          {/* Content */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className={`font-medium ${
                                  item.status === 'nao_aplicavel' ? 'line-through text-muted-foreground' : ''
                                }`}>
                                  {item.item_name}
                                </p>
                                {item.condition && (
                                  <Badge 
                                    variant="secondary" 
                                    className={`mt-1 ${CONDITION_COLORS[item.condition]}`}
                                  >
                                    {CONDITION_LABELS[item.condition]}
                                  </Badge>
                                )}
                              </div>

                              {/* Actions */}
                              {!readOnly && item.status === 'pendente' && (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingItem(
                                      editingItem === item.id ? null : item.id
                                    )}
                                  >
                                    <Camera className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleMarkNotApplicable(item)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Evidence Images */}
                            {item.evidence_urls && item.evidence_urls.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {item.evidence_urls.map((url, idx) => (
                                  <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-16 h-16 rounded border overflow-hidden hover:opacity-80"
                                  >
                                    <img
                                      src={url}
                                      alt={`Evidência ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}

                            {/* Edit Form */}
                            {editingItem === item.id && !readOnly && (
                              <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-3">
                                <div className="space-y-2">
                                  <Label>Condição do Item</Label>
                                  <Select
                                    value={itemConditions[item.id] || 'bom'}
                                    onValueChange={(v) => setItemConditions({
                                      ...itemConditions,
                                      [item.id]: v as ItemCondition
                                    })}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(Object.entries(CONDITION_LABELS) as [ItemCondition, string][]).map(
                                        ([value, label]) => (
                                          <SelectItem key={value} value={value}>
                                            {label}
                                          </SelectItem>
                                        )
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label>Observações</Label>
                                  <Textarea
                                    value={itemNotes[item.id] || item.notes || ''}
                                    onChange={(e) => setItemNotes({
                                      ...itemNotes,
                                      [item.id]: e.target.value
                                    })}
                                    placeholder="Observações sobre o item..."
                                    rows={2}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>Evidências (Fotos)</Label>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={uploading === item.id}
                                      onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = 'image/*';
                                        input.multiple = true;
                                        input.onchange = (e) => {
                                          const files = (e.target as HTMLInputElement).files;
                                          if (files) handleUploadEvidence(item.id, files);
                                        };
                                        input.click();
                                      }}
                                    >
                                      {uploading === item.id ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      ) : (
                                        <Upload className="h-4 w-4 mr-2" />
                                      )}
                                      Enviar Fotos
                                    </Button>
                                  </div>
                                </div>

                                <Button
                                  size="sm"
                                  onClick={() => {
                                    handleToggleItem(item);
                                    setEditingItem(null);
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Marcar como Concluído
                                </Button>
                              </div>
                            )}

                            {/* Notes */}
                            {item.notes && item.status !== 'pendente' && (
                              <p className="text-sm text-muted-foreground">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* Complete Button */}
      {!readOnly && overallProgress === 100 && onComplete && (
        <Button className="w-full" size="lg" onClick={onComplete}>
          <Check className="h-4 w-4 mr-2" />
          Finalizar Checklist
        </Button>
      )}
    </div>
  );
}
