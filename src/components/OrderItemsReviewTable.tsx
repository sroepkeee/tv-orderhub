import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, AlertTriangle, Check, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
  ncmCode?: string;
  materialType?: string;
}

interface OrderItemsReviewTableProps {
  items: OrderItem[];
  onChange: (items: OrderItem[]) => void;
}

const getMaterialTypeBadge = (materialType?: string) => {
  if (!materialType) return null;
  
  const config: Record<string, { bg: string; text: string }> = {
    'PA': { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-700 dark:text-green-300' },
    'ME': { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-300' },
    'MP': { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-700 dark:text-orange-300' },
    'MC': { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-700 dark:text-purple-300' },
    'PI': { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-700 dark:text-yellow-300' },
    'BN': { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
    'PP': { bg: 'bg-cyan-100 dark:bg-cyan-900/50', text: 'text-cyan-700 dark:text-cyan-300' },
  };
  
  const style = config[materialType] || config['BN'];
  
  return (
    <Badge className={`${style.bg} ${style.text} border-0 text-[10px] px-1.5 py-0 font-bold`}>
      {materialType}
    </Badge>
  );
};

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

  const validCount = editingItems.filter(item => validateItem(item) && item.itemCode.trim() && item.itemDescription.trim()).length;
  const pendingCount = editingItems.length - validCount;
  const totalValue = editingItems.reduce((sum, item) => sum + item.totalValue, 0);

  return (
    <div className="space-y-3">
      {/* Header compacto */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Itens ({editingItems.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
              <Check className="h-3 w-3 mr-1" />
              {validCount} válidos
            </Badge>
            {pendingCount > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {pendingCount} pendentes
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Total:</span>
            <span className="ml-2 font-bold text-lg">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <Button onClick={addItem} variant="outline" size="sm" className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Tabela otimizada */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead className="w-[40px] text-xs">#</TableHead>
                <TableHead className="w-[140px] text-xs">Código / Tipo</TableHead>
                <TableHead className="min-w-[200px] text-xs">Descrição</TableHead>
                <TableHead className="w-[70px] text-xs text-center">Qtde</TableHead>
                <TableHead className="w-[60px] text-xs text-center">Und</TableHead>
                <TableHead className="w-[90px] text-xs text-right">Preço</TableHead>
                <TableHead className="w-[90px] text-xs text-right">Total</TableHead>
                <TableHead className="w-[80px] text-xs">Armazém</TableHead>
                <TableHead className="w-[50px] text-xs text-center">OK</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editingItems.map((item, index) => {
                const isValid = validateItem(item);
                const isEmpty = !item.itemCode.trim() || !item.itemDescription.trim();
                
                return (
                  <TableRow 
                    key={index} 
                    className={`
                      ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                      ${(!isValid || isEmpty) ? 'bg-destructive/5' : ''}
                      hover:bg-muted/50
                    `}
                  >
                    <TableCell className="font-medium text-xs text-muted-foreground py-1.5">
                      {index + 1}
                    </TableCell>
                    
                    {/* Código + Material Type + NCM inline */}
                    <TableCell className="py-1.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <Input
                            value={item.itemCode}
                            onChange={(e) => updateItem(index, 'itemCode', e.target.value)}
                            className={`h-7 text-xs w-[80px] ${!item.itemCode.trim() ? 'border-destructive' : ''}`}
                            placeholder="Código"
                          />
                          {getMaterialTypeBadge(item.materialType)}
                        </div>
                        {item.ncmCode && item.ncmCode !== '0' && item.ncmCode.length >= 6 && (
                          <span className="text-[10px] text-muted-foreground font-mono ml-0.5">
                            NCM: {item.ncmCode}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Descrição com Input ao invés de Textarea */}
                    <TableCell className="py-1.5">
                      <Input
                        value={item.itemDescription}
                        onChange={(e) => updateItem(index, 'itemDescription', e.target.value)}
                        className={`h-7 text-xs ${!item.itemDescription.trim() ? 'border-destructive' : ''}`}
                        placeholder="Descrição do produto"
                        title={item.itemDescription}
                      />
                    </TableCell>
                    
                    <TableCell className="py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.requestedQuantity}
                        onChange={(e) => updateItem(index, 'requestedQuantity', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-center w-[60px]"
                      />
                    </TableCell>
                    
                    <TableCell className="py-1.5">
                      <Input
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        className="h-7 text-xs text-center w-[50px]"
                        placeholder="UND"
                      />
                    </TableCell>
                    
                    <TableCell className="py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-right w-[80px]"
                      />
                    </TableCell>
                    
                    <TableCell className="py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.totalValue}
                        onChange={(e) => updateItem(index, 'totalValue', parseFloat(e.target.value) || 0)}
                        className={`h-7 text-xs text-right font-medium w-[80px] ${!isValid ? 'border-destructive' : ''}`}
                      />
                    </TableCell>
                    
                    <TableCell className="py-1.5">
                      <Input
                        value={item.warehouse}
                        onChange={(e) => updateItem(index, 'warehouse', e.target.value)}
                        className="h-7 text-xs w-[70px]"
                        title={item.warehouse}
                      />
                    </TableCell>
                    
                    <TableCell className="py-1.5 text-center">
                      {isEmpty ? (
                        <AlertTriangle className="h-4 w-4 text-destructive mx-auto" />
                      ) : !isValid ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                      ) : (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      )}
                    </TableCell>
                    
                    <TableCell className="py-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
