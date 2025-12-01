import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Plus, RefreshCw } from "lucide-react";
import Papa from "papaparse";

interface RateioUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface RateioCsvRow {
  codigo: string;
  descricao?: string;
  bu?: string;
  gestao?: string;
}

interface PreviewRow extends RateioCsvRow {
  exists: boolean;
  orderId?: string;
  orderNumber?: string;
}

// Normalize column names (remove accents, uppercase)
const normalizeColumnName = (name: string): string => {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
};

// Derive business_area from BU and GESTÃO
const deriveBusinessAreaFromRateio = (bu?: string, gestao?: string): string => {
  const combined = `${bu || ''} ${gestao || ''}`.toUpperCase();
  
  if (combined.includes('PAINEIS') || combined.includes('PAINÉIS') || 
      combined.includes('BOWLING') || combined.includes('ELEVEN')) {
    return 'projetos';
  }
  if (combined.includes('E-COMMERCE') || combined.includes('ECOMMERCE') || 
      combined.includes('CARRINHO')) {
    return 'ecommerce';
  }
  if (combined.includes('FILIAL')) {
    return 'filial';
  }
  return 'ssm';
};

export const RateioUploadDialog = ({ open, onOpenChange, onSuccess }: RateioUploadDialogProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [createNewOrders, setCreateNewOrders] = useState(false);

  const parseRow = (rawRow: Record<string, string>): RateioCsvRow | null => {
    const normalizedRow: Record<string, string> = {};
    
    // Normalize all column names
    Object.entries(rawRow).forEach(([key, value]) => {
      const normalizedKey = normalizeColumnName(key);
      normalizedRow[normalizedKey] = value?.trim() || '';
    });

    const codigo = normalizedRow['CODIGO'] || '';
    if (!codigo) return null;

    return {
      codigo,
      descricao: normalizedRow['DESCRICAO'] || undefined,
      bu: normalizedRow['BU'] || undefined,
      gestao: normalizedRow['GESTAO'] || undefined,
    };
  };

  const checkExistingOrders = async (rows: RateioCsvRow[]): Promise<PreviewRow[]> => {
    const codes = rows.map(r => r.codigo).filter(Boolean);
    
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('id, order_number, totvs_order_number')
      .in('totvs_order_number', codes);

    return rows.map(row => {
      const existingOrder = existingOrders?.find(o => o.totvs_order_number === row.codigo);
      return {
        ...row,
        exists: !!existingOrder,
        orderId: existingOrder?.id,
        orderNumber: existingOrder?.order_number
      };
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.csv$/i)) {
      toast.error("Formato inválido. Use apenas arquivos .csv");
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);
    
    try {
      const text = await selectedFile.text();
      
      Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const parsedRows = results.data
            .map(parseRow)
            .filter((row): row is RateioCsvRow => row !== null);
          
          if (parsedRows.length === 0) {
            toast.error("Nenhuma linha válida encontrada no CSV. Verifique se há coluna CÓDIGO.");
            setIsProcessing(false);
            return;
          }

          const previewRows = await checkExistingOrders(parsedRows);
          setPreview(previewRows);
          setStep('preview');
          
          const existingCount = previewRows.filter(r => r.exists).length;
          const newCount = previewRows.filter(r => !r.exists).length;
          
          toast.success(`${parsedRows.length} registro(s) encontrado(s): ${existingCount} existente(s), ${newCount} novo(s)`);
          setIsProcessing(false);
        },
        error: (error) => {
          toast.error(`Erro ao ler CSV: ${error.message}`);
          setIsProcessing(false);
        }
      });
    } catch (error: any) {
      toast.error(`Erro ao processar arquivo: ${error.message}`);
      setFile(null);
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0 || !user) return;

    setIsProcessing(true);

    try {
      let updated = 0;
      let created = 0;
      let skipped = 0;

      for (const row of preview) {
        const businessArea = deriveBusinessAreaFromRateio(row.bu, row.gestao);
        
        if (row.exists && row.orderId) {
          // UPDATE existing order
          const { error } = await supabase
            .from('orders')
            .update({
              business_unit: row.bu || null,
              business_area: businessArea
            })
            .eq('id', row.orderId);

          if (!error) updated++;
        } else if (createNewOrders) {
          // CREATE new order
          const { error } = await supabase
            .from('orders')
            .insert({
              totvs_order_number: row.codigo,
              order_number: `TOTVS-${row.codigo}`,
              customer_name: row.descricao || 'Sem descrição',
              business_unit: row.bu || null,
              business_area: businessArea,
              status: 'pending',
              priority: 'medium',
              delivery_date: new Date().toISOString().split('T')[0],
              delivery_address: 'A definir',
              order_type: 'outros',
              user_id: user.id
            });

          if (!error) created++;
        } else {
          skipped++;
        }
      }

      const messages: string[] = [];
      if (updated > 0) messages.push(`${updated} atualizado(s)`);
      if (created > 0) messages.push(`${created} criado(s)`);
      if (skipped > 0) messages.push(`${skipped} ignorado(s)`);

      toast.success(`✅ Importação concluída: ${messages.join(', ')}`);
      onSuccess();
      onOpenChange(false);
      handleReset();
    } catch (error: any) {
      toast.error(`Erro ao importar: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview([]);
    setStep('upload');
    setCreateNewOrders(false);
  };

  const existingCount = preview.filter(r => r.exists).length;
  const newCount = preview.filter(r => !r.exists).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar RATEIO via CSV
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Formato esperado do CSV:</strong>
                <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                  <li><code className="bg-muted px-1 rounded">CÓDIGO</code> - Código TOTVS do pedido (obrigatório, para localizar)</li>
                  <li><code className="bg-muted px-1 rounded">DESCRIÇÃO</code> - Descrição do pedido</li>
                  <li><code className="bg-muted px-1 rounded">BU</code> - Business Unit (Autoatendimento, Painéis, Bowling, etc.)</li>
                  <li><code className="bg-muted px-1 rounded">GESTÃO</code> - Área de gestão (SSM, Projetos, Filial, E-commerce)</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Selecione um arquivo CSV
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                O sistema localizará pedidos pelo código TOTVS e atualizará as informações de RATEIO
              </p>
              <Input 
                type="file" 
                accept=".csv" 
                onChange={handleFileSelect} 
                className="max-w-xs mx-auto" 
                disabled={isProcessing}
              />
              {isProcessing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processando arquivo...
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW */}
        {step === 'preview' && preview.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {existingCount} existente(s)
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Plus className="h-3 w-3 mr-1" />
                {newCount} novo(s)
              </Badge>
            </div>

            {newCount > 0 && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Checkbox 
                  id="createNew" 
                  checked={createNewOrders}
                  onCheckedChange={(checked) => setCreateNewOrders(!!checked)}
                />
                <Label htmlFor="createNew" className="text-sm cursor-pointer">
                  Criar novos pedidos para {newCount} código(s) não encontrado(s)
                </Label>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2 border-b">Status</th>
                      <th className="text-left p-2 border-b">CÓDIGO</th>
                      <th className="text-left p-2 border-b">Descrição</th>
                      <th className="text-left p-2 border-b">BU</th>
                      <th className="text-left p-2 border-b">Gestão</th>
                      <th className="text-left p-2 border-b">Área Derivada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => {
                      const derivedArea = deriveBusinessAreaFromRateio(row.bu, row.gestao);
                      return (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            {row.exists ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 text-xs">
                                ✅ Atualizar
                              </Badge>
                            ) : createNewOrders ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs">
                                🆕 Criar
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs">
                                ⏭️ Ignorar
                              </Badge>
                            )}
                          </td>
                          <td className="p-2 font-mono font-medium">{row.codigo}</td>
                          <td className="p-2 max-w-[200px] truncate" title={row.descricao}>
                            {row.descricao || '-'}
                          </td>
                          <td className="p-2">{row.bu || '-'}</td>
                          <td className="p-2">{row.gestao || '-'}</td>
                          <td className="p-2">
                            <Badge variant="secondary" className="text-xs">
                              {derivedArea}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleReset} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={isProcessing || (existingCount === 0 && !createNewOrders)} 
                className="gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar Importação
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
