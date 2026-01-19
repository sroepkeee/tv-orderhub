import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, User, Package, FileText, AlertTriangle, Search, CheckCircle2, ClipboardList } from 'lucide-react';
import { useReturnProcesses } from '@/hooks/useReturnProcesses';
import { useTechnicians } from '@/hooks/useTechnicians';
import { useTechnicianFromOrders, TechnicianFromOrders } from '@/hooks/useTechnicianFromOrders';
import { MOTIVO_LABELS, ReturnProcessMotivo } from '@/types/returnProcess';
import { Technician } from '@/types/technicians';

interface OpenReturnProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (processId: string) => void;
  preselectedTechnician?: Technician;
}

interface CombinedTechnician {
  id: string;
  name: string;
  isVirtual: boolean; // true = veio dos pedidos, false = tabela technicians
  orderCount?: number;
  totalItems?: number;
  orders?: TechnicianFromOrders['orders'];
  originalTechnician?: Technician;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatingTechnician, setIsCreatingTechnician] = useState(false);

  const { technicians, loading: loadingTechnicians, createTechnician, fetchTechnicians } = useTechnicians();
  const { techniciansFromOrders, loading: loadingFromOrders } = useTechnicianFromOrders();
  const { createProcess } = useReturnProcesses();

  // Combinar técnicos das duas fontes
  const combinedTechnicians = useMemo((): CombinedTechnician[] => {
    const result: CombinedTechnician[] = [];
    const seenNames = new Set<string>();

    // Primeiro, adicionar técnicos cadastrados
    technicians.forEach((tech) => {
      const normalizedName = tech.name.trim().toUpperCase();
      seenNames.add(normalizedName);
      
      // Buscar pedidos desse técnico
      const fromOrders = techniciansFromOrders.find(
        (t) => t.name === normalizedName
      );

      result.push({
        id: tech.id,
        name: tech.name,
        isVirtual: false,
        orderCount: fromOrders?.orderCount || 0,
        totalItems: fromOrders?.totalItems || 0,
        orders: fromOrders?.orders || [],
        originalTechnician: tech,
      });
    });

    // Depois, adicionar técnicos "virtuais" (só existem nos pedidos)
    techniciansFromOrders.forEach((tech) => {
      if (!seenNames.has(tech.name)) {
        result.push({
          id: `virtual_${tech.name}`,
          name: tech.name,
          isVirtual: true,
          orderCount: tech.orderCount,
          totalItems: tech.totalItems,
          orders: tech.orders,
        });
      }
    });

    return result.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));
  }, [technicians, techniciansFromOrders]);

  // Filtrar por busca
  const filteredTechnicians = useMemo(() => {
    if (!searchTerm.trim()) return combinedTechnicians;
    const term = searchTerm.toLowerCase();
    return combinedTechnicians.filter((tech) =>
      tech.name.toLowerCase().includes(term)
    );
  }, [combinedTechnicians, searchTerm]);

  const selectedTechnician = combinedTechnicians.find(t => t.id === selectedTechnicianId);

  const handleSubmit = async () => {
    if (!selectedTechnicianId || !motivo || !selectedTechnician) return;

    setIsSubmitting(true);
    try {
      let technicianId = selectedTechnicianId;

      // Se é técnico virtual, criar na tabela primeiro
      if (selectedTechnician.isVirtual) {
        setIsCreatingTechnician(true);
        const newTechnician = await createTechnician({
          name: selectedTechnician.name,
          is_active: true,
        });
        
        if (!newTechnician) {
          throw new Error('Falha ao cadastrar técnico');
        }
        
        technicianId = newTechnician.id;
        await fetchTechnicians();
        setIsCreatingTechnician(false);
      }

      const process = await createProcess(
        technicianId,
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
      setIsCreatingTechnician(false);
    }
  };

  const resetForm = () => {
    setSelectedTechnicianId(preselectedTechnician?.id || '');
    setMotivo('');
    setMotivoDetalhes('');
    setNotes('');
    setSearchTerm('');
  };

  // Reset when dialog opens
  useEffect(() => {
    if (open && preselectedTechnician) {
      setSelectedTechnicianId(preselectedTechnician.id);
    }
  }, [open, preselectedTechnician]);

  const motivoOptions = Object.entries(MOTIVO_LABELS) as [ReturnProcessMotivo, string][];
  const isLoading = loadingTechnicians || loadingFromOrders;

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case 'remessa_conserto': return 'Conserto';
      case 'remessa_garantia': return 'Garantia';
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Abrir Processo de Devolução
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-4">
            {/* Busca e Seleção de Técnico */}
            <div className="space-y-2">
              <Label>Técnico</Label>
              
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando técnicos...
                </div>
              ) : selectedTechnicianId && selectedTechnician ? (
                // Técnico selecionado
                <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <div>
                          <p className="font-medium">{selectedTechnician.name}</p>
                          <p className="text-xs text-emerald-600">
                            {selectedTechnician.isVirtual 
                              ? 'Será cadastrado automaticamente' 
                              : 'Técnico cadastrado'}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedTechnicianId('')}
                        disabled={!!preselectedTechnician}
                      >
                        Alterar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                // Campo de busca e seleção
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar técnico por nome..."
                      className="pl-9"
                    />
                  </div>
                  
                  {combinedTechnicians.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-3 text-center border rounded-lg">
                      Nenhum técnico encontrado nos pedidos de remessa
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
                        {filteredTechnicians.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id}>
                            <div className="flex items-center gap-2 w-full">
                              <User className="h-4 w-4 shrink-0" />
                              <span className="flex-1 truncate">{tech.name}</span>
                              {tech.orderCount ? (
                                <Badge variant="secondary" className="ml-auto shrink-0">
                                  {tech.orderCount} {tech.orderCount === 1 ? 'pedido' : 'pedidos'}
                                </Badge>
                              ) : null}
                              {tech.isVirtual && (
                                <Badge variant="outline" className="shrink-0 text-xs">
                                  Novo
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* Materiais na Conta do Técnico */}
            {selectedTechnician && selectedTechnician.orders && selectedTechnician.orders.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Materiais na Conta do Técnico
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="space-y-3">
                    <div className="flex gap-4">
                      <div className="flex-1 text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{selectedTechnician.orderCount}</p>
                        <p className="text-xs text-muted-foreground">Pedidos</p>
                      </div>
                      <div className="flex-1 text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{selectedTechnician.totalItems}</p>
                        <p className="text-xs text-muted-foreground">Itens Totais</p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {selectedTechnician.orders.map((order) => (
                          <div 
                            key={order.id} 
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm"
                          >
                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{order.order_number}</span>
                            <Badge variant="outline" className="text-xs">
                              {order.items_count} itens
                            </Badge>
                            <Badge variant="secondary" className="text-xs ml-auto">
                              {getOrderTypeLabel(order.order_type)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
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
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
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
                {isCreatingTechnician ? 'Cadastrando técnico...' : 'Criando...'}
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
