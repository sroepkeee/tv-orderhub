import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseExcelOrder, ParsedOrderData } from "@/lib/excelParser";
import { parsePdfOrder } from "@/lib/pdfParser";
import { validateOrder, validatePdfOrder, ValidationResult } from "@/lib/orderValidator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";

interface ImportOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}

export const ImportOrderDialog = ({ open, onOpenChange, onImportSuccess }: ImportOrderDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedOrderData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo de arquivo
    if (!selectedFile.name.match(/\.(xlsx|xls|pdf)$/i)) {
      toast.error("Formato inválido. Use .xlsx, .xls ou .pdf");
      return;
    }

    // Validar tamanho (máx 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 10MB");
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      let parsed: any;
      let validationResult: ValidationResult;

      if (fileExtension === 'pdf') {
        // Parse do PDF
        parsed = await parsePdfOrder(selectedFile);
        setParsedData(parsed);
        
        // Validar dados do PDF
        validationResult = validatePdfOrder(parsed);
        setValidation(validationResult);
      } else {
        // Parse do Excel
        parsed = await parseExcelOrder(selectedFile);
        setParsedData(parsed);
        
        // Validar dados
        validationResult = validateOrder(parsed);
        setValidation(validationResult);
      }
      
      setStep('preview');
      
      if (validationResult.isValid) {
        toast.success("Arquivo processado com sucesso!");
      } else {
        toast.warning("Arquivo processado, mas há erros a corrigir");
      }
    } catch (error: any) {
      toast.error(`Erro ao processar arquivo: ${error.message}`);
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData || !validation?.isValid) return;

    setIsProcessing(true);
    setStep('importing');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Converter datas DD/MM/YYYY para YYYY-MM-DD
      const convertDate = (dateStr: string) => {
        if (!dateStr) return null;
        const [day, month, year] = dateStr.split('/');
        if (!day || !month || !year) return null;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      };

      // Inserir pedido
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          order_number: parsedData.orderInfo.orderNumber,
          totvs_order_number: parsedData.orderInfo.orderNumber,
          customer_name: parsedData.orderInfo.customerName,
          customer_document: parsedData.orderInfo.customerDocument || null,
          delivery_address: parsedData.orderInfo.deliveryAddress,
          municipality: parsedData.orderInfo.municipality || null,
          delivery_date: convertDate(parsedData.orderInfo.deliveryDate)!,
          shipping_date: convertDate(parsedData.orderInfo.shippingDate || '') || null,
          status: 'pending',
          priority: parsedData.orderInfo.priority || 'normal',
          order_type: 'standard',
          notes: parsedData.orderInfo.notes || '',
          carrier_name: parsedData.orderInfo.carrier || null,
          freight_type: parsedData.orderInfo.freightType || null,
          freight_value: parsedData.orderInfo.freightValue || null,
          operation_code: parsedData.orderInfo.operationCode || null,
          executive_name: parsedData.orderInfo.executiveName || null
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Registrar no histórico como "Importação"
      await supabase
        .from('order_history')
        .insert({
          order_id: order.id,
          user_id: user.id,
          old_status: 'imported',
          new_status: 'pending'
        });

      // Fazer upload do PDF para o storage (se for PDF)
      if (file && file.name.endsWith('.pdf')) {
        try {
          const timestamp = Date.now();
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const filePath = `${order.id}/${timestamp}-${sanitizedFileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('order-attachments')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });
          
          if (uploadError) {
            console.error('❌ Erro ao fazer upload do PDF:', uploadError);
            console.error('❌ Detalhes:', { filePath, fileName: file.name, fileSize: file.size });
            toast.warning('Pedido criado, mas não foi possível anexar o PDF: ' + uploadError.message);
          } else {
            console.log('✅ PDF uploaded com sucesso:', filePath);
            
            // Registrar o anexo na tabela order_attachments
            const { error: attachmentError } = await supabase
              .from('order_attachments')
              .insert({
                order_id: order.id,
                file_name: file.name,
                file_path: filePath,
                file_size: file.size,
                file_type: file.type || 'application/pdf',
                uploaded_by: user.id
              });
            
            if (attachmentError) {
              console.error('❌ Erro ao registrar anexo:', attachmentError);
              console.error('❌ Detalhes:', { order_id: order.id, file_name: file.name });
              toast.warning('PDF enviado, mas não foi possível registrar no banco');
            } else {
              console.log('✅ Anexo registrado com sucesso no banco');
            }
          }
        } catch (uploadErr) {
          console.error('Erro no processo de upload:', uploadErr);
        }
      }

      // Inserir itens
      const itemsToInsert = parsedData.items.map(item => ({
        user_id: user.id,
        order_id: order.id,
        item_code: item.itemCode,
        item_description: item.description,
        requested_quantity: item.quantity,
        delivered_quantity: 0,
        unit: item.unit,
        warehouse: item.warehouse,
        delivery_date: convertDate(item.deliveryDate || parsedData.orderInfo.deliveryDate)!,
        item_source_type: item.sourceType || 'in_stock',
        unit_price: item.unitPrice || null,
        discount_percent: item.discount || null,
        total_value: item.totalValue || null,
        ipi_percent: item.ipiPercent || null,
        icms_percent: item.icmsPercent || null
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      const pdfAttached = file?.name.endsWith('.pdf') ? '\n✅ PDF anexado automaticamente' : '';
      toast.success(`Pedido ${parsedData.orderInfo.orderNumber} importado com sucesso na fase Preparação!${pdfAttached}`);
      
      // Forçar atualização da lista de pedidos
      window.dispatchEvent(new CustomEvent('ordersUpdated'));
      
      onImportSuccess();
      onOpenChange(false);
      
      // Reset
      setFile(null);
      setParsedData(null);
      setValidation(null);
      setStep('upload');
    } catch (error: any) {
      toast.error(`Erro ao importar: ${error.message}`);
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setParsedData(null);
    setValidation(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Pedido do TOTVS
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Selecione um arquivo Excel ou PDF
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>PDF:</strong> Pedido exportado do TOTVS (recomendado)<br />
                <strong>Excel:</strong> Arquivo com abas "PEDIDO" e "ITENS"
              </p>
              <Input
                type="file"
                accept=".xlsx,.xls,.pdf"
                onChange={handleFileSelect}
                className="max-w-xs mx-auto"
                disabled={isProcessing}
              />
              
              <div className="mt-4 p-3 bg-muted rounded-md text-xs text-left max-w-md mx-auto">
                <p className="font-medium mb-1">💡 Dica para PDFs:</p>
                <p className="text-muted-foreground">
                  Exporte direto do TOTVS usando "Imprimir → Salvar como PDF" para melhor qualidade
                </p>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Formato esperado:</strong>
                <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                  <li><strong>Aba 1 (PEDIDO):</strong> Dados gerais do pedido (número, cliente, endereço, datas, transportadora, frete)</li>
                  <li><strong>Aba 2 (ITENS):</strong> Lista de itens do pedido (código, descrição, quantidade, preços)</li>
                </ul>
                <div className="mt-3">
                  <Button 
                    variant="link" 
                    className="p-0 h-auto text-primary"
                    onClick={() => {
                      toast.info("Template em desenvolvimento. Use o formato descrito acima.");
                    }}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Baixar template de exemplo
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* STEP 2: PREVIEW */}
        {step === 'preview' && parsedData && validation && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium">Arquivo: {file?.name}</span>
              {file && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
                  {file.name.endsWith('.pdf') ? '📄 PDF TOTVS' : '📊 Excel'}
                </span>
              )}
            </div>
            
            {/* Qualidade da Extração (apenas para PDF) */}
            {file?.name.endsWith('.pdf') && (parsedData as any).quality && (
              <Alert>
                <AlertDescription>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <div className="flex-1">
                      <strong>Qualidade da Extração:</strong>
                      <div className="text-sm mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          {(parsedData as any).quality.orderNumber ? '✅' : '⚠️'}
                          <span>Pedido: {parsedData.orderInfo.orderNumber || 'Não identificado'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(parsedData as any).quality.customerName ? '✅' : '⚠️'}
                          <span>Cliente: {parsedData.orderInfo.customerName || 'Não identificado'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(parsedData as any).quality.itemsCount > 0 ? '✅' : '⚠️'}
                          <span>Itens: {(parsedData as any).quality.itemsCount} encontrados</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(parsedData as any).quality.itemsWithPrice === (parsedData as any).quality.itemsCount ? '✅' : '⚠️'}
                          <span>Valores: {(parsedData as any).quality.itemsWithPrice}/{(parsedData as any).quality.itemsCount} itens com preço</span>
                        </div>
                        <div className="mt-2 pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all" 
                                style={{ width: `${((parsedData as any).quality.extractedFields / (parsedData as any).quality.totalFields) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">
                              {Math.round(((parsedData as any).quality.extractedFields / (parsedData as any).quality.totalFields) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Erros */}
            {validation.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Erros encontrados ({validation.errors.length}):</strong>
                  <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                    {validation.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Avisos */}
            {validation.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Avisos ({validation.warnings.length}):</strong>
                  <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                    {validation.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Preview dos dados */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                📦 Pedido {parsedData.orderInfo.orderNumber}
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><strong>Cliente:</strong> {parsedData.orderInfo.customerName}</div>
                <div><strong>Município:</strong> {parsedData.orderInfo.municipality || '-'}</div>
                <div><strong>Data Entrega:</strong> {parsedData.orderInfo.deliveryDate}</div>
                <div><strong>Data Embarque:</strong> {parsedData.orderInfo.shippingDate || '-'}</div>
                <div><strong>Transportadora:</strong> {parsedData.orderInfo.carrier || '-'}</div>
                <div><strong>Tipo Frete:</strong> {parsedData.orderInfo.freightType || '-'}</div>
                <div><strong>Valor Frete:</strong> R$ {parsedData.orderInfo.freightValue?.toFixed(2) || '0.00'}</div>
                <div><strong>Total Itens:</strong> {parsedData.items.length}</div>
              </div>
              {parsedData.orderInfo.notes && (
                <div className="mt-2 pt-2 border-t text-sm">
                  <strong>Observações:</strong> {parsedData.orderInfo.notes}
                </div>
              )}
            </div>

            {/* Lista de itens */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Código</th>
                      <th className="p-2 text-left">Descrição</th>
                      <th className="p-2 text-right">Qtde</th>
                      <th className="p-2 text-left">Un</th>
                      <th className="p-2 text-left">Arm</th>
                      <th className="p-2 text-right">Vlr Unit</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.items.slice(0, 10).map((item, i) => (
                      <tr key={i} className="border-t hover:bg-muted/50">
                        <td className="p-2 text-muted-foreground">{item.itemNumber}</td>
                        <td className="p-2 font-mono text-xs">{item.itemCode}</td>
                        <td className="p-2 truncate max-w-[200px]" title={item.description}>
                          {item.description}
                        </td>
                        <td className="p-2 text-right font-medium">{item.quantity}</td>
                        <td className="p-2">{item.unit}</td>
                        <td className="p-2">{item.warehouse}</td>
                        <td className="p-2 text-right">
                          {item.unitPrice ? `R$ ${item.unitPrice.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-2 text-right font-medium">
                          {item.totalValue ? `R$ ${item.totalValue.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.items.length > 10 && (
                <div className="p-3 bg-muted/50 text-center text-sm text-muted-foreground border-t">
                  + {parsedData.items.length - 10} itens adicionais
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={handleReset}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!validation.isValid || isProcessing}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Importar Pedido
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: IMPORTING */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Importando pedido...</p>
            <p className="text-sm text-muted-foreground mt-2">Aguarde, não feche esta janela</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
