import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, Save, X, Package } from 'lucide-react';
import { useOrderVolumes } from '@/hooks/useOrderVolumes';
import type { OrderVolume, VolumeFormData } from '@/types/volumes';
import { PACKAGING_TYPES } from '@/types/volumes';

interface VolumeManagerProps {
  orderId: string;
}

export const VolumeManager = ({ orderId }: VolumeManagerProps) => {
  const { volumes, loading, loadVolumes, saveVolume, deleteVolume, totals } = useOrderVolumes(orderId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<VolumeFormData>({
    quantity: 1,
    weight_kg: 0,
    length_cm: 0,
    width_cm: 0,
    height_cm: 0,
    packaging_type: 'caixa_papelao',
    description: ''
  });

  useEffect(() => {
    loadVolumes();
  }, [loadVolumes]);

  const handleStartAdd = () => {
    setIsAdding(true);
    setFormData({
      quantity: 1,
      weight_kg: 0,
      length_cm: 0,
      width_cm: 0,
      height_cm: 0,
      packaging_type: 'caixa_papelao',
      description: ''
    });
  };

  const handleStartEdit = (volume: OrderVolume) => {
    setEditingId(volume.id);
    setFormData({
      quantity: volume.quantity,
      weight_kg: volume.weight_kg,
      length_cm: volume.length_cm,
      width_cm: volume.width_cm,
      height_cm: volume.height_cm,
      packaging_type: volume.packaging_type || 'caixa_papelao',
      description: volume.description || ''
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      quantity: 1,
      weight_kg: 0,
      length_cm: 0,
      width_cm: 0,
      height_cm: 0,
      packaging_type: 'caixa_papelao',
      description: ''
    });
  };

  const handleSave = async () => {
    const volumeData: Partial<OrderVolume> = {
      ...formData,
      volume_number: isAdding ? volumes.length + 1 : volumes.find(v => v.id === editingId)?.volume_number || 1
    };

    if (editingId) {
      volumeData.id = editingId;
    }

    const success = await saveVolume(volumeData);
    if (success) {
      handleCancel();
    }
  };

  const handleDelete = async (volume: OrderVolume) => {
    if (confirm(`Remover volume ${volume.volume_number}?`)) {
      await deleteVolume(volume.id, volume.volume_number);
    }
  };

  const calculateCubagem = (length: number, width: number, height: number) => {
    return (length * width * height) / 1000000;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Volumes e Dimensões
        </Label>
        {!isAdding && (
          <Button onClick={handleStartAdd} size="sm" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Volume
          </Button>
        )}
      </div>

      {/* Lista de Volumes */}
      <div className="space-y-3">
        {volumes.map((volume) => (
          <Card key={volume.id} className="p-4">
            {editingId === volume.id ? (
              // Modo Edição
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Editando Volume {volume.volume_number}</Label>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} size="sm" className="gap-1">
                      <Save className="h-3 w-3" />
                      Salvar
                    </Button>
                    <Button onClick={handleCancel} size="sm" variant="outline" className="gap-1">
                      <X className="h-3 w-3" />
                      Cancelar
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Qtd de volumes idênticos</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Peso (kg) cada</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.weight_kg}
                      onChange={(e) => setFormData({ ...formData, weight_kg: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo de Embalagem</Label>
                    <Select
                      value={formData.packaging_type}
                      onValueChange={(value) => setFormData({ ...formData, packaging_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {PACKAGING_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Comprimento (cm)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.length_cm}
                      onChange={(e) => setFormData({ ...formData, length_cm: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Largura (cm)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.width_cm}
                      onChange={(e) => setFormData({ ...formData, width_cm: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Altura (cm)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.height_cm}
                      onChange={(e) => setFormData({ ...formData, height_cm: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cubagem unitária</Label>
                    <Input
                      value={`${calculateCubagem(formData.length_cm, formData.width_cm, formData.height_cm).toFixed(3)} m³`}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">Descrição (opcional)</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Equipamento frágil, manuseio cuidadoso"
                    rows={2}
                  />
                </div>
              </div>
            ) : (
              // Modo Visualização
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="font-semibold">Volume {volume.volume_number}</Label>
                    {volume.quantity > 1 && (
                      <Badge variant="secondary">{volume.quantity} volumes idênticos</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleStartEdit(volume)} size="sm" variant="ghost" className="h-7 px-2">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button onClick={() => handleDelete(volume)} size="sm" variant="ghost" className="h-7 px-2 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Peso:</span>{' '}
                    <span className="font-medium">{volume.weight_kg} kg {volume.quantity > 1 ? 'cada' : ''}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dimensões:</span>{' '}
                    <span className="font-medium">{volume.length_cm}x{volume.width_cm}x{volume.height_cm} cm</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Embalagem:</span>{' '}
                    <span className="font-medium">
                      {PACKAGING_TYPES.find(t => t.value === volume.packaging_type)?.label || 'Não especificado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cubagem unitária:</span>{' '}
                    <span className="font-medium">{calculateCubagem(volume.length_cm, volume.width_cm, volume.height_cm).toFixed(3)} m³</span>
                  </div>
                  {volume.description && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Descrição:</span>{' '}
                      <span className="font-medium">{volume.description}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}

        {/* Formulário para Adicionar Novo */}
        {isAdding && (
          <Card className="p-4 border-primary">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Novo Volume {volumes.length + 1}</Label>
                <div className="flex gap-2">
                  <Button onClick={handleSave} size="sm" className="gap-1">
                    <Save className="h-3 w-3" />
                    Salvar
                  </Button>
                  <Button onClick={handleCancel} size="sm" variant="outline" className="gap-1">
                    <X className="h-3 w-3" />
                    Cancelar
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Qtd de volumes idênticos</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Peso (kg) cada</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.weight_kg}
                    onChange={(e) => setFormData({ ...formData, weight_kg: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Embalagem</Label>
                  <Select
                    value={formData.packaging_type}
                    onValueChange={(value) => setFormData({ ...formData, packaging_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PACKAGING_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Comprimento (cm)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.length_cm}
                    onChange={(e) => setFormData({ ...formData, length_cm: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Largura (cm)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.width_cm}
                    onChange={(e) => setFormData({ ...formData, width_cm: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Altura (cm)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.height_cm}
                    onChange={(e) => setFormData({ ...formData, height_cm: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Cubagem unitária</Label>
                  <Input
                    value={`${calculateCubagem(formData.length_cm, formData.width_cm, formData.height_cm).toFixed(3)} m³`}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-xs">Descrição (opcional)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Equipamento frágil, manuseio cuidadoso"
                  rows={2}
                />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Resumo Total */}
      {volumes.length > 0 && (
        <Card className="p-4 bg-primary/5 border-primary">
          <Label className="text-lg font-semibold">📊 RESUMO TOTAL</Label>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div>
              <div className="text-sm text-muted-foreground">Total de Volumes</div>
              <div className="text-2xl font-bold">{totals.total_volumes}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Peso Total</div>
              <div className="text-2xl font-bold">{totals.total_weight_kg.toFixed(2)} kg</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Cubagem Total</div>
              <div className="text-2xl font-bold">{totals.total_cubagem_m3.toFixed(3)} m³</div>
            </div>
          </div>
        </Card>
      )}

      {volumes.length === 0 && !isAdding && (
        <Card className="p-6 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum volume cadastrado</p>
          <p className="text-sm">Clique em "Adicionar Volume" para começar</p>
        </Card>
      )}
    </div>
  );
};
