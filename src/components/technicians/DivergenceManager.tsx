import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  AlertTriangle, Plus, Check, X, MessageSquare, 
  DollarSign, Loader2, Camera, Upload
} from 'lucide-react';
import { useDivergencias } from '@/hooks/useReturnProcesses';
import { 
  Divergencia,
  DivergenciaTipo,
  DivergenciaStatus,
  DIVERGENCIA_TIPO_LABELS,
  DIVERGENCIA_STATUS_LABELS
} from '@/types/returnProcess';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DivergenceManagerProps {
  processId: string;
  readOnly?: boolean;
}

const STATUS_COLORS: Record<DivergenciaStatus, string> = {
  identificada: 'bg-amber-100 text-amber-800',
  notificada_gpi: 'bg-blue-100 text-blue-800',
  em_analise: 'bg-purple-100 text-purple-800',
  cobranca: 'bg-red-100 text-red-800',
  resolvida: 'bg-emerald-100 text-emerald-800',
  desconsiderada: 'bg-gray-100 text-gray-800',
};

export function DivergenceManager({ processId, readOnly = false }: DivergenceManagerProps) {
  const { divergencias, loading, createDivergencia, updateDivergencia } = useDivergencias(processId);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedDivergencia, setSelectedDivergencia] = useState<Divergencia | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    item_name: '',
    tipo: '' as DivergenciaTipo | '',
    description: '',
    expected_value: '',
    actual_value: '',
    estimated_cost: ''
  });

  const resetForm = () => {
    setFormData({
      item_name: '',
      tipo: '',
      description: '',
      expected_value: '',
      actual_value: '',
      estimated_cost: ''
    });
  };

  const handleCreate = async () => {
    if (!formData.item_name || !formData.tipo) return;

    setIsSubmitting(true);
    try {
      await createDivergencia({
        process_id: processId,
        item_name: formData.item_name,
        tipo: formData.tipo as DivergenciaTipo,
        description: formData.description || null,
        expected_value: formData.expected_value || null,
        actual_value: formData.actual_value || null,
        estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
        status: 'identificada',
        organization_id: null,
        checklist_item_id: null,
        evidence_urls: null,
        resolution_notes: null,
        resolved_by: null,
        resolved_at: null,
        created_by: null
      });
      setShowAddDialog(false);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: DivergenciaStatus, notes?: string) => {
    const updates: Partial<Divergencia> = { status: newStatus };
    
    if (newStatus === 'resolvida' || newStatus === 'desconsiderada') {
      updates.resolved_at = new Date().toISOString();
      if (notes) updates.resolution_notes = notes;
    }

    await updateDivergencia(id, updates);
    setSelectedDivergencia(null);
  };

  const pendingCount = divergencias.filter(d => 
    !['resolvida', 'desconsiderada'].includes(d.status)
  ).length;

  const totalCost = divergencias
    .filter(d => d.estimated_cost && d.status !== 'desconsiderada')
    .reduce((sum, d) => sum + (d.estimated_cost || 0), 0);

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
      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Divergências
              </CardTitle>
              <CardDescription>
                Registre itens faltantes, danificados ou incorretos
              </CardDescription>
            </div>
            {!readOnly && (
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar
              </Button>
            )}
          </div>
        </CardHeader>
        {(pendingCount > 0 || totalCost > 0) && (
          <CardContent className="pt-0">
            <div className="flex gap-4">
              {pendingCount > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
              {totalCost > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-muted-foreground">custo estimado</span>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Empty State */}
      {divergencias.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Check className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
            <p className="font-medium">Nenhuma divergência registrada</p>
            <p className="text-sm text-muted-foreground">
              Todos os itens foram devolvidos corretamente
            </p>
          </CardContent>
        </Card>
      )}

      {/* Divergencias List */}
      <div className="space-y-3">
        {divergencias.map((div) => (
          <Card 
            key={div.id}
            className={`cursor-pointer transition-colors hover:border-primary/50 ${
              div.status === 'resolvida' ? 'opacity-60' : ''
            }`}
            onClick={() => !readOnly && setSelectedDivergencia(div)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{div.item_name}</p>
                    <Badge variant="secondary">
                      {DIVERGENCIA_TIPO_LABELS[div.tipo]}
                    </Badge>
                  </div>
                  
                  {div.description && (
                    <p className="text-sm text-muted-foreground">
                      {div.description}
                    </p>
                  )}

                  <div className="flex gap-4 text-sm">
                    {div.expected_value && (
                      <span>
                        <span className="text-muted-foreground">Esperado: </span>
                        {div.expected_value}
                      </span>
                    )}
                    {div.actual_value && (
                      <span>
                        <span className="text-muted-foreground">Encontrado: </span>
                        {div.actual_value}
                      </span>
                    )}
                  </div>

                  {div.estimated_cost && (
                    <p className="text-sm font-medium text-red-600">
                      Custo: R$ {div.estimated_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <Badge className={STATUS_COLORS[div.status]}>
                  {DIVERGENCIA_STATUS_LABELS[div.status]}
                </Badge>
              </div>

              {div.resolution_notes && (
                <div className="mt-3 p-2 bg-muted/50 rounded text-sm">
                  <p className="text-muted-foreground">Resolução:</p>
                  <p>{div.resolution_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Divergência</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item *</Label>
              <Input
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                placeholder="Nome do item"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Divergência *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v) => setFormData({ ...formData, tipo: v as DivergenciaTipo })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(DIVERGENCIA_TIPO_LABELS) as [DivergenciaTipo, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Esperado</Label>
                <Input
                  value={formData.expected_value}
                  onChange={(e) => setFormData({ ...formData, expected_value: e.target.value })}
                  placeholder="Ex: 5 unidades"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Encontrado</Label>
                <Input
                  value={formData.actual_value}
                  onChange={(e) => setFormData({ ...formData, actual_value: e.target.value })}
                  placeholder="Ex: 3 unidades"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Custo Estimado (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalhes sobre a divergência..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.item_name || !formData.tipo || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={!!selectedDivergencia} onOpenChange={() => setSelectedDivergencia(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Divergência</DialogTitle>
          </DialogHeader>

          {selectedDivergencia && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedDivergencia.item_name}</p>
                <p className="text-sm text-muted-foreground">
                  {DIVERGENCIA_TIPO_LABELS[selectedDivergencia.tipo]}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Alterar Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedDivergencia.id, 'notificada_gpi')}
                    disabled={selectedDivergencia.status === 'notificada_gpi'}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Notificar GPI
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedDivergencia.id, 'em_analise')}
                    disabled={selectedDivergencia.status === 'em_analise'}
                  >
                    Em Análise
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    onClick={() => handleUpdateStatus(selectedDivergencia.id, 'cobranca')}
                    disabled={selectedDivergencia.status === 'cobranca'}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Cobrança
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-emerald-600"
                    onClick={() => handleUpdateStatus(selectedDivergencia.id, 'resolvida', 'Resolvido')}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Resolver
                  </Button>
                </div>
              </div>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => handleUpdateStatus(selectedDivergencia.id, 'desconsiderada', 'Desconsiderado')}
              >
                <X className="h-4 w-4 mr-2" />
                Desconsiderar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
