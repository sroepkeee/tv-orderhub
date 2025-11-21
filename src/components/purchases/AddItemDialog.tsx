import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: {
    item_code: string;
    item_description: string;
    requested_quantity: number;
    unit: string;
    unit_price?: number;
    warehouse: string;
  }) => void;
}

export function AddItemDialog({ open, onOpenChange, onAdd }: AddItemDialogProps) {
  const [formData, setFormData] = useState({
    item_code: '',
    item_description: '',
    requested_quantity: 1,
    unit: 'UND',
    unit_price: 0,
    warehouse: 'ARMAZÉM SSM'
  });

  const handleSubmit = () => {
    if (!formData.item_code || !formData.item_description) {
      toast.error('Preencha código e descrição do item');
      return;
    }

    if (formData.requested_quantity <= 0) {
      toast.error('Quantidade deve ser maior que zero');
      return;
    }

    onAdd(formData);
    setFormData({
      item_code: '',
      item_description: '',
      requested_quantity: 1,
      unit: 'UND',
      unit_price: 0,
      warehouse: 'ARMAZÉM SSM'
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>➕ Adicionar Item Manualmente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Código do Item *</Label>
            <Input
              value={formData.item_code}
              onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
              placeholder="Ex: 006049"
            />
          </div>

          <div>
            <Label>Descrição *</Label>
            <Input
              value={formData.item_description}
              onChange={(e) => setFormData({ ...formData, item_description: e.target.value })}
              placeholder="Ex: LCD 2x16 com backlight azul"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min="1"
                value={formData.requested_quantity}
                onChange={(e) => setFormData({ ...formData, requested_quantity: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label>Unidade</Label>
              <Input
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="Ex: UND, KG, M"
              />
            </div>
          </div>

          <div>
            <Label>Preço Unitário (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.unit_price}
              onChange={(e) => setFormData({ ...formData, unit_price: Number(e.target.value) })}
            />
          </div>

          <div>
            <Label>Armazém *</Label>
            <Input
              value={formData.warehouse}
              onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
              placeholder="Ex: ARMAZÉM SSM"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            Adicionar Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
