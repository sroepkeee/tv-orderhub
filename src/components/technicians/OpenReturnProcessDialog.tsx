import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, User, Package, FileText, AlertTriangle } from 'lucide-react';
import { useReturnProcesses } from '@/hooks/useReturnProcesses';
import { useTechnicians } from '@/hooks/useTechnicians';
import { MOTIVO_LABELS, ReturnProcessMotivo } from '@/types/returnProcess';
import { Technician } from '@/types/technicians';

interface OpenReturnProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (processId: string) => void;
  preselectedTechnician?: Technician;
}

export function OpenReturnProcessDialog({
  open,
  onOpenChange,
  onSuccess,
  preselectedTechnician
}: OpenReturnProcessDialogProps) {
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>(
    preselectedTechnician?.id || ''
  );
  const [motivo, setMotivo] = useState<ReturnProcessMotivo | ''>('');
  const [motivoDetalhes, setMotivoDetalhes] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { technicians, loading: loadingTechnicians } = useTechnicians();
  const { createProcess } = useReturnProcesses();

  const selectedTechnician = technicians.find(t => t.id === selectedTechnicianId);

  const handleSubmit = async () => {
    if (!selectedTechnicianId || !motivo) return;

    setIsSubmitting(true);
    try {
      const process = await createProcess(
        selectedTechnicianId,
        motivo,
        motivoDetalhes || undefined,
        notes || undefined
      );

      if (process) {
        onSuccess?.(process.id);
        onOpenChange(false);
        resetForm();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedTechnicianId(preselectedTechnician?.id || '');
    setMotivo('');
    setMotivoDetalhes('');
    setNotes('');
  };

  const motivoOptions = Object.entries(MOTIVO_LABELS) as [ReturnProcessMotivo, string][];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Abrir Processo de Devolução
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Seleção de Técnico */}
          <div className="space-y-2">
            <Label>Técnico</Label>
            {loadingTechnicians ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando técnicos...
              </div>
            ) : (
              <Select
                value={selectedTechnicianId}
                onValueChange={setSelectedTechnicianId}
                disabled={!!preselectedTechnician}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o técnico" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {tech.name}
                        {tech.specialty && (
                          <span className="text-muted-foreground">
                            ({tech.specialty})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Info do Técnico Selecionado */}
          {selectedTechnician && (
            <Card className="bg-muted/50">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">{selectedTechnician.name}</p>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      {selectedTechnician.email && (
                        <span>{selectedTechnician.email}</span>
                      )}
                      {selectedTechnician.phone && (
                        <span>• {selectedTechnician.phone}</span>
                      )}
                    </div>
                    {selectedTechnician.specialty && (
                      <Badge variant="secondary" className="mt-1">
                        {selectedTechnician.specialty}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo da Devolução *</Label>
            <Select
              value={motivo}
              onValueChange={(v) => setMotivo(v as ReturnProcessMotivo)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivoOptions.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Alerta para Desligamento */}
          {motivo === 'desligamento' && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardContent className="p-3">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Processo de Desligamento
                    </p>
                    <p className="text-amber-700 dark:text-amber-300">
                      Será criado automaticamente o checklist completo com bloqueio de acessos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detalhes do Motivo */}
          {motivo === 'outro' && (
            <div className="space-y-2">
              <Label>Especifique o Motivo</Label>
              <Textarea
                value={motivoDetalhes}
                onChange={(e) => setMotivoDetalhes(e.target.value)}
                placeholder="Descreva o motivo da devolução..."
                rows={2}
              />
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionais sobre o processo..."
              rows={3}
            />
          </div>

          {/* O que será criado */}
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-3">
              <div className="flex gap-2">
                <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                <div className="text-sm space-y-1">
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    Ao confirmar, será criado:
                  </p>
                  <ul className="text-blue-700 dark:text-blue-300 list-disc list-inside space-y-0.5">
                    <li>Checklist com itens físicos e administrativos</li>
                    <li>Controle de bloqueio de acessos</li>
                    <li>Registro de auditoria completo</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedTechnicianId || !motivo || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Abrir Processo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
