import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseCarrierExcel, type ParsedCarrierWithValidation } from '@/lib/carrierExcelParser';
import { useCarrierImport, type ImportResult } from '@/hooks/useCarrierImport';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ImportCarriersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}

type Stage = 'upload' | 'preview' | 'importing' | 'complete';

export function ImportCarriersDialog({ open, onOpenChange, onImportSuccess }: ImportCarriersDialogProps) {
  const [stage, setStage] = useState<Stage>('upload');
  const [carriers, setCarriers] = useState<ParsedCarrierWithValidation[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<Set<number>>(new Set());
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importCarriers, loading, progress } = useCarrierImport();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error('Formato inválido. Use arquivos .xlsx ou .xls');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Tamanho máximo: 5MB');
      return;
    }

    try {
      const parsed = await parseCarrierExcel(file);
      setCarriers(parsed);
      
      // Select all valid carriers by default
      const validIndices = new Set(
        parsed
          .map((c, i) => ({ carrier: c, index: i }))
          .filter(({ carrier }) => carrier.isValid)
          .map(({ index }) => index)
      );
      setSelectedCarriers(validIndices);
      
      setStage('preview');
      toast.success(`${parsed.length} transportadora(s) encontrada(s) no arquivo`);
    } catch (error: any) {
      toast.error(error.message);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectAll = () => {
    const validIndices = carriers
      .map((c, i) => ({ carrier: c, index: i }))
      .filter(({ carrier }) => carrier.isValid)
      .map(({ index }) => index);
    setSelectedCarriers(new Set(validIndices));
  };

  const handleDeselectAll = () => {
    setSelectedCarriers(new Set());
  };

  const handleToggleCarrier = (index: number) => {
    const newSelected = new Set(selectedCarriers);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedCarriers(newSelected);
  };

  const handleImport = async () => {
    const carriersToImport = carriers
      .filter((_, i) => selectedCarriers.has(i))
      .map(c => ({
        name: c.name,
        cnpj: c.cnpj,
        email: c.email,
        quote_email: c.quote_email,
        collection_email: c.collection_email,
        whatsapp: c.whatsapp,
        phone: c.phone,
        contact_person: c.contact_person,
        contact_position: c.contact_position,
        additional_contacts: c.additional_contacts,
        service_states: c.service_states,
        coverage_notes: c.coverage_notes,
        notes: c.notes
      }));

    setStage('importing');
    const results = await importCarriers(carriersToImport);
    setImportResults(results);
    setStage('complete');
  };

  const handleClose = () => {
    if (stage === 'complete') {
      onImportSuccess();
    }
    setStage('upload');
    setCarriers([]);
    setSelectedCarriers(new Set());
    setImportResults([]);
    onOpenChange(false);
  };

  const getStatusBadge = (carrier: ParsedCarrierWithValidation) => {
    const errors = carrier.validationIssues.filter(i => i.severity === 'error');
    const warnings = carrier.validationIssues.filter(i => i.severity === 'warning');

    if (errors.length > 0) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {errors.length} erro(s)</Badge>;
    }
    if (warnings.length > 0) {
      return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> {warnings.length} aviso(s)</Badge>;
    }
    return <Badge className="gap-1 bg-green-500 hover:bg-green-600"><CheckCircle2 className="h-3 w-3" /> Válido</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Transportadoras via Excel
          </DialogTitle>
          <DialogDescription>
            {stage === 'upload' && 'Selecione um arquivo Excel (.xlsx ou .xls) com os dados das transportadoras'}
            {stage === 'preview' && 'Revise os dados e selecione quais transportadoras deseja importar'}
            {stage === 'importing' && 'Importando transportadoras...'}
            {stage === 'complete' && 'Importação concluída!'}
          </DialogDescription>
        </DialogHeader>

        {/* Stage 1: Upload */}
        {stage === 'upload' && (
          <div className="space-y-6">
            <div className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Selecione o arquivo Excel</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Formato aceito: .xlsx ou .xls (máximo 5MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button asChild>
                  <span>Escolher Arquivo</span>
                </Button>
              </label>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Download className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">Não tem o template?</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Baixe nossa planilha modelo com exemplos e instruções
                  </p>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Template
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stage 2: Preview */}
        {stage === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Selecionar Todas
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                  Desselecionar Todas
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedCarriers.size} de {carriers.length} selecionada(s)
              </p>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="space-y-2 p-4">
                {carriers.map((carrier, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 transition-colors ${
                      selectedCarriers.has(index) ? 'bg-accent/50 border-primary' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedCarriers.has(index)}
                        onCheckedChange={() => handleToggleCarrier(index)}
                        disabled={!carrier.isValid}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{carrier.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {carrier.contact_person} • {carrier.email}
                            </p>
                          </div>
                          {getStatusBadge(carrier)}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {carrier.service_states.map(state => (
                            <Badge key={state} variant="outline" className="text-xs">
                              {state}
                            </Badge>
                          ))}
                        </div>

                        {carrier.validationIssues.length > 0 && (
                          <div className="space-y-1 mt-2">
                            {carrier.validationIssues.map((issue, i) => (
                              <div
                                key={i}
                                className={`text-xs flex items-start gap-2 ${
                                  issue.severity === 'error' ? 'text-destructive' : 'text-yellow-600'
                                }`}
                              >
                                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span><strong>{issue.field}:</strong> {issue.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedCarriers.size === 0}
              >
                Importar {selectedCarriers.size} Transportadora(s)
              </Button>
            </div>
          </div>
        )}

        {/* Stage 3: Importing */}
        {stage === 'importing' && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Upload className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                Importando {selectedCarriers.size} transportadora(s)...
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Por favor, aguarde. Isso pode levar alguns segundos.
              </p>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">
              {progress}% concluído
            </p>
          </div>
        )}

        {/* Stage 4: Complete */}
        {stage === 'complete' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                Importação Concluída!
              </h3>
              <div className="flex justify-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{importResults.filter(r => r.success).length} importadas</span>
                </div>
                {importResults.filter(r => !r.success).length > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span>{importResults.filter(r => !r.success).length} erros</span>
                  </div>
                )}
              </div>
            </div>

            {importResults.filter(r => !r.success).length > 0 && (
              <ScrollArea className="h-[200px] border rounded-lg p-4">
                <div className="space-y-2">
                  {importResults
                    .filter(r => !r.success)
                    .map((result, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">{result.carrierName}</p>
                          <p className="text-muted-foreground text-xs">{result.error}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={handleClose}>
                Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
