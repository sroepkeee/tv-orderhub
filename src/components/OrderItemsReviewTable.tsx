import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, AlertTriangle, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface OrderItem {
  itemCode: string;
  itemDescription: string;
  requestedQuantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  discount?: number;
  warehouse: string;
  deliveryDate: string;
}

interface OrderItemsReviewTableProps {
  items: OrderItem[];
  onChange: (items: OrderItem[]) => void;
}

export function OrderItemsReviewTable({ items, onChange }: OrderItemsReviewTableProps) {
  const [editingItems, setEditingItems] = useState<OrderItem[]>(items);

  const validateItem = (item: OrderItem) => {
    const expectedTotal = item.requestedQuantity * item.unitPrice - (item.discount || 0);
    const diff = Math.abs(expectedTotal - item.totalValue);
    return diff < (expectedTotal * 0.05); // 5% margin
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const updated = [...editingItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate total if quantity or price changes
    if (field === 'requestedQuantity' || field === 'unitPrice' || field === 'discount') {
      const qty = field === 'requestedQuantity' ? parseFloat(value) : updated[index].requestedQuantity;
      const price = field === 'unitPrice' ? parseFloat(value) : updated[index].unitPrice;
      const discount = field === 'discount' ? parseFloat(value || '0') : (updated[index].discount || 0);
      updated[index].totalValue = qty * price - discount;
    }
    
    setEditingItems(updated);
    onChange(updated);
  };

  const removeItem = (index: number) => {
    const updated = editingItems.filter((_, i) => i !== index);
    setEditingItems(updated);
    onChange(updated);
  };

  const addItem = () => {
    const newItem: OrderItem = {
      itemCode: '',
      itemDescription: '',
      requestedQuantity: 1,
      unit: 'UND',
      unitPrice: 0,
      totalValue: 0,
      discount: 0,
      warehouse: 'PRINCIPAL',
      deliveryDate: new Date().toISOString().split('T')[0],
    };
    const updated = [...editingItems, newItem];
    setEditingItems(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Revisar Itens Importados</h3>
          <p className="text-sm text-muted-foreground">
            Edite os campos necessários antes de confirmar a importação
          </p>
        </div>
        <Button onClick={addItem} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Item
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">#</TableHead>
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead className="min-w-[250px]">Descrição</TableHead>
                <TableHead className="w-[100px]">Qtde</TableHead>
                <TableHead className="w-[80px]">Und</TableHead>
                <TableHead className="w-[120px]">Preço Unit.</TableHead>
                <TableHead className="w-[120px]">Desconto</TableHead>
                <TableHead className="w-[120px]">Total</TableHead>
                <TableHead className="w-[100px]">Armazém</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editingItems.map((item, index) => {
                const isValid = validateItem(item);
                const isEmpty = !item.itemCode.trim() || !item.itemDescription.trim();
                
                return (
                  <TableRow key={index} className={!isValid || isEmpty ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    
                    <TableCell>
                      <Input
                        value={item.itemCode}
                        onChange={(e) => updateItem(index, 'itemCode', e.target.value)}
                        className={`h-8 ${!item.itemCode.trim() ? 'border-destructive' : ''}`}
                        placeholder="Código"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Textarea
                        value={item.itemDescription}
                        onChange={(e) => updateItem(index, 'itemDescription', e.target.value)}
                        className={`min-h-[60px] ${!item.itemDescription.trim() ? 'border-destructive' : ''}`}
                        placeholder="Descrição do produto"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.requestedQuantity}
                        onChange={(e) => updateItem(index, 'requestedQuantity', parseFloat(e.target.value) || 0)}
                        className="h-8"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Input
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        className="h-8"
                        placeholder="UND"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="h-8"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.discount || 0}
                        onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value) || 0)}
                        className="h-8"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.totalValue}
                        onChange={(e) => updateItem(index, 'totalValue', parseFloat(e.target.value) || 0)}
                        className={`h-8 font-medium ${!isValid ? 'border-destructive' : ''}`}
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Input
                        value={item.warehouse}
                        onChange={(e) => updateItem(index, 'warehouse', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    
                    <TableCell>
                      {isEmpty ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Vazio
                        </Badge>
                      ) : !isValid ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Valores
                        </Badge>
                      ) : (
                        <Badge variant="default" className="gap-1 bg-green-600">
                          <Check className="h-3 w-3" />
                          OK
                        </Badge>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            Total de Itens: {editingItems.length}
          </p>
          <p className="text-sm text-muted-foreground">
            Válidos: {editingItems.filter(item => validateItem(item) && item.itemCode.trim() && item.itemDescription.trim()).length} | 
            Pendentes: {editingItems.filter(item => !validateItem(item) || !item.itemCode.trim() || !item.itemDescription.trim()).length}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Valor Total</p>
          <p className="text-2xl font-bold">
            R$ {editingItems.reduce((sum, item) => sum + item.totalValue, 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
