import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseExcelOrder, ParsedOrderData } from "@/lib/excelParser";
import { parseTxtOrder } from "@/lib/txtOrderParser";
import { validateOrder, ValidationResult } from "@/lib/orderValidator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Download, Database, FileText } from "lucide-react";
import { cleanItemDescription } from "@/lib/utils";
import { useDuplicateOrderCheck } from "@/hooks/useDuplicateOrderCheck";
import { DuplicateOrderWarningDialog } from "@/components/DuplicateOrderWarningDialog";
import { OrderItemsReviewTable } from "@/components/OrderItemsReviewTable";
import { enrichWithRateioProject, RateioProject } from "@/lib/rateioEnrichment";
import { CustomerWhatsAppDialog } from "@/components/CustomerWhatsAppDialog";
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
  const [rateioProject, setRateioProject] = useState<RateioProject | null>(null);
  
  // Estado para WhatsApp do cliente extraído do TXT
  const [customerWhatsapp, setCustomerWhatsapp] = useState<string | undefined>();
  
  // Estado para diálogo de WhatsApp do cliente
  const [whatsAppDialogData, setWhatsAppDialogData] = useState<{
    open: boolean;
    customerId: string;
    customerName: string;
  } | null>(null);
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo de arquivo (TXT, CSV ou Excel)
    if (!selectedFile.name.match(/\.(xlsx|xls|txt|csv)$/i)) {
      toast.error("Formato inválido. Use .txt, .csv, .xlsx ou .xls");
      return;
    }

    // Validar tamanho (máx 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 10MB");
      return;
    }
    setFile(selectedFile);
    setCustomerWhatsapp(undefined);
    setRateioProject(null);
    
    try {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      setIsProcessing(true);
      
      let parsed: ParsedOrderData;
      
      if (fileExtension === 'txt' || fileExtension === 'csv') {
        // Parse do TXT/CSV do TOTVS
        const txtResult = await parseTxtOrder(selectedFile);
        parsed = txtResult;
        
        // Salvar WhatsApp do cliente se disponível
        if (txtResult.customerWhatsapp) {
          setCustomerWhatsapp(txtResult.customerWhatsapp);
        }
        
        // Enriquecer com dados do projeto RATEIO
        const enrichedData = await enrichWithRateioProject(parsed);
        if ((enrichedData as any).rateioProject) {
          setRateioProject((enrichedData as any).rateioProject);
          toast.success(`Projeto RATEIO encontrado: ${(enrichedData as any).rateioProject.description}`);
        }
        parsed = enrichedData;
      } else {
        // Parse do Excel
        parsed = await parseExcelOrder(selectedFile);
      }
      
      setParsedData(parsed);
      const validationResult = validateOrder(parsed);
      setValidation(validationResult);
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
        business_unit: data.orderInfo.businessUnit || null,
        business_area: data.orderInfo.businessArea || 'ssm',
        rateio_project_code: (data.orderInfo as any).rateioProjectCode || null,
        customer_whatsapp: customerWhatsapp || (data.orderInfo as any).customerWhatsapp || null
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
      
      // 🆕 Auto-cadastrar cliente na tabela customer_contacts
      const customerData = await saveCustomerFromOrder(data, order.id, user.id);
      
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
      
      // 🆕 Mostrar diálogo para cadastrar WhatsApp do cliente (se cliente foi criado/atualizado sem WhatsApp)
      if (customerData?.id && !customerData.hasWhatsApp) {
        setWhatsAppDialogData({
          open: true,
          customerId: customerData.id,
          customerName: data.orderInfo.customerName
        });
      }
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

  // 🆕 Função para salvar/atualizar cliente automaticamente
  const saveCustomerFromOrder = async (data: ParsedOrderData, orderId: string, userId: string): Promise<{ id: string; hasWhatsApp: boolean } | null> => {
    try {
      const customerDocument = data.orderInfo.customerDocument;
      const customerName = data.orderInfo.customerName;
      
      if (!customerName) return null;
      
      // Extrair cidade/estado do endereço se disponível
      const municipality = data.orderInfo.municipality || '';
      const address = data.orderInfo.deliveryAddress || '';
      
      // Verificar se cliente já existe por documento
      if (customerDocument) {
        const { data: existingCustomer } = await supabase
          .from('customer_contacts')
          .select('id, whatsapp, orders_count')
          .eq('customer_document', customerDocument)
          .maybeSingle();
        
        if (existingCustomer) {
          // Atualizar cliente existente
          await supabase
            .from('customer_contacts')
            .update({
              address: address || undefined,
              city: municipality || undefined,
              last_order_id: orderId,
              orders_count: (existingCustomer.orders_count || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingCustomer.id);
          
          console.log('✅ Cliente existente atualizado:', existingCustomer.id);
          return { id: existingCustomer.id, hasWhatsApp: !!existingCustomer.whatsapp };
        }
      }
      
      // Verificar se cliente existe pelo nome (fallback)
      const { data: existingByName } = await supabase
        .from('customer_contacts')
        .select('id, whatsapp, orders_count')
        .eq('customer_name', customerName)
        .maybeSingle();
      
      if (existingByName) {
        // Atualizar cliente existente
        await supabase
          .from('customer_contacts')
          .update({
            customer_document: customerDocument || undefined,
            address: address || undefined,
            city: municipality || undefined,
            last_order_id: orderId,
            orders_count: (existingByName.orders_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingByName.id);
        
        console.log('✅ Cliente existente (por nome) atualizado:', existingByName.id);
        return { id: existingByName.id, hasWhatsApp: !!existingByName.whatsapp };
      }
      
      // Criar novo cliente
      const { data: newCustomer, error } = await supabase
        .from('customer_contacts')
        .insert({
          customer_name: customerName,
          customer_document: customerDocument || null,
          address: address || null,
          city: municipality || null,
          source: 'import',
          last_order_id: orderId,
          orders_count: 1,
          opt_in_whatsapp: true,
          opt_in_email: true,
          preferred_channel: 'whatsapp'
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('Erro ao criar cliente:', error);
        return null;
      }
      
      console.log('✅ Novo cliente criado:', newCustomer.id);
      return { id: newCustomer.id, hasWhatsApp: false };
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      return null;
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
    setFile(null);
    setParsedData(null);
    setValidation(null);
    setIsProcessing(false);
    setCustomerWhatsapp(undefined);
    setRateioProject(null);
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
                Selecione um arquivo TXT, CSV ou Excel
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>TXT/CSV:</strong> Arquivo exportado do TOTVS (recomendado)<br />
                <strong>Excel:</strong> Arquivo com abas "PEDIDO" e "ITENS"
              </p>
              <Input 
                type="file" 
                accept=".xlsx,.xls,.txt,.csv" 
                onChange={handleFileSelect} 
                className="max-w-xs mx-auto" 
                disabled={isProcessing} 
              />
              
              <div className="mt-4 p-3 bg-muted rounded-md text-xs text-left max-w-md mx-auto">
                <p className="font-medium mb-1 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Formato TXT do TOTVS:
                </p>
                <p className="text-muted-foreground">
                  Linhas prefixadas: Cabecalho, Informacoes Gerais, Rateio, ITEM, Transporte, Entrega
                </p>
              </div>
            </div>

            {isProcessing && (
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
                  {file.name.match(/\.(txt|csv)$/i) ? '📄 TXT TOTVS' : '📊 Excel'}
                </span>}
              {customerWhatsapp && (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  📱 WhatsApp: {customerWhatsapp}
                </Badge>
              )}
            </div>
            
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
              
              {/* Seção RATEIO */}
              {(parsedData.orderInfo.costCenter || parsedData.orderInfo.accountItem || parsedData.orderInfo.businessUnit || parsedData.orderInfo.executiveName) && (
                <div className="mt-3 pt-3 border-t">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    📊 Informações de RATEIO
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {parsedData.orderInfo.executiveName && (
                      <div><strong>Executivo:</strong> {parsedData.orderInfo.executiveName}</div>
                    )}
                    {parsedData.orderInfo.costCenter && (
                      <div><strong>Centro de Custo:</strong> {parsedData.orderInfo.costCenter}</div>
                    )}
                    {parsedData.orderInfo.accountItem && (
                      <div><strong>Item Conta:</strong> {parsedData.orderInfo.accountItem}</div>
                    )}
                    {parsedData.orderInfo.businessUnit && (
                      <div><strong>B.U.:</strong> {parsedData.orderInfo.businessUnit}</div>
                    )}
                    {parsedData.orderInfo.businessArea && (
                      <div className="col-span-2">
                        <strong>Área de Negócio:</strong>{' '}
                        <Badge className={
                          parsedData.orderInfo.businessArea === 'ssm' ? 'bg-blue-100 text-blue-700' :
                          parsedData.orderInfo.businessArea === 'projetos' ? 'bg-green-100 text-green-700' :
                          parsedData.orderInfo.businessArea === 'filial' ? 'bg-orange-100 text-orange-700' :
                          parsedData.orderInfo.businessArea === 'ecommerce' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }>
                          {parsedData.orderInfo.businessArea === 'ssm' ? '🔧 Manutenção' :
                           parsedData.orderInfo.businessArea === 'projetos' ? '📐 Instalações' :
                           parsedData.orderInfo.businessArea === 'filial' ? '🏢 Filial' :
                           parsedData.orderInfo.businessArea === 'ecommerce' ? '🛒 Carrinho' :
                           parsedData.orderInfo.businessArea}
                        </Badge>
                      </div>
                    )}
                    {rateioProject && (
                      <div className="col-span-2 mt-2 p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-green-600" />
                          <strong className="text-green-700 dark:text-green-400">Projeto RATEIO:</strong>
                          <span>{rateioProject.project_code} - {rateioProject.description}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
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
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleReset}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={!validation.isValid || isProcessing || isChecking} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {isChecking ? "Verificando..." : "Importar Pedido"}
              </Button>
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
        {/* Dialog de Cadastro de WhatsApp do Cliente */}
        {whatsAppDialogData && (
          <CustomerWhatsAppDialog
            open={whatsAppDialogData.open}
            onOpenChange={(open) => {
              if (!open) setWhatsAppDialogData(null);
            }}
            customerId={whatsAppDialogData.customerId}
            customerName={whatsAppDialogData.customerName}
          />
        )}
      </DialogContent>
    </Dialog>;
};