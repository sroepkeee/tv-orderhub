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
import { cleanItemDescription } from "@/lib/utils";
import { useDuplicateOrderCheck } from "@/hooks/useDuplicateOrderCheck";
import { DuplicateOrderWarningDialog } from "@/components/DuplicateOrderWarningDialog";
import { OrderItemsReviewTable } from "@/components/OrderItemsReviewTable";
interface ImportOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}
export const ImportOrderDialog = ({
  open,
  onOpenChange,
  onImportSuccess
}: ImportOrderDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedOrderData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [duplicateWarning, setDuplicateWarning] = useState<{
    show: boolean;
    existingOrder: any;
    parsedData: any;
    duplicateType: 'totvs' | 'internal' | 'combined' | null;
  }>({ show: false, existingOrder: null, parsedData: null, duplicateType: null });
  const { checkDuplicate, isChecking } = useDuplicateOrderCheck();
  
  // Estados para progresso de parsing de PDF
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStatus, setParseStatus] = useState('');
  const [canAnalyzeComplete, setCanAnalyzeComplete] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
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
    
    try {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'pdf') {
        // Parsing de PDF com progresso
        await handlePdfParsing(selectedFile);
      } else {
        // Parse do Excel (mantém como está)
        setIsProcessing(true);
        const parsed = await parseExcelOrder(selectedFile);
        setParsedData(parsed);
        const validationResult = validateOrder(parsed);
        setValidation(validationResult);
        setStep('preview');
        
        if (validationResult.isValid) {
          toast.success("Arquivo processado com sucesso!");
        } else {
          toast.warning("Arquivo processado, mas há erros a corrigir");
        }
        setIsProcessing(false);
      }
    } catch (error: any) {
      toast.error(`Erro ao processar arquivo: ${error.message}`);
      setFile(null);
      setIsProcessing(false);
    }
  };

  const handlePdfParsing = async (file: File, analyzeComplete = false) => {
    setIsParsing(true);
    setParseProgress(0);
    setParseStatus('Iniciando leitura do PDF...');
    setCanAnalyzeComplete(false);

    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      const data = await parsePdfOrder(file, {
        maxPages: analyzeComplete ? undefined : 50,
        earlyStop: !analyzeComplete,
        signal: controller.signal,
        onProgress: (page: number, total: number) => {
          setParseProgress(Math.round((page / total) * 100));
          setParseStatus(`Lendo página ${page}/${total}...`);
        },
      });
      
      setParsedData(data);
      const validation = validatePdfOrder(data);
      setValidation(validation);
      
      // Aviso se parece ter itens faltando
      if (data.quality?.expectedCount && data.quality.expectedCount > data.quality.itemsCount) {
        toast.warning(
          `Foram encontrados ${data.quality.itemsCount} itens, mas o PDF indica cerca de ${data.quality.expectedCount}. ` +
          `Revise o pedido importado, pode haver itens faltando.`
        );
      }
      
      if (!analyzeComplete && data.items.length === 0) {
        setCanAnalyzeComplete(true);
        toast.warning('Nenhum item encontrado nas primeiras páginas. Deseja analisar o PDF completo?');
      }
      
      setStep('preview');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.info('Leitura cancelada');
      } else {
        console.error('Erro ao processar PDF:', error);
        toast.error(`Erro ao processar PDF: ${error.message}`);
      }
    } finally {
      setIsParsing(false);
      setAbortController(null);
    }
  };

  const handleCancelParsing = () => {
    if (abortController) {
      abortController.abort();
    }
    setIsParsing(false);
    setParseProgress(0);
    setParseStatus('');
  };

  const handleAnalyzeComplete = () => {
    if (file) {
      handlePdfParsing(file, true);
    }
  };
  const handleImport = async () => {
    if (!parsedData || !validation?.isValid) return;

    // ✨ NOVO: Verificar duplicação antes de importar
    const duplicateCheck = await checkDuplicate({
      orderNumber: parsedData.orderInfo.orderNumber,
      totvsOrderNumber: parsedData.orderInfo.orderNumber,
      customerName: parsedData.orderInfo.customerName,
      deliveryDate: parsedData.orderInfo.deliveryDate
    });

    if (duplicateCheck.isDuplicate) {
      setDuplicateWarning({
        show: true,
        existingOrder: duplicateCheck.existingOrder,
        parsedData,
        duplicateType: duplicateCheck.duplicateType
      });
      return;
    }

    // Importar normalmente
    await executeImport(parsedData);
  };

  const executeImport = async (data: ParsedOrderData, duplicateInfo?: {
    isDuplicateApproved: boolean;
    approvalNote: string;
    originalOrderId: string;
  }) => {
    setIsProcessing(true);
    setStep('importing');
    
    // 🆕 Sinalizar início de batch import
    console.log('📦 [executeImport] Iniciando importação:', {
      orderNumber: data.orderInfo.orderNumber,
      itemsCount: data.items.length,
      hasPdf: file?.name.endsWith('.pdf')
    });
    window.dispatchEvent(new CustomEvent('batchImportStart'));
    
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Converter datas DD/MM/YYYY para YYYY-MM-DD
      const convertDate = (dateStr: string) => {
        if (!dateStr) return null;
        const [day, month, year] = dateStr.split('/');
        if (!day || !month || !year) return null;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      };

      // Inserir pedido
      const {
        data: order,
        error: orderError
      } = await supabase.from('orders').insert({
        user_id: user.id,
        order_number: data.orderInfo.orderNumber,
        totvs_order_number: data.orderInfo.orderNumber,
        customer_name: data.orderInfo.customerName,
        customer_document: data.orderInfo.customerDocument || null,
        delivery_address: data.orderInfo.deliveryAddress,
        municipality: data.orderInfo.municipality || null,
        issue_date: convertDate(data.orderInfo.issueDate) || null,
        delivery_date: convertDate(data.orderInfo.deliveryDate)!,
        shipping_date: convertDate(data.orderInfo.shippingDate || '') || null,
        status: 'almox_ssm_pending',
        priority: data.orderInfo.priority || 'normal',
        order_type: 'vendas_balcao',
        notes: data.orderInfo.notes || '',
        carrier_name: data.orderInfo.carrier || null,
        freight_type: data.orderInfo.freightType || null,
        freight_value: data.orderInfo.freightValue || null,
        operation_code: data.orderInfo.operationCode || null,
        executive_name: data.orderInfo.executiveName || null,
        cost_center: data.orderInfo.costCenter || null,
        account_item: data.orderInfo.accountItem || null,
        business_area: data.orderInfo.businessArea || 'ssm'
      }).select().single();
      if (orderError) throw orderError;
      
      console.log('✅ [executeImport] Pedido inserido:', order.id);

      // Registrar criação por importação no histórico
      await supabase.from('order_changes').insert({
        order_id: order.id,
        field_name: 'created',
        old_value: '',
        new_value: 'imported',
        changed_by: user.id,
        change_category: 'order_creation',
        change_type: 'create'
      });

      // ✨ NOVO: Se for duplicata aprovada, registrar no histórico
      if (duplicateInfo?.isDuplicateApproved) {
        await supabase.from('order_changes').insert({
          order_id: order.id,
          field_name: 'duplicate_approval',
          old_value: duplicateInfo.originalOrderId,
          new_value: duplicateInfo.approvalNote || 'Duplicação aprovada pelo usuário',
          changed_by: user.id,
          change_category: 'order_creation',
          change_type: 'create'
        });
      }

      // Fazer upload do PDF para o storage (se for PDF)
      if (file && file.name.endsWith('.pdf')) {
        try {
          const timestamp = Date.now();
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const filePath = `${order.id}/${timestamp}-${sanitizedFileName}`;
          const {
            error: uploadError
          } = await supabase.storage.from('order-attachments').upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
          if (uploadError) {
            console.error('❌ Erro ao fazer upload do PDF:', uploadError);
            console.error('❌ Detalhes:', {
              filePath,
              fileName: file.name,
              fileSize: file.size
            });
            toast.warning('Pedido criado, mas não foi possível anexar o PDF: ' + uploadError.message);
            } else {
              console.log('✅ [executeImport] PDF uploaded:', filePath);

            // Registrar o anexo na tabela order_attachments
            const {
              error: attachmentError
            } = await supabase.from('order_attachments').insert({
              order_id: order.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type || 'application/pdf',
              uploaded_by: user.id
            });
            if (attachmentError) {
              console.error('❌ Erro ao registrar anexo:', attachmentError);
              console.error('❌ Detalhes:', {
                order_id: order.id,
                file_name: file.name
              });
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
      const itemsToInsert = data.items.map(item => ({
        user_id: user.id,
        order_id: order.id,
        item_code: item.itemCode,
        item_description: cleanItemDescription(item.description),
        requested_quantity: item.quantity,
        delivered_quantity: 0,
        unit: item.unit,
        warehouse: item.warehouse,
        delivery_date: convertDate(item.deliveryDate || data.orderInfo.deliveryDate)!,
        item_source_type: item.sourceType || 'in_stock',
        item_status: 'pending',
        unit_price: item.unitPrice || null,
        discount_percent: item.discount || null,
        total_value: item.totalValue || null,
        ipi_percent: item.ipiPercent || null,
        icms_percent: item.icmsPercent || null
      }));
      const {
        error: itemsError
      } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;
      
      console.log('✅ [executeImport] Items inseridos:', itemsToInsert.length);
      // Mensagem de sucesso diferenciada para importações com PDF
      if (file?.name.endsWith('.pdf')) {
        toast.success(
          `✅ Pedido ${data.orderInfo.orderNumber} importado com sucesso!\n\n📄 PDF salvo automaticamente na aba Anexos.`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Pedido ${data.orderInfo.orderNumber} importado com sucesso!`);
      }

      // ✅ Sinalizar conclusão de batch import
      window.dispatchEvent(new CustomEvent('batchImportComplete'));
      onImportSuccess();
      onOpenChange(false);

      // Reset
      setFile(null);
      setParsedData(null);
      setValidation(null);
      setStep('upload');
    } catch (error: any) {
      console.error('❌ [executeImport] Erro:', error);
      toast.error(`Erro ao importar: ${error.message}`);
      
      // 🆕 Liberar flag mesmo em caso de erro
      window.dispatchEvent(new CustomEvent('batchImportComplete'));
      
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDuplicate = async (approvalNote: string) => {
    const data = duplicateWarning.parsedData;
    await executeImport(data, {
      isDuplicateApproved: true,
      approvalNote,
      originalOrderId: duplicateWarning.existingOrder.id
    });
    setDuplicateWarning({ show: false, existingOrder: null, parsedData: null, duplicateType: null });
  };

  const handleViewExistingOrder = () => {
    setDuplicateWarning({ show: false, existingOrder: null, parsedData: null, duplicateType: null });
    onOpenChange(false);
    window.dispatchEvent(new CustomEvent('openOrder', { 
      detail: { orderId: duplicateWarning.existingOrder.id } 
    }));
  };
  const handleReset = () => {
    // Cancelar parsing se estiver rodando
    if (abortController) {
      abortController.abort();
    }
    
    setFile(null);
    setParsedData(null);
    setValidation(null);
    setIsProcessing(false);
    setIsParsing(false);
    setParseProgress(0);
    setParseStatus('');
    setCanAnalyzeComplete(false);
    setAbortController(null);
    setStep('upload');
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Pedido do TOTVS
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && <div className="space-y-4">
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
                disabled={isProcessing || isParsing} 
              />
              
              <div className="mt-4 p-3 bg-muted rounded-md text-xs text-left max-w-md mx-auto">
                <p className="font-medium mb-1">💡 Dica para PDFs:</p>
                <p className="text-muted-foreground">
                  Exporte direto do TOTVS usando "Imprimir → Salvar como PDF" para melhor qualidade
                </p>
              </div>
            </div>

            {isParsing && (
              <div className="space-y-4 py-4">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                  <p className="font-medium mb-1">Lendo PDF...</p>
                  <p className="text-sm text-muted-foreground">{parseStatus}</p>
                </div>
                
                <div className="space-y-2">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all" 
                      style={{ width: `${parseProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">{parseProgress}%</p>
                </div>

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelParsing}
                  >
                    Cancelar Leitura
                  </Button>
                </div>
              </div>
            )}

            {isProcessing && !isParsing && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Processando arquivo...</p>
                </div>
              </div>
            )}
          </div>}

        {/* STEP 2: PREVIEW */}
        {step === 'preview' && parsedData && validation && <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium">Arquivo: {file?.name}</span>
              {file && <span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
                  {file.name.endsWith('.pdf') ? '📄 PDF TOTVS' : '📊 Excel'}
                </span>}
            </div>
            
            {/* Qualidade da Extração (apenas para PDF) */}
            {file?.name.endsWith('.pdf') && (parsedData as any).quality && <Alert>
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
                        {(parsedData as any).quality.expectedCount > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              Linhas detectadas: {(parsedData as any).quality.markdownRowsCount || (parsedData as any).quality.expectedCount}
                            </span>
                          </div>
                        )}
                        {(parsedData as any).quality.detectedItemNumbers && (parsedData as any).quality.detectedItemNumbers.length > 0 && (
                          <div className="text-xs text-muted-foreground pt-1">
                            <div>Números de item: {(parsedData as any).quality.detectedItemNumbers.join(', ')}</div>
                          </div>
                        )}
                        {(parsedData as any).quality.expectedCount > 0 && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-xs">
                              Cobertura: {(parsedData as any).quality.itemsCount}/{(parsedData as any).quality.expectedCount} (
                              {Math.round(((parsedData as any).quality.itemsCount / (parsedData as any).quality.expectedCount) * 100)}%)
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {(parsedData as any).quality.itemsWithPrice === (parsedData as any).quality.itemsCount ? '✅' : '⚠️'}
                          <span>Valores: {(parsedData as any).quality.itemsWithPrice}/{(parsedData as any).quality.itemsCount} itens com preço</span>
                        </div>
                        <div className="mt-2 pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div className="bg-primary h-2 rounded-full transition-all" style={{
                          width: `${(parsedData as any).quality.extractedFields / (parsedData as any).quality.totalFields * 100}%`
                        }} />
                            </div>
                            <span className="text-sm font-medium">
                              {Math.round((parsedData as any).quality.extractedFields / (parsedData as any).quality.totalFields * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>}
            
            {/* Erros */}
            {validation.errors.length > 0 && <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Erros encontrados ({validation.errors.length}):</strong>
                  <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                    {validation.errors.map((error, i) => <li key={i}>{error}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>}

            {/* Avisos */}
            {validation.warnings.length > 0 && <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Avisos ({validation.warnings.length}):</strong>
                  <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                    {validation.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>}

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
              {parsedData.orderInfo.notes && <div className="mt-2 pt-2 border-t text-sm">
                  <strong>Observações:</strong> {parsedData.orderInfo.notes}
                </div>}
            </div>

            {/* Tabela de revisão e edição de itens */}
            <OrderItemsReviewTable
              items={parsedData.items.map(item => ({
                itemCode: item.itemCode,
                itemDescription: item.description,
                requestedQuantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice || 0,
                totalValue: item.totalValue || 0,
                discount: item.discount || 0,
                warehouse: item.warehouse,
                deliveryDate: item.deliveryDate || parsedData.orderInfo.deliveryDate
              }))}
              onChange={(updatedItems) => {
                setParsedData({
                  ...parsedData,
                  items: updatedItems.map((item, index) => ({
                    ...parsedData.items[index],
                    itemCode: item.itemCode,
                    description: item.itemDescription,
                    quantity: item.requestedQuantity,
                    unit: item.unit,
                    unitPrice: item.unitPrice,
                    totalValue: item.totalValue,
                    discount: item.discount,
                    warehouse: item.warehouse,
                    deliveryDate: item.deliveryDate
                  }))
                });
              }}
            />

            {/* Ações */}
            <div className="flex items-center gap-2 justify-between pt-2">
              <div>
                {canAnalyzeComplete && (
                  <Button 
                    onClick={handleAnalyzeComplete}
                    variant="secondary"
                    size="sm"
                  >
                    📄 Analisar PDF Completo
                  </Button>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} disabled={!validation.isValid || isProcessing || isChecking} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {isChecking ? "Verificando..." : "Importar Pedido"}
                </Button>
              </div>
            </div>
          </div>}

        {/* STEP 3: IMPORTING */}
        {step === 'importing' && <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Importando pedido...</p>
            <p className="text-sm text-muted-foreground mt-2">Aguarde, não feche esta janela</p>
          </div>}

        {/* Dialog de Aviso de Duplicação */}
        <DuplicateOrderWarningDialog
          open={duplicateWarning.show}
          onOpenChange={(open) => {
            if (!open) {
              setDuplicateWarning({ show: false, existingOrder: null, parsedData: null, duplicateType: null });
            }
          }}
          existingOrder={duplicateWarning.existingOrder}
          newOrderData={duplicateWarning.parsedData ? {
            orderNumber: duplicateWarning.parsedData.orderInfo.orderNumber,
            totvsOrderNumber: duplicateWarning.parsedData.orderInfo.orderNumber,
            customerName: duplicateWarning.parsedData.orderInfo.customerName,
            deliveryDate: duplicateWarning.parsedData.orderInfo.deliveryDate
          } : {}}
          duplicateType={duplicateWarning.duplicateType}
          onConfirm={handleConfirmDuplicate}
          onViewExisting={handleViewExistingOrder}
        />
      </DialogContent>
    </Dialog>;
};