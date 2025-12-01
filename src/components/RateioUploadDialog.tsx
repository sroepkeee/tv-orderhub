import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import Papa from "papaparse";

interface RateioUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface RateioCsvRow {
  pedido: string;
  centro_custo?: string;
  item_conta?: string;
  bu?: string;
  area?: string;
}

export const RateioUploadDialog = ({ open, onOpenChange, onSuccess }: RateioUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<RateioCsvRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.csv$/i)) {
      toast.error("Formato inválido. Use apenas arquivos .csv");
      return;
    }

    setFile(selectedFile);
    
    try {
      const text = await selectedFile.text();
      
      Papa.parse<RateioCsvRow>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data.filter(row => row.pedido);
          
          if (rows.length === 0) {
            toast.error("Nenhuma linha válida encontrada no CSV");
            return;
          }

          setPreview(rows);
          setStep('preview');
          toast.success(`${rows.length} pedido(s) encontrado(s) no CSV`);
        },
        error: (error) => {
          toast.error(`Erro ao ler CSV: ${error.message}`);
        }
      });
    } catch (error: any) {
      toast.error(`Erro ao processar arquivo: ${error.message}`);
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;

    setIsProcessing(true);

    try {
      let updated = 0;
      let notFound = 0;

      for (const row of preview) {
        const { data: order } = await supabase
          .from('orders')
          .select('id')
          .eq('order_number', row.pedido)
          .single();

        if (!order) {
          notFound++;
          continue;
        }

        const updateData: any = {};
        if (row.centro_custo) updateData.cost_center = row.centro_custo;
        if (row.item_conta) updateData.account_item = row.item_conta;
        if (row.bu) updateData.business_unit = row.bu;
        if (row.area) updateData.business_area = row.area;

        const { error } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order.id);

        if (!error) {
          updated++;
        }
      }

      if (updated > 0) {
        toast.success(`✅ ${updated} pedido(s) atualizado(s) com sucesso!`);
        onSuccess();
        onOpenChange(false);
        handleReset();
      }

      if (notFound > 0) {
        toast.warning(`⚠️ ${notFound} pedido(s) não encontrado(s) no sistema`);
      }
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                  <li><code>pedido</code> - Número do pedido (obrigatório)</li>
                  <li><code>centro_custo</code> - Centro de custo</li>
                  <li><code>item_conta</code> - Item contábil</li>
                  <li><code>bu</code> - Business Unit (Autoatendimento, Painéis, etc.)</li>
                  <li><code>area</code> - Área de negócio (ssm, projetos, filial, ecommerce)</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Selecione um arquivo CSV
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                O sistema atualizará os pedidos existentes com as informações de RATEIO
              </p>
              <Input 
                type="file" 
                accept=".csv" 
                onChange={handleFileSelect} 
                className="max-w-xs mx-auto" 
                disabled={isProcessing}
              />
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW */}
        {step === 'preview' && preview.length > 0 && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>{preview.length} pedido(s)</strong> serão atualizados com informações de RATEIO.
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2 border-b">Pedido</th>
                      <th className="text-left p-2 border-b">Centro Custo</th>
                      <th className="text-left p-2 border-b">Item Conta</th>
                      <th className="text-left p-2 border-b">B.U.</th>
                      <th className="text-left p-2 border-b">Área</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{row.pedido}</td>
                        <td className="p-2">{row.centro_custo || '-'}</td>
                        <td className="p-2">{row.item_conta || '-'}</td>
                        <td className="p-2">{row.bu || '-'}</td>
                        <td className="p-2">{row.area || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleReset} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={isProcessing} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {isProcessing ? "Importando..." : "Confirmar Importação"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
