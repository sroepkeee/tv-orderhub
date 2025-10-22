import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OrderItem } from "./AddOrderDialog";
import { 
  ChevronDown, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Plus, 
  Trash2, 
  Save, 
  Loader2,
  Cpu,
  HardDrive,
  Wrench,
  TestTube,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";

interface RepairPart {
  part_code: string;
  description: string;
  quantity: number;
  notes?: string;
}

interface Test {
  test_name: string;
  result: 'pass' | 'fail' | 'pending';
  notes?: string;
  performed_at: string;
}

interface LabWork {
  id?: string;
  order_item_id: string;
  work_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  firmware_updated: boolean;
  firmware_version?: string;
  firmware_notes?: string;
  image_installed: boolean;
  image_version?: string;
  image_notes?: string;
  repair_parts: RepairPart[];
  tests_performed: Test[];
  general_notes?: string;
  started_at?: string;
  completed_at?: string;
}

interface LabWorkViewProps {
  orderId: string;
  items: OrderItem[];
  requiresFirmware?: boolean;
  firmwareProjectName?: string;
  requiresImage?: boolean;
  imageProjectName?: string;
}

export const LabWorkView = ({
  orderId,
  items,
  requiresFirmware,
  firmwareProjectName,
  requiresImage,
  imageProjectName
}: LabWorkViewProps) => {
  const { toast } = useToast();
  const [labWorks, setLabWorks] = useState<Record<string, LabWork>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadLabWorks();
  }, [orderId, items]);

  const loadLabWorks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lab_item_work')
        .select('*')
        .eq('order_id', orderId);

      if (error) throw error;

      const worksByItem: Record<string, LabWork> = {};
      
      // Inicializar trabalhos para todos os itens
      items.forEach(item => {
        const existingWork = data?.find(w => w.order_item_id === item.id);
        worksByItem[item.id] = existingWork ? {
          ...existingWork,
          work_status: existingWork.work_status as 'pending' | 'in_progress' | 'completed' | 'failed',
          repair_parts: Array.isArray(existingWork.repair_parts) ? existingWork.repair_parts as unknown as RepairPart[] : [],
          tests_performed: Array.isArray(existingWork.tests_performed) ? existingWork.tests_performed as unknown as Test[] : []
        } : {
          order_item_id: item.id,
          work_status: 'pending',
          firmware_updated: false,
          image_installed: false,
          repair_parts: [],
          tests_performed: []
        };
      });

      setLabWorks(worksByItem);
    } catch (error) {
      console.error('Error loading lab works:', error);
      toast({
        title: "Erro ao carregar trabalhos",
        description: "Não foi possível carregar os trabalhos do laboratório",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveLabWork = async (itemId: string) => {
    try {
      setSaving(itemId);
      const work = labWorks[itemId];
      const { data: { user } } = await supabase.auth.getUser();

      const workData = {
        order_id: orderId,
        order_item_id: itemId,
        work_status: work.work_status,
        firmware_updated: work.firmware_updated,
        firmware_version: work.firmware_version,
        firmware_notes: work.firmware_notes,
        image_installed: work.image_installed,
        image_version: work.image_version,
        image_notes: work.image_notes,
        repair_parts: JSON.stringify(work.repair_parts) as any,
        tests_performed: JSON.stringify(work.tests_performed) as any,
        general_notes: work.general_notes,
        started_at: work.work_status !== 'pending' && !work.started_at ? new Date().toISOString() : work.started_at,
        completed_at: work.work_status === 'completed' ? new Date().toISOString() : null
      };

      if (work.id) {
        const { error } = await supabase
          .from('lab_item_work')
          .update(workData)
          .eq('id', work.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('lab_item_work')
          .insert([workData])
          .select()
          .single();
        if (error) throw error;
        
        setLabWorks(prev => ({
          ...prev,
          [itemId]: { ...prev[itemId], id: data.id }
        }));
      }

      // Registrar no histórico
      const item = items.find(i => i.id === itemId);
      await supabase.from('order_item_history').insert({
        order_id: orderId,
        order_item_id: itemId,
        field_changed: 'lab_work_status',
        old_value: 'pending',
        new_value: work.work_status,
        notes: `Status atualizado: ${getStatusLabel(work.work_status)}`,
        user_id: user?.id
      });

      toast({
        title: "Trabalho salvo",
        description: `Trabalho no item ${item?.itemCode} foi salvo com sucesso`
      });
    } catch (error) {
      console.error('Error saving lab work:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o trabalho",
        variant: "destructive"
      });
    } finally {
      setSaving(null);
    }
  };

  const updateLabWork = (itemId: string, updates: Partial<LabWork>) => {
    setLabWorks(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...updates }
    }));
  };

  const addRepairPart = (itemId: string) => {
    const work = labWorks[itemId];
    updateLabWork(itemId, {
      repair_parts: [...work.repair_parts, { part_code: '', description: '', quantity: 1 }]
    });
  };

  const updateRepairPart = (itemId: string, index: number, updates: Partial<RepairPart>) => {
    const work = labWorks[itemId];
    const newParts = [...work.repair_parts];
    newParts[index] = { ...newParts[index], ...updates };
    updateLabWork(itemId, { repair_parts: newParts });
  };

  const removeRepairPart = (itemId: string, index: number) => {
    const work = labWorks[itemId];
    updateLabWork(itemId, {
      repair_parts: work.repair_parts.filter((_, i) => i !== index)
    });
  };

  const addTest = (itemId: string) => {
    const work = labWorks[itemId];
    updateLabWork(itemId, {
      tests_performed: [...work.tests_performed, {
        test_name: '',
        result: 'pending' as const,
        performed_at: new Date().toISOString()
      }]
    });
  };

  const updateTest = (itemId: string, index: number, updates: Partial<Test>) => {
    const work = labWorks[itemId];
    const newTests = [...work.tests_performed];
    newTests[index] = { ...newTests[index], ...updates };
    updateLabWork(itemId, { tests_performed: newTests });
  };

  const removeTest = (itemId: string, index: number) => {
    const work = labWorks[itemId];
    updateLabWork(itemId, {
      tests_performed: work.tests_performed.filter((_, i) => i !== index)
    });
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'in_progress': return 'Em Progresso';
      case 'completed': return 'Concluído';
      case 'failed': return 'Falhou';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(95vh-200px)] pr-4">
      <div className="space-y-4">
        {/* Requisitos gerais */}
        {(requiresFirmware || requiresImage) && (
          <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-300">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-3">
              📋 Requisitos do Pedido
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {requiresFirmware && (
                <div className="flex items-start gap-2">
                  <Cpu className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Firmware Requerido</p>
                    <p className="text-xs text-muted-foreground">{firmwareProjectName}</p>
                  </div>
                </div>
              )}
              {requiresImage && (
                <div className="flex items-start gap-2">
                  <HardDrive className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Imagem Requerida</p>
                    <p className="text-xs text-muted-foreground">{imageProjectName}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Lista de itens */}
        {items.map((item) => {
          const work = labWorks[item.id];
          const isExpanded = expandedItems.has(item.id);
          const isSaving = saving === item.id;

          return (
            <Card key={item.id} className="overflow-hidden">
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(item.id)}>
                <div className="p-4 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <div>
                          <p className="font-semibold">{item.itemCode}</p>
                          <p className="text-sm text-muted-foreground">{item.itemDescription}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(work.work_status)}>
                        {getStatusLabel(work.work_status)}
                      </Badge>
                      {work.work_status === 'completed' && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="p-4 space-y-4">
                    {/* Status do trabalho */}
                    <div>
                      <Label>Status do Trabalho</Label>
                      <Select
                        value={work.work_status}
                        onValueChange={(value: any) => updateLabWork(item.id, { work_status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="in_progress">Em Progresso</SelectItem>
                          <SelectItem value="completed">Concluído</SelectItem>
                          <SelectItem value="failed">Falhou</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Firmware */}
                    {requiresFirmware && (
                      <Card className="p-4 space-y-3 border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-5 w-5 text-blue-600" />
                          <h4 className="font-semibold">Atualização de Firmware</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`firmware-${item.id}`}
                            checked={work.firmware_updated}
                            onCheckedChange={(checked) => 
                              updateLabWork(item.id, { firmware_updated: checked as boolean })
                            }
                          />
                          <Label htmlFor={`firmware-${item.id}`} className="cursor-pointer">
                            Firmware atualizado
                          </Label>
                        </div>
                        {work.firmware_updated && (
                          <>
                            <div>
                              <Label>Versão do Firmware</Label>
                              <Input
                                value={work.firmware_version || ''}
                                onChange={(e) => updateLabWork(item.id, { firmware_version: e.target.value })}
                                placeholder="Ex: v2.1.5"
                              />
                            </div>
                            <div>
                              <Label>Observações</Label>
                              <Textarea
                                value={work.firmware_notes || ''}
                                onChange={(e) => updateLabWork(item.id, { firmware_notes: e.target.value })}
                                placeholder="Detalhes da atualização..."
                                rows={2}
                              />
                            </div>
                          </>
                        )}
                      </Card>
                    )}

                    {/* Imagem */}
                    {requiresImage && (
                      <Card className="p-4 space-y-3 border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-5 w-5 text-purple-600" />
                          <h4 className="font-semibold">Instalação de Imagem</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`image-${item.id}`}
                            checked={work.image_installed}
                            onCheckedChange={(checked) => 
                              updateLabWork(item.id, { image_installed: checked as boolean })
                            }
                          />
                          <Label htmlFor={`image-${item.id}`} className="cursor-pointer">
                            Imagem instalada
                          </Label>
                        </div>
                        {work.image_installed && (
                          <>
                            <div>
                              <Label>Versão da Imagem</Label>
                              <Input
                                value={work.image_version || ''}
                                onChange={(e) => updateLabWork(item.id, { image_version: e.target.value })}
                                placeholder="Ex: Ubuntu 22.04 LTS"
                              />
                            </div>
                            <div>
                              <Label>Observações</Label>
                              <Textarea
                                value={work.image_notes || ''}
                                onChange={(e) => updateLabWork(item.id, { image_notes: e.target.value })}
                                placeholder="Detalhes da instalação..."
                                rows={2}
                              />
                            </div>
                          </>
                        )}
                      </Card>
                    )}

                    {/* Peças de conserto */}
                    <Card className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-5 w-5 text-orange-600" />
                          <h4 className="font-semibold">Peças para Conserto</h4>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addRepairPart(item.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                      {work.repair_parts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          Nenhuma peça adicionada
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {work.repair_parts.map((part, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-start p-2 bg-muted/50 rounded">
                              <Input
                                className="col-span-3"
                                placeholder="Código"
                                value={part.part_code}
                                onChange={(e) => updateRepairPart(item.id, idx, { part_code: e.target.value })}
                              />
                              <Input
                                className="col-span-4"
                                placeholder="Descrição"
                                value={part.description}
                                onChange={(e) => updateRepairPart(item.id, idx, { description: e.target.value })}
                              />
                              <Input
                                className="col-span-2"
                                type="number"
                                placeholder="Qtd"
                                value={part.quantity}
                                onChange={(e) => updateRepairPart(item.id, idx, { quantity: parseInt(e.target.value) || 1 })}
                              />
                              <Input
                                className="col-span-2"
                                placeholder="Obs"
                                value={part.notes || ''}
                                onChange={(e) => updateRepairPart(item.id, idx, { notes: e.target.value })}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="col-span-1"
                                onClick={() => removeRepairPart(item.id, idx)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    {/* Testes realizados */}
                    <Card className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TestTube className="h-5 w-5 text-cyan-600" />
                          <h4 className="font-semibold">Testes e Validações</h4>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addTest(item.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                      {work.tests_performed.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          Nenhum teste registrado
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {work.tests_performed.map((test, idx) => (
                            <div key={idx} className="space-y-2 p-3 bg-muted/50 rounded">
                              <div className="grid grid-cols-12 gap-2">
                                <Input
                                  className="col-span-5"
                                  placeholder="Nome do teste"
                                  value={test.test_name}
                                  onChange={(e) => updateTest(item.id, idx, { test_name: e.target.value })}
                                />
                                <Select
                                  value={test.result}
                                  onValueChange={(value: any) => updateTest(item.id, idx, { result: value })}
                                >
                                  <SelectTrigger className="col-span-3">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="pass">Aprovado</SelectItem>
                                    <SelectItem value="fail">Reprovado</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="col-span-3 text-xs text-muted-foreground flex items-center">
                                  {format(new Date(test.performed_at), 'dd/MM HH:mm')}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="col-span-1"
                                  onClick={() => removeTest(item.id, idx)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                              <Textarea
                                placeholder="Observações do teste..."
                                value={test.notes || ''}
                                onChange={(e) => updateTest(item.id, idx, { notes: e.target.value })}
                                rows={1}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    {/* Observações gerais */}
                    <div>
                      <Label className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Observações Gerais
                      </Label>
                      <Textarea
                        value={work.general_notes || ''}
                        onChange={(e) => updateLabWork(item.id, { general_notes: e.target.value })}
                        placeholder="Adicione observações sobre o trabalho realizado..."
                        rows={3}
                      />
                    </div>

                    {/* Botão salvar */}
                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={() => saveLabWork(item.id)}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Salvar Trabalho
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
};
