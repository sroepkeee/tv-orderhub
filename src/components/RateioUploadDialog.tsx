import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Plus, RefreshCw, Database } from "lucide-react";
import Papa from "papaparse";

interface RateioUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface RateioCsvRow {
  codigo: string;
  descricao: string;
  bu?: string;
  gestao?: string;
}

interface PreviewRow extends RateioCsvRow {
  exists: boolean;
  existingId?: string;
  derivedArea: string;
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
export const deriveBusinessAreaFromRateio = (bu?: string, gestao?: string): string => {
  const combined = `${bu || ''} ${gestao || ''}`.toUpperCase();
  
  if (combined.includes('PAINEIS') || combined.includes('PAINÉIS') || 
      combined.includes('BOWLING') || combined.includes('ELEVEN') ||
      combined.includes('PROJETO')) {
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
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const parseRow = (rawRow: Record<string, string>): RateioCsvRow | null => {
    const normalizedRow: Record<string, string> = {};
    
    // Normalize all column names
    Object.entries(rawRow).forEach(([key, value]) => {
      const normalizedKey = normalizeColumnName(key);
      normalizedRow[normalizedKey] = value?.trim() || '';
    });

    const codigo = normalizedRow['CODIGO'] || '';
    const descricao = normalizedRow['DESCRICAO'] || '';
    
    if (!codigo || !descricao) return null;

    return {
      codigo,
      descricao,
      bu: normalizedRow['BU'] || undefined,
      gestao: normalizedRow['GESTAO'] || undefined,
    };
  };

  const checkExistingProjects = async (rows: RateioCsvRow[]): Promise<PreviewRow[]> => {
    const codes = rows.map(r => r.codigo).filter(Boolean);
    
    const { data: existingProjects } = await supabase
      .from('rateio_projects')
      .select('id, project_code')
      .in('project_code', codes);

    return rows.map(row => {
      const existingProject = existingProjects?.find(p => p.project_code === row.codigo);
      const derivedArea = deriveBusinessAreaFromRateio(row.bu, row.gestao);
      return {
        ...row,
        exists: !!existingProject,
        existingId: existingProject?.id,
        derivedArea
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
            toast.error("Nenhuma linha válida encontrada. Verifique se há colunas CÓDIGO e DESCRIÇÃO.");
            setIsProcessing(false);
            return;
          }

          const previewRows = await checkExistingProjects(parsedRows);
          setPreview(previewRows);
          setStep('preview');
          
          const existingCount = previewRows.filter(r => r.exists).length;
          const newCount = previewRows.filter(r => !r.exists).length;
          
          toast.success(`${parsedRows.length} projeto(s): ${existingCount} existente(s), ${newCount} novo(s)`);
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
    if (!preview || preview.length === 0) return;

    setIsProcessing(true);

    try {
      let updated = 0;
      let created = 0;

      for (const row of preview) {
        if (row.exists && row.existingId) {
          // UPDATE existing project
          const { error } = await supabase
            .from('rateio_projects')
            .update({
              description: row.descricao,
              business_unit: row.bu || null,
              management: row.gestao || null,
              business_area: row.derivedArea,
              updated_at: new Date().toISOString()
            })
            .eq('id', row.existingId);

          if (!error) updated++;
        } else {
          // CREATE new project
          const { error } = await supabase
            .from('rateio_projects')
            .insert({
              project_code: row.codigo,
              description: row.descricao,
              business_unit: row.bu || null,
              management: row.gestao || null,
              business_area: row.derivedArea
            });

          if (!error) created++;
        }
      }

      const messages: string[] = [];
      if (updated > 0) messages.push(`${updated} atualizado(s)`);
      if (created > 0) messages.push(`${created} criado(s)`);

      toast.success(`✅ Projetos importados: ${messages.join(', ')}`);
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
  };

  const existingCount = preview.filter(r => r.exists).length;
  const newCount = preview.filter(r => !r.exists).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cadastrar Projetos (RATEIO)
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Formato do CSV (colunas obrigatórias):</strong>
                <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                  <li><code className="bg-muted px-1 rounded">CÓDIGO</code> - Código do projeto (ex: 0, 1, 3, 4)</li>
                  <li><code className="bg-muted px-1 rounded">DESCRIÇÃO</code> - Nome do projeto (ex: PROJETO ESTÁDIO BELÉM)</li>
                  <li><code className="bg-muted px-1 rounded">BU</code> - Business Unit (Controle de Acessos, Bowling, etc.)</li>
                  <li><code className="bg-muted px-1 rounded">GESTÃO</code> - Área de gestão (MATRIZ, FILIAL)</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Selecione o arquivo CSV de projetos
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Os projetos serão cadastrados e usados para preencher automaticamente os pedidos durante a importação de PDFs
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
              <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <RefreshCw className="h-3 w-3 mr-1" />
                {existingCount} a atualizar
              </Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                <Plus className="h-3 w-3 mr-1" />
                {newCount} novo(s)
              </Badge>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2 border-b">Status</th>
                      <th className="text-left p-2 border-b">CÓDIGO</th>
                      <th className="text-left p-2 border-b">DESCRIÇÃO</th>
                      <th className="text-left p-2 border-b">BU</th>
                      <th className="text-left p-2 border-b">GESTÃO</th>
                      <th className="text-left p-2 border-b">Área</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          {row.exists ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs">
                              🔄 Atualizar
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 text-xs">
                              🆕 Criar
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 font-mono font-medium">{row.codigo}</td>
                        <td className="p-2 max-w-[200px] truncate" title={row.descricao}>
                          {row.descricao}
                        </td>
                        <td className="p-2 text-xs">{row.bu || '-'}</td>
                        <td className="p-2 text-xs">{row.gestao || '-'}</td>
                        <td className="p-2">
                          <Badge variant="secondary" className="text-xs">
                            {row.derivedArea}
                          </Badge>
                        </td>
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
              <Button 
                onClick={handleImport} 
                disabled={isProcessing} 
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
                    Importar {preview.length} Projeto(s)
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
