import type { ParsedOrderData } from './excelParser';
import { addBusinessDays } from './utils';

// Lazy load pdfjs to avoid conflicts with React
let pdfjsLib: any = null;
let pdfWorker: Worker | null = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    // Load library and worker URL in parallel
    const [pdfjs, workerUrlMod] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ]);
    
    pdfjsLib = pdfjs;
    
    if (typeof window !== 'undefined') {
      const workerUrlRaw = (workerUrlMod as any).default ?? workerUrlMod;
      const workerUrl = typeof workerUrlRaw === 'string' ? workerUrlRaw : String(workerUrlRaw);

      if (!pdfWorker) {
        pdfWorker = new Worker(workerUrl, { type: 'module' });
        pdfWorker.onerror = (ev: ErrorEvent) => {
          console.warn('⚠️ Erro no PDF.js worker:', (ev && ev.message) || ev);
        };
      }

      // Force PDF.js to use this local worker port
      pdfjsLib.GlobalWorkerOptions.workerPort = pdfWorker;
      // Also set a valid local workerSrc string (no CDN)
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

      console.log('📄 PDF.js worker (port):', workerUrl);
      console.log('📄 PDF.js workerSrc (local):', workerUrl);
    }
  }
  return pdfjsLib;
}

interface ExtractionQuality {
  orderNumber: boolean;
  customerName: boolean;
  itemsCount: number;
  itemsWithPrice: number;
  totalFields: number;
  extractedFields: number;
  expectedCount: number;
  detectedItemNumbers: string[];
  markdownRowsCount: number;
  unitDistribution: Record<string, number>;
  tableTextRaw?: string;
}

export interface ParseOptions {
  maxPages?: number;
  earlyStop?: boolean;
  onProgress?: (page: number, total: number) => void;
  signal?: AbortSignal;
}

export async function parsePdfOrder(
  file: File,
  options?: ParseOptions
): Promise<ParsedOrderData & { quality?: ExtractionQuality }> {
  console.log('📄 PDF parsing iniciado:', file.name);
  
  // Get pdfjs dynamically to avoid React conflicts
  const pdfjs = await getPdfJs();
  
  const arrayBuffer = await file.arrayBuffer();
  
  // Try to load PDF with worker; fallback to inline processing if worker fails
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (e: any) {
    const errorMsg = String(e?.message || e);
    if (errorMsg.includes('Setting up fake worker failed') || errorMsg.includes('Failed to fetch') || errorMsg.includes('Invalid workerSrc type')) {
      console.warn('⚠️ Worker falhou, tentando processamento inline...');
      // Retry with inline processing (disableWorker)
      pdf = await pdfjs.getDocument({ data: arrayBuffer, disableWorker: true }).promise;
    } else {
      throw e;
    }
  }
  
  const totalPages = pdf.numPages;
  const maxPages = options?.maxPages ?? totalPages;
  const pagesToRead = Math.min(maxPages, totalPages);
  
  let fullText = '';
  let orderHeader: any = null;
  let items: any[] = [];
  
  // Extrair texto com progresso e early-stop
  for (let i = 1; i <= pagesToRead; i++) {
    // Checar se foi cancelado
    if (options?.signal?.aborted) {
      throw new DOMException('Leitura cancelada', 'AbortError');
    }

    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
    
    // Reportar progresso
    options?.onProgress?.(i, pagesToRead);
    
    // Tentar extrair dados incrementalmente
    if (!orderHeader || !orderHeader.orderNumber) {
      orderHeader = extractOrderHeader(fullText);
    }
    
    // SEMPRE extrair itens do texto acumulado
    const extractionResult = extractItemsTable(fullText);
    
    // Mesclar novos itens com os existentes (evitar duplicatas)
    if (extractionResult.items.length > 0) {
      extractionResult.items.forEach(newItem => {
        const exists = items.some(
          existing => existing.itemCode === newItem.itemCode && existing.itemNumber === newItem.itemNumber
        );
        if (!exists) {
          items.push(newItem);
        }
      });
      
      if (import.meta.env.DEV) {
        console.log(`📄 Página ${i}: Total acumulado de ${items.length} itens`);
      }
    }
    
    // Early stop apenas quando detectar TOTAL DO PEDIDO (fim real do pedido)
    const hasEndMarker = fullText.includes('TOTAL DO PEDIDO');
    if (options?.earlyStop && orderHeader?.orderNumber && items.length > 0 && hasEndMarker) {
      if (import.meta.env.DEV) {
        console.log(`✅ [pdfParser] Early stop na página ${i}/${pagesToRead} - Fim do documento detectado`);
      }
      break;
    }
    
    // Yield para manter UI responsiva (fallback mode)
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // Logs apenas em DEV
  if (import.meta.env.DEV) {
    console.log('📊 Texto extraído (primeiros 1000 chars):', fullText.substring(0, 1000));
  }
  
  // Se não extraímos ainda, tentar agora com texto completo
  let extractionMetrics = { 
    expectedCount: 0, 
    markdownRowsCount: 0, 
    detectedItemNumbers: [] as string[], 
    unitDistribution: {} as Record<string, number>,
    tableTextRaw: '' 
  };
  if (!orderHeader) {
    orderHeader = extractOrderHeader(fullText);
  }
  if (items.length === 0) {
    const result = extractItemsTable(fullText);
    items = result.items;
    extractionMetrics = result.metrics;
  }
  
  if (import.meta.env.DEV) {
    console.log('✅ Pedido identificado:', orderHeader?.orderNumber);
    console.log(`📦 Parsing concluído: ${items.length} itens extraídos de ${pagesToRead} página(s)`);
    
    // Avisar se parece incompleto
    if (items.length > 0 && items.length < 5 && totalPages > 1) {
      console.warn(`⚠️ Apenas ${items.length} itens extraídos de um PDF com ${totalPages} páginas - pode estar incompleto`);
    }
  }
  
  // Calcular qualidade da extração com métricas enriquecidas
  const quality: ExtractionQuality = {
    orderNumber: !!orderHeader?.orderNumber,
    customerName: !!orderHeader?.customerName,
    itemsCount: items.length,
    itemsWithPrice: items.filter((i: any) => i.unitPrice).length,
    totalFields: 11,
    extractedFields: [
      orderHeader?.orderNumber,
      orderHeader?.customerName,
      orderHeader?.deliveryAddress,
      orderHeader?.deliveryDate,
      orderHeader?.freightType,
      orderHeader?.carrier,
      orderHeader?.operationCode,
      orderHeader?.executiveName,
      orderHeader?.municipality,
      orderHeader?.freightValue,
      orderHeader?.customerDocument
    ].filter(Boolean).length,
    expectedCount: extractionMetrics.expectedCount,
    detectedItemNumbers: extractionMetrics.detectedItemNumbers,
    markdownRowsCount: extractionMetrics.markdownRowsCount,
    unitDistribution: extractionMetrics.unitDistribution,
    tableTextRaw: extractionMetrics.tableTextRaw
  };
  
  return {
    orderInfo: orderHeader || {},
    items,
    quality
  };
}

function extractOrderHeader(text: string): ParsedOrderData['orderInfo'] {
  const orderInfo: any = {};
  
  console.log('🔍 Iniciando extração de cabeçalho...');
  
  // PEDIDO Nº - mais robusto
  const orderNumberMatch = text.match(/PEDIDO\s+N[ºo°]?:?\s*(\d+)/i);
  if (orderNumberMatch) {
    orderInfo.orderNumber = orderNumberMatch[1];
    console.log('✅ Pedido:', orderInfo.orderNumber);
  }
  
  // EMISSÃO para issueDate
  const issueDateMatch = text.match(/EMISS[AÃ]O:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (issueDateMatch) {
    orderInfo.issueDate = issueDateMatch[1];
    console.log('✅ Data Emissão:', orderInfo.issueDate);
  }
  
  // DATA DE ENTREGA
  const deliveryDateMatch = text.match(/(?:ENTREGA|PREVIS[ÃA]O|DATA\s+ENTREGA):?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (deliveryDateMatch) {
    orderInfo.deliveryDate = deliveryDateMatch[1];
    console.log('✅ Data Entrega (do PDF):', orderInfo.deliveryDate);
  } else if (orderInfo.issueDate) {
    // Calcular 10 dias úteis a partir da emissão
    orderInfo.deliveryDate = addBusinessDays(orderInfo.issueDate, 10);
    console.log('✅ Data Entrega (calculada):', orderInfo.deliveryDate, '(10 dias úteis)');
  }
  
  // CLIENTE - Suporta múltiplos formatos: CLIENTE:, RAZÃO SOCIAL:, NOME/RAZÃO SOCIAL:
  let clientMatch = text.match(/(?:NOME\/RAZ[ÃA]O\s+SOCIAL|RAZ[ÃA]O\s+SOCIAL|CLIENTE):?\s*(.+?)(?=\s*(?:CPF\/CNPJ|CNPJ|CPF|LOJA|INSC\s+EST|CONTATO))/i);
  
  if (clientMatch) {
    // Limpar nome: remover código numérico inicial (ex: "005161 - ") e espaços extras
    let cleanName = clientMatch[1]
      .trim()
      .replace(/^\d+\s*-\s*/, '') // Remove código inicial "005161 - "
      .replace(/\s+/g, ' ') // Normaliza espaços
      .replace(/\s+\d+$/, '') // Remove código de loja no final
      .replace(/LOJA\s*\d*$/i, ''); // Remove "LOJA" no final
    
    orderInfo.customerName = cleanName;
    console.log('✅ Cliente:', orderInfo.customerName);
  } else {
    console.warn('⚠️ Nome do cliente não encontrado');
  }
  
  // CNPJ/CPF - Suporta ambos os formatos
  const docMatch = text.match(/(?:CPF\/CNPJ|CNPJ\/CPF|CNPJ|CPF):?\s*([\d.\-\/]+)/i);
  if (docMatch) {
    orderInfo.customerDocument = docMatch[1].replace(/[.\-\/]/g, '').trim(); // Remove formatação
    console.log('✅ CNPJ/CPF:', orderInfo.customerDocument);
  }
  
  // ENDEREÇO - padrão mais específico
  const addressMatch = text.match(/ENDERE[ÇC]O:?\s*([^\n]+?)(?=\s*(?:N[ºo°]|BAIRRO|MUNIC[ÍI]PIO|COMPLEMENTO|\n))/i);
  if (addressMatch) {
    orderInfo.deliveryAddress = addressMatch[1].trim();
    console.log('✅ Endereço:', orderInfo.deliveryAddress);
  }
  
  // MUNICÍPIO - Suporta "MUNICÍPIO:" e "MUNICÍPIO/UF:", remove UF no final
  const municipioMatch = text.match(/MUNIC[ÍI]PIO(?:\/UF)?:?\s*([A-Z\s]+?)(?=\s*(?:-\s*[A-Z]{2}|UF:|CEP|\d{5}|\n))/i);
  if (municipioMatch) {
    // Remove " - PB" ou similar do final
    orderInfo.municipality = municipioMatch[1].trim().replace(/\s*-\s*[A-Z]{2}\s*$/, '');
    console.log('✅ Município:', orderInfo.municipality);
  }
  
  // TRANSPORTADORA - evitar capturar placa
  const transportadoraMatch = text.match(/TRANSPORTADORA:?\s*([A-Z0-9\s\-\.]+?)(?=\s*(?:PLACA|FRETE|REDESPACHO|\n))/i);
  if (transportadoraMatch) {
    orderInfo.carrier = transportadoraMatch[1].trim();
    console.log('✅ Transportadora:', orderInfo.carrier);
  }
  
  // FRETE/TIPO - Extrai apenas o tipo (CIF, FOB) removendo prefixo "C-", "F-"
  const freightTypeMatch = text.match(/FRETE\/TIPO:?\s*(?:[A-Z]-)?([A-Z]{3})/i);
  if (freightTypeMatch) {
    orderInfo.freightType = freightTypeMatch[1].trim().toUpperCase();
    console.log('✅ Tipo Frete:', orderInfo.freightType);
  }
  
  // VALOR FRETE - Busca na seção TRANSPORTE
  const freightValueMatch = text.match(/FRETE\/TIPO:.*?VALOR:?\s*R?\$?\s*([\d.,]+)/is);
  if (freightValueMatch) {
    const value = freightValueMatch[1].replace(/\./g, '').replace(',', '.');
    orderInfo.freightValue = parseFloat(value);
    console.log('✅ Valor Frete:', orderInfo.freightValue);
  }
  
  // OPERAÇÃO - Busca "Operação 535REMESSA..." e extrai código com descrição
  const operacaoMatch = text.match(/Opera[çc][ãa]o\s+(\d+[A-Z\s]+?)(?=\s+Descri[çc][ãa]o|\n)/i);
  if (operacaoMatch) {
    orderInfo.operationCode = operacaoMatch[1].trim();
    console.log('✅ Código Operação:', orderInfo.operationCode);
  }
  
  // EXECUTIVO/REPRESENTANTE - Buscar campo EXECUTIVO: diretamente
  // Exemplo: "EXECUTIVO: SSM - PAINEIS"
  const execMatch = text.match(/EXECUTIVO:?\s*([A-Z0-9\s\-\.]+?)(?=\s*(?:MATRIZ|FILIAL|EMPRESA|ROD|CNPJ|CENTRO\s+CUSTO|\n\n))/i);
  if (execMatch) {
    orderInfo.executiveName = execMatch[1].trim();
    console.log('✅ Executivo:', orderInfo.executiveName);
  } else {
    // Fallback: buscar padrão em campos de RATEIO se não encontrar EXECUTIVO:
    const execFallback = text.match(/(?:CENTRO\s+CUSTO|ITEM|CONTA)\s+([A-Z\s\-]+?)(?=\s+(?:PROJETO|POS\s+VENDA|TRANSPORTE|\n\n))/i);
    if (execFallback) {
      orderInfo.executiveName = execFallback[1].trim();
      console.log('✅ Executivo (fallback):', orderInfo.executiveName);
    }
  }
  
  // Valores padrão
  orderInfo.priority = 'normal';
  
  // Relatório de qualidade da extração
  const extractedCount = [
    orderInfo.orderNumber,
    orderInfo.customerName,
    orderInfo.deliveryAddress,
    orderInfo.municipality,
    orderInfo.carrier,
    orderInfo.freightType,
    orderInfo.operationCode,
    orderInfo.executiveName,
    orderInfo.customerDocument,
    orderInfo.deliveryDate,
    orderInfo.freightValue
  ].filter(Boolean).length;
  
  // RATEIO - Extrai Centro de Custo, Item Conta e BU da tabela
  console.log('🔍 INICIANDO EXTRAÇÃO RATEIO...');
  
  // Extrair toda a seção RATEIO para debug
  const rateioDebugMatch = text.match(/RATEIO[\s\S]{0,300}/i);
  if (rateioDebugMatch) {
    console.log('📄 Seção RATEIO encontrada (primeiros 300 caracteres):', rateioDebugMatch[0]);
  } else {
    console.warn('⚠️ Palavra "RATEIO" não encontrada no PDF!');
  }
  
  // Padrão: linha após cabeçalhos contém os valores (ex: "SSM - CUSTOMER SERVICE    PROJETO POS VENDA - CUSTOMER SERVICE    Autoatendimento")
  const rateioSectionMatch = text.match(/RATEIO[\s\S]{0,200}?(?:Centro\s+de\s+custo|Centro\s+Custo)[\s\S]{0,50}?(?:Item\s+conta)[\s\S]{0,50}?(?:BU)[\s\S]{0,10}?\n([^\n]+)/i);
  
  if (rateioSectionMatch) {
    const rateioLine = rateioSectionMatch[1].trim();
    console.log('✅ REGEX MATCH! Linha RATEIO bruta:', rateioLine);
    
    // Tentar separar os valores (geralmente separados por múltiplos espaços)
    const parts = rateioLine.split(/\s{2,}/); // 2+ espaços como separador
    console.log('📊 Partes separadas:', parts.length, '|', parts);
    
    if (parts.length >= 1) orderInfo.costCenter = parts[0].trim();
    if (parts.length >= 2) orderInfo.accountItem = parts[1].trim();
    if (parts.length >= 3) orderInfo.businessUnit = parts[2].trim();
    
    console.log('✅ TABELA - Centro Custo:', orderInfo.costCenter);
    console.log('✅ TABELA - Item Conta:', orderInfo.accountItem);
    console.log('✅ TABELA - BU:', orderInfo.businessUnit);
  } else {
    console.warn('❌ REGEX NÃO ENCONTROU PADRÃO DA TABELA, tentando fallbacks individuais...');
    
    // Fallback melhorado: extrair cada campo individualmente
    // Centro de Custo: captura "SSM - CUSTOMER SERVICE", "PROJETO - CUSTOMER SERVICE", etc.
    const centroCustoMatch = text.match(/(?:CENTRO\s+(?:DE\s+)?CUSTO)[:\s]*([A-Z0-9\s\-]+?)(?=\s+(?:ITEM|PROJETO|BU|\n))/i);
    if (centroCustoMatch) {
      orderInfo.costCenter = centroCustoMatch[1].trim();
      console.log('✅ Centro Custo (fallback individual):', orderInfo.costCenter);
    }
    
    // Item Conta: captura "PROJETO POS VENDA - CUSTOMER SERVICE", etc.
    const itemContaMatch = text.match(/ITEM\s+CONTA[:\s]*([A-Z0-9\s\-]+?)(?=\s+(?:BU|Autoatend|Bowling|Pain[ée]|Eleven|Filial|TRANSPORTE|\n))/i);
    if (itemContaMatch) {
      orderInfo.accountItem = sanitizeAccountItem(itemContaMatch[1].trim());
      console.log('✅ Item Conta (fallback individual):', orderInfo.accountItem);
    } else {
      // Fallback adicional sem "ITEM CONTA" - limita até CUSTOMER SERVICE ou marcadores
      const itemFallback = text.match(/PROJETO\s+(?:POS\s*VENDA|E-COMMERCE|FILIAL)(?:\s*-\s*(?:CUSTOMER\s+SERVICE|PROJETOS|E-?COMMERCE))?/i);
      if (itemFallback) {
        orderInfo.accountItem = sanitizeAccountItem(itemFallback[0].trim());
        console.log('✅ Item Conta (fallback genérico):', orderInfo.accountItem);
      }
    }
    
    // BU: captura nomes específicos de business units
    const buMatch = text.match(/\b(Autoatendimento|Bowling|ElevenTickets|Pain[ée]is|Filial)\b/i);
    if (buMatch) {
      orderInfo.businessUnit = buMatch[1].trim();
      console.log('✅ BU (fallback individual):', orderInfo.businessUnit);
    }
  }

  // Derivar área de negócio automaticamente (incluindo executiveName como fallback)
  orderInfo.businessArea = deriveBusinessArea(orderInfo.costCenter, orderInfo.accountItem, orderInfo.businessUnit, orderInfo.executiveName);
  console.log('🎯 ÁREA DE NEGÓCIO FINAL:', orderInfo.businessArea, '(derivada de CC:', orderInfo.costCenter, '| IC:', orderInfo.accountItem, '| BU:', orderInfo.businessUnit, '| Exec:', orderInfo.executiveName, ')');

  console.log('📊 Resumo da extração:', {
    pedido: !!orderInfo.orderNumber,
    cliente: !!orderInfo.customerName,
    documento: !!orderInfo.customerDocument,
    endereco: !!orderInfo.deliveryAddress,
    municipio: !!orderInfo.municipality,
    transportadora: !!orderInfo.carrier,
    frete: !!orderInfo.freightType,
    valorFrete: !!orderInfo.freightValue,
    operacao: !!orderInfo.operationCode,
    executivo: !!orderInfo.executiveName,
    dataEntrega: !!orderInfo.deliveryDate,
    costCenter: !!orderInfo.costCenter,
    accountItem: !!orderInfo.accountItem,
    businessUnit: !!orderInfo.businessUnit,
    businessArea: !!orderInfo.businessArea
  });
  console.log(`✅ Campos extraídos: ${extractedCount + (orderInfo.costCenter ? 1 : 0) + (orderInfo.accountItem ? 1 : 0) + (orderInfo.businessUnit ? 1 : 0)}/14`);
  
  return orderInfo;
}

/**
 * Sanitiza o valor do campo Item Conta, removendo texto extra após marcadores conhecidos
 */
function sanitizeAccountItem(value: string): string {
  if (!value) return value;
  
  // Lista de marcadores que indicam fim do campo Item Conta
  const stopMarkers = [
    'TRANSPORTE',
    'TRANSPORTADORA',
    'SERVICO DE POSTAGEM',
    'SERVIÇO DE POSTAGEM',
    'FRETE/TIPO',
    'FRETE:',
    'VALOR:',
    'EMBARQUE:',
    'OBSERVAÇÃO:',
    'OBSERVACAO:',
    'DADOS DE ENTREGA',
    'CORREIOS',
    'CENTRALPOST'
  ];
  
  let result = value;
  const upperResult = result.toUpperCase();
  
  for (const marker of stopMarkers) {
    const idx = upperResult.indexOf(marker);
    if (idx > 0) {
      result = result.substring(0, idx).trim();
      break;
    }
  }
  
  return result;
}

/**
 * Deriva a área de negócio baseada no Centro de Custo, Item Conta, BU e Executivo
 * 
 * Regras de classificação:
 * - E-commerce: Centro de Custo contém "SSM E-COMMERCE"
 * - Filial: Centro de Custo contém "FILIAL" ou remetente "IMPLY TECNOLOGIA FILIAL"
 * - Projetos: Centro de Custo contém "SSM - PROJETOS"
 * - SSM: Centro de Custo contém "SSM - CUSTOMER SERVICE"
 */
function deriveBusinessArea(costCenter?: string, accountItem?: string, businessUnit?: string, executiveName?: string): string {
  const combined = `${costCenter || ''} ${accountItem || ''} ${businessUnit || ''} ${executiveName || ''}`.toUpperCase();
  
  // E-commerce = SSM E-commerce
  if (combined.includes('SSM E-COMMERCE') || combined.includes('SSM ECOMMERCE') || combined.includes('SSM - E-COMMERCE')) {
    return 'ecommerce';
  }
  
  // Filial = FILIAL no Centro de Custo ou remetente
  if (combined.includes('FILIAL')) {
    return 'filial';
  }
  
  // Projetos = SSM - Projetos (Painéis, Bowling, Eleven, etc.)
  if (combined.includes('SSM - PROJETOS') || combined.includes('SSM PROJETOS') ||
      combined.includes('PAINEIS') || combined.includes('PAINÉIS') ||
      combined.includes('BOWLING') || combined.includes('ELEVEN')) {
    return 'projetos';
  }
  
  // SSM = SSM - Customer Service (default)
  if (combined.includes('SSM - CUSTOMER') || combined.includes('CUSTOMER SERVICE') ||
      combined.includes('SSM') || combined.includes('AUTOATENDIMENTO') ||
      combined.includes('POS-VENDA') || combined.includes('PÓS-VENDA') || combined.includes('POS VENDA')) {
    return 'ssm';
  }
  
  return 'ssm'; // Default
}

/**
 * Remove padrões de cabeçalho que foram erroneamente concatenados à descrição do item
 */
function sanitizeItemDescription(description: string): string {
  return description
    .replace(/\s*EMPRESA:.*$/i, '')
    .replace(/\s*PEDIDO\s+N[ºo°]?:.*$/i, '')
    .replace(/\s*EMISS[ÃA]O:.*$/i, '')
    .replace(/\s*EXECUTIVO:.*$/i, '')
    .replace(/\s*MATRIZ:.*$/i, '')
    .replace(/\s*ROD\..*$/i, '')
    .replace(/\s*RST\s+\d+.*$/i, '')
    .trim();
}

// Helper function to find item description separately - REESCRITA para prevenir troca entre itens
function findItemDescription(blockText: string, itemCode: string, itemNumber: string): string {
  // ESTRATÉGIA: Procurar descrição APENAS dentro do bloco do item (sem expansão)
  // Isso previne a captura de descrições de itens adjacentes
  
  // Padrão 1: "Descrição: TEXTO" dentro do bloco
  const descPattern1 = /Descri[çc][ãa]o[:\s]+(.+?)(?=Qtde|Uni|V\.\s*Unit|Desc\s|Total\s|Armaz|Item\s+\d+|C[óo]digo\s+\d{4,}|$)/is;
  const match1 = blockText.match(descPattern1);
  if (match1 && match1[1].trim().length > 8) {
    const desc = match1[1]
      .trim()
      .replace(/\s+/g, ' ')  // Normalizar espaços
      .replace(/^\d+\s*-?\s*/, '')  // Remover código numérico inicial se houver
      .substring(0, 200);
    
    if (desc.length >= 8 && desc.length <= 200) {
      return sanitizeItemDescription(desc);
    }
  }
  
  // Padrão 2: Texto imediatamente após "Código XXXXX" (sem rótulo "Descrição:")
  const codeIndex = blockText.indexOf(itemCode);
  if (codeIndex !== -1) {
    const afterCode = blockText.substring(codeIndex + itemCode.length, codeIndex + itemCode.length + 300);
    // Procurar texto em maiúsculas que pareça descrição (10-150 caracteres)
    const implicitDescPattern = /^\s*([A-ZÀÁÃÂÉÊÍÓÔÕÚÇ][A-ZÀÁÃÂÉÊÍÓÔÕÚÇ0-9\s,\-\.\/\(\)]{10,150}?)(?=\s*Qtde|\s*\d+[\.,]\d+|\s*UND|$)/i;
    const match2 = afterCode.match(implicitDescPattern);
    if (match2 && match2[1]) {
      const desc = match2[1].trim().replace(/\s+/g, ' ');
      if (desc.length >= 10 && desc.length <= 200) {
        return sanitizeItemDescription(desc);
      }
    }
  }
  
  return 'Produto TOTVS';
}

function extractItemsTable(text: string): { 
  items: ParsedOrderData['items']; 
  metrics: { 
    expectedCount: number; 
    markdownRowsCount: number; 
    detectedItemNumbers: string[];
    unitDistribution: Record<string, number>;
    tableTextRaw: string;
  } 
} {
  const items: ParsedOrderData['items'] = [];
  
  // 1. SANITIZAÇÃO ROBUSTA: Normalizar espaços, quebras e remover separadores de tabela
  // Primeiro, preservar uma cópia antes de remover pipes (para detectar tabelas markdown)
  const textBeforePipeRemoval = text
    .replace(/\s{2,}/g, ' ')  // Múltiplos espaços → 1 espaço
    .replace(/([A-Za-z])\.\s*\n\s*([A-Za-z])/g, '$1. $2')  // Reunir quebras no meio de palavras
    .replace(/(\d)\s*\n\s*(\d{4,})/g, '$1 $2');  // Juntar "número + quebra + código" (ex: "28 \n 023460" → "28 023460")
  
  // Agora remover pipes e normalizar
  const sanitizedText = textBeforePipeRemoval
    .replace(/\|/g, ' ')  // Remover pipes (separadores de tabela)
    .replace(/\s{2,}/g, ' ');  // Normalizar múltiplos espaços novamente
  
  // 2. Localizar cabeçalho da tabela
  const headerPatterns = [
    /(?:^|\n)\s*(?:#\s+)?Item\s+.*?C[óo]digo\s+.*?Descri[çc][ãa]o\s+.*?Qtde/i,
    /(?:^|\n)\s*C[óo]digo\s+Descri[çc][ãa]o\s+Qtde\s+Un/i,
    /COMPOSI[ÇC][ÃA]O/i
  ];
  let tableStart = -1;
  for (const pat of headerPatterns) {
    const idx = sanitizedText.search(pat);
    if (idx !== -1) { tableStart = idx; break; }
  }
  if (tableStart === -1) {
    console.warn('⚠️ Cabeçalho da tabela de itens não encontrado');
    return {
      items: [],
      metrics: {
        expectedCount: 0,
        markdownRowsCount: 0,
        detectedItemNumbers: [],
        unitDistribution: {},
        tableTextRaw: ''
      }
    };
  }

  // 3. Encontrar o fim da tabela - priorizar TOTAL DO PEDIDO
  let tableEnd = sanitizedText.length;
  
  // Primeiro tentar TOTAL DO PEDIDO (marcador mais confiável)
  const totalMatchIndex = sanitizedText.slice(tableStart).search(/TOTAL\s+DO\s+PEDIDO/i);
  if (totalMatchIndex !== -1) {
    tableEnd = tableStart + totalMatchIndex;
  } else {
    // Fallback: Observações Gerais apenas se TOTAL DO PEDIDO não existir
    const fallbackPatterns = [
      /Observa[çc][õo]es\s+Gerais/i
    ];
    for (const pat of fallbackPatterns) {
      const m = sanitizedText.slice(tableStart).search(pat);
      if (m !== -1) {
        tableEnd = tableStart + m;
        break;
      }
    }
  }

  const tableText = sanitizedText.slice(tableStart, tableEnd);
  const tableTextRaw = textBeforePipeRemoval.slice(tableStart, tableEnd);
  
  if (import.meta.env.DEV) {
    console.log('🔍 [Parser] Iniciando extração de itens...');
    console.log('📄 Texto da tabela (primeiros 1500 chars):', tableText.substring(0, 1500));
  }

  // 4. CONTAGEM DE CANDIDATOS - STRICT MODE (apenas linhas válidas de item)
  // Detectar âncoras "Item N" e coletar números detectados
  const itemAnchorsRegex = /(?:^|\s)Item\s+(\d{1,3})(?=\s)/gi;
  const anchors: { itemNumber: string; start: number }[] = [];
  const detectedItemNumbers = new Set<string>();
  let anchorMatch;
  
  while ((anchorMatch = itemAnchorsRegex.exec(tableText)) !== null) {
    const num = anchorMatch[1].padStart(2, '0');
    anchors.push({
      itemNumber: anchorMatch[1],
      start: anchorMatch.index
    });
    detectedItemNumbers.add(num);
  }
  
  // CONTAGEM STRICT: Apenas linhas com TODOS os campos necessários (número, código, qtde, unidade)
  // Usamos regex que exige os 4 campos principais em formato de tabela com pipes
  const strictMarkdownRowRegex = /^\s*\|\s*(\d{1,3})\s*\|\s*(\d{4,})\s*\|\s*([\d.,]+)\s*\|\s*([A-ZÇÃÕ]{2,4})\s*\|/gmi;
  const strictMarkdownMatches = Array.from(tableTextRaw.matchAll(strictMarkdownRowRegex));
  const markdownRowsCount = strictMarkdownMatches.length;
  
  // Coletar números de item detectados nas linhas markdown
  strictMarkdownMatches.forEach(match => {
    detectedItemNumbers.add(match[1].padStart(2, '0'));
  });
  
  // EXPECTED COUNT: usar markdownRowsCount se disponível (é o mais confiável)
  // Caso contrário, usar anchors.length (segundo mais confiável)
  let expectedCount: number;
  if (markdownRowsCount > 0) {
    expectedCount = markdownRowsCount;
    if (import.meta.env.DEV) {
      console.log(`📊 Usando contagem STRICT de linhas markdown: ${markdownRowsCount}`);
    }
  } else if (anchors.length > 0) {
    expectedCount = anchors.length;
    if (import.meta.env.DEV) {
      console.log(`📊 Usando contagem de âncoras "Item N": ${anchors.length}`);
    }
  } else {
    // Fallback: tentar contar por outras formas
    const rowCandidateRegex = /(?:Item\s+)?\d{1,3}\s+C[óo]digo\s+\d{4,}\s+Qtde\s+[\d.,]+\s+(?:Uni(?:d|dade)?\.?\s+)?[A-ZÇÃÕ]{2,4}/gi;
    const rowCandidates = tableText.match(rowCandidateRegex) || [];
    expectedCount = rowCandidates.length;
    if (import.meta.env.DEV) {
      console.log(`📊 Usando contagem de candidatos com rótulos: ${expectedCount}`);
    }
  }
  
  if (import.meta.env.DEV) {
    console.log(`📍 Âncoras "Item N" detectadas: ${anchors.length}`, anchors.map(a => a.itemNumber).join(', '));
    console.log(`📋 Linhas de tabela markdown (STRICT): ${markdownRowsCount}`);
    console.log(`📋 Números de item detectados: ${Array.from(detectedItemNumbers).sort().join(', ')}`);
    console.log(`📋 Expected count: ${expectedCount}`);
  }
  
  // Se não encontrou nem âncoras nem candidatos, tentar fallback simples
  if (expectedCount === 0) {
    console.warn('⚠️ Nenhum item detectado, tentando fallback...');
    const fallbackItems = extractItemsFallback(tableText);
    return {
      items: fallbackItems,
      metrics: {
        expectedCount: 0,
        markdownRowsCount: 0,
        detectedItemNumbers: [],
        unitDistribution: {},
        tableTextRaw: tableTextRaw.substring(0, 3000)
      }
    };
  }
  
  // 5. EXTRAÇÃO POR BLOCOS "Item N" (quando disponíveis)
  if (anchors.length > 0) {
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      const nextAnchor = anchors[i + 1];
      
      // Definir limites do bloco
      const blockStart = anchor.start;
      const blockEnd = nextAnchor ? nextAnchor.start : tableText.length;
      const blockText = tableText.slice(blockStart, blockEnd);
      
      try {
        // Extração campo a campo com regex tolerantes
        const itemNumber = anchor.itemNumber.padStart(2, '0');
        
        // CÓDIGO
        const codigoMatch = blockText.match(/C[óo]digo\s+(\d{4,})/i);
        if (!codigoMatch) {
          if (import.meta.env.DEV) {
            console.warn(`⚠️ Item ${itemNumber}: Código não encontrado`);
          }
          continue;
        }
        const itemCode = codigoMatch[1];
        
        // QUANTIDADE
        const qtdeMatch = blockText.match(/Qtde\s+([\d.,]+)/i);
        if (!qtdeMatch) {
          if (import.meta.env.DEV) {
            console.warn(`⚠️ Item ${itemNumber}: Quantidade não encontrada`);
          }
          continue;
        }
        const quantityStr = qtdeMatch[1].replace(/\./g, '').replace(',', '.');
        const quantity = parseFloat(quantityStr);
        
        if (isNaN(quantity) || quantity <= 0) {
          if (import.meta.env.DEV) {
            console.warn(`⚠️ Item ${itemNumber}: Quantidade inválida (${qtdeMatch[1]})`);
          }
          continue;
        }
        
        // UNIDADE (suporte ampliado: CT, CX, PC, UN, KG, MT, M, JG, PÇ, PÇS, etc.)
        const unidadeMatch = blockText.match(/(Uni\.?|Un\.?|Unid\.?|Unidade)\s+([A-ZÇÃ]{1,4})/i);
        const unit = unidadeMatch ? unidadeMatch[2].trim() : 'UN';
        
        // VALOR UNITÁRIO (opcional)
        const vUnitMatch = blockText.match(/V\.?\s*Unit\.?\s+([\d.,]+)/i);
        const unitPrice = vUnitMatch 
          ? parseFloat(vUnitMatch[1].replace(/\./g, '').replace(',', '.'))
          : 0;
        
        // DESCONTO (opcional)
        const descMatch = blockText.match(/Desc\s+([\d.,]+)/i);
        const discount = descMatch 
          ? parseFloat(descMatch[1].replace(/\./g, '').replace(',', '.'))
          : 0;
        
        // TOTAL (opcional)
        const totalMatch = blockText.match(/Total\s+([\d.,]+)/i);
        const totalValue = totalMatch 
          ? parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'))
          : 0;
        
        // ARMAZÉM (opcional)
        const armazemMatch = blockText.match(/Armaz[ée]m\s+(\d{1,3})/i);
        const warehouse = armazemMatch ? armazemMatch[1] : 'PRINCIPAL';
        
        // DESCRIÇÃO - BUSCA RESTRITA ao bloco do item (SEM expansão para prevenir trocas)
        let description = 'Produto TOTVS';
        
        // Usar função helper que trabalha APENAS com o blockText (sem expansão)
        description = findItemDescription(blockText, itemCode, itemNumber);
        
        // Verificar duplicatas
        const isDuplicate = items.some(
          i => i.itemCode === itemCode && i.itemNumber === itemNumber
        );
        
        if (!isDuplicate) {
          items.push({
            itemNumber,
            itemCode,
            description,
            quantity,
            unit,
            warehouse,
            deliveryDate: '',
            sourceType: 'in_stock',
            unitPrice,
            discount,
            ipiPercent: 0,
            icmsPercent: 0,
            totalValue
          });
          
          if (import.meta.env.DEV) {
            console.log(`✅ [Bloco] Item ${itemNumber}: ${itemCode} | ${quantity} ${unit} | ${description.substring(0, 40)}...`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Erro ao processar Item ${anchor.itemNumber}:`, error);
        if (import.meta.env.DEV) {
          console.log('📄 Bloco com erro:', blockText.substring(0, 300));
        }
      }
    }
  }
  
  // 6. VARREDURA LINHA-POR-LINHA (TABULAR - sempre executada)
  // Regex para capturar linhas tabulares COM rótulos (com ou sem "Item" prefix)
  const rowRegex = /(?:Item\s+)?(\d{1,3})\s+C[óo]digo\s+(\d{4,})\s+Qtde\s+([\d.,]+)\s+(?:Uni(?:d|dade)?\.?\s+)?([A-ZÇÃÕ]{1,4})/gi;
  
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableText)) !== null) {
    try {
      const itemNumber = rowMatch[1].trim().padStart(2, '0');
      const itemCode = rowMatch[2].trim();
      const quantityStr = rowMatch[3].replace(/\./g, '').replace(',', '.');
      const unit = rowMatch[4].trim();
      
      const quantity = parseFloat(quantityStr);
      if (isNaN(quantity) || quantity <= 0) continue;
      
      // Verificar se já foi extraído
      const alreadyExtracted = items.some(
        i => i.itemCode === itemCode && i.itemNumber === itemNumber
      );
      
      if (alreadyExtracted) {
        continue;
      }
      
      // Abrir janela de contexto (+200 chars após o match)
      const contextStart = rowMatch.index;
      const contextEnd = Math.min(tableText.length, contextStart + 300);
      const context = tableText.slice(contextStart, contextEnd);
      
      // VALOR UNITÁRIO
      const vUnitMatch = context.match(/V\.?\s*Unit\.?\s+([\d.,]+)/i);
      const unitPrice = vUnitMatch 
        ? parseFloat(vUnitMatch[1].replace(/\./g, '').replace(',', '.'))
        : 0;
      
      // TOTAL
      const totalMatch = context.match(/Total\s+([\d.,]+)/i);
      const totalValue = totalMatch 
        ? parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'))
        : 0;
      
      // DESCONTO
      const descMatch = context.match(/Desc\s+([\d.,]+)/i);
      const discount = descMatch 
        ? parseFloat(descMatch[1].replace(/\./g, '').replace(',', '.'))
        : 0;
      
      // ARMAZÉM
      const armazemMatch = context.match(/Armaz[ée]m\s+(\d{1,3})/i);
      const warehouse = armazemMatch ? armazemMatch[1] : 'PRINCIPAL';
      
      // DESCRIÇÃO (busca na janela estendida)
      let description = 'Produto TOTVS';
      const extendedContextEnd = Math.min(tableText.length, contextStart + 600);
      const extendedContext = tableText.slice(contextStart, extendedContextEnd);
      
      const descPatterns = [
        new RegExp(`Descri[çc][ãa]o[:\\s]+(.+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|Qtde|LGPD|$)`, 'is'),
        new RegExp(`C[óo]digo\\s+${itemCode}[\\s\\S]{0,400}?Descri[çc][ãa]o[:\\s]+(.+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|$)`, 'is'),
      ];
      
      for (const pattern of descPatterns) {
        const descMatch = extendedContext.match(pattern);
        if (descMatch && descMatch[1].trim().length > 3) {
          description = sanitizeItemDescription(
            descMatch[1]
              .trim()
              .replace(/\s+/g, ' ')
              .replace(/^\d+\s*-?\s*/, '')
              .substring(0, 200)
          );
          break;
        }
      }
      
      items.push({
        itemNumber,
        itemCode,
        description,
        quantity,
        unit,
        warehouse,
        deliveryDate: '',
        sourceType: 'in_stock',
        unitPrice,
        discount,
        ipiPercent: 0,
        icmsPercent: 0,
        totalValue
      });
      
      if (import.meta.env.DEV) {
        console.log(`✅ [Linha] Item ${itemNumber}: ${itemCode} | ${quantity} ${unit} | ${description.substring(0, 40)}...`);
      }
      
    } catch (error) {
      continue;
    }
  }
  
  // 7. VARREDURA DE TABELAS MARKDOWN/PIPE (antes da remoção de pipes)
  // Processar primeiro as linhas com pipes explícitos na versão raw
  // MELHORADO: tolerância a unidades de 2-4 letras
  // REGEX EXPANDIDO: captura Item|Código|Qtde|Uni|V.Unit|Desc|V.C/Desc|NCM|%IPI|Val.IPI|%ICMS|ICMS|Total|Total c/IPI|Armazém
  // Grupos: 1=Item, 2=Código, 3=Qtde, 4=Uni, 5=V.Unit, 6=Desconto, 7=Total, 8=Armazém
  const markdownLineRegex = /\|\s*(\d{1,3})\s*\|\s*(\d{4,})\s*\|\s*([\d.,]+)\s*\|\s*([A-ZÇÃÕ]{2,4})\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|.*?\|\s*([\d.,]+)\s*\|.*?\|\s*(\d{1,3})\s*\|/gi;
  
  let markdownMatch;
  while ((markdownMatch = markdownLineRegex.exec(tableTextRaw)) !== null) {
    try {
      const itemNumber = markdownMatch[1].trim().padStart(2, '0');
      const itemCode = markdownMatch[2].trim();
      const quantityStr = markdownMatch[3].replace(/\./g, '').replace(',', '.');
      const unit = markdownMatch[4].trim();
      
      const quantity = parseFloat(quantityStr);
      if (isNaN(quantity) || quantity <= 0) continue;
      
      // Verificar se já foi extraído
      const alreadyExtracted = items.some(
        i => i.itemCode === itemCode && i.itemNumber === itemNumber
      );
      
      if (alreadyExtracted) continue;
      
      // MUDANÇA CRÍTICA: Usar valores JÁ extraídos da regex markdown (mais confiável!)
      const unitPrice = markdownMatch[5] 
        ? parseFloat(markdownMatch[5].replace(/\./g, '').replace(',', '.')) 
        : 0;
      
      const discount = markdownMatch[6]
        ? parseFloat(markdownMatch[6].replace(/\./g, '').replace(',', '.'))
        : 0;
      
      const totalValue = markdownMatch[7]
        ? parseFloat(markdownMatch[7].replace(/\./g, '').replace(',', '.'))
        : 0;
      
      const warehouse = markdownMatch[8] || 'PRINCIPAL';
      
      // MUDANÇA CRÍTICA: Buscar descrição APENAS nas próximas 150 chars (2-3 linhas após o item)
      const contextStart = markdownMatch.index;
      let contextEnd = Math.min(tableTextRaw.length, contextStart + 150);
      
      // Detectar próximo "Item N" para delimitar fim do bloco atual
      const nextItemMatch = tableTextRaw.slice(contextStart + 1).search(/\|\s*\d{1,3}\s*\|\s*\d{4,}/);
      if (nextItemMatch !== -1 && nextItemMatch < 150) {
        contextEnd = contextStart + nextItemMatch;
      }
      
      const descriptionSearchArea = tableTextRaw.slice(contextStart, contextEnd);
      
      // Buscar descrição na área delimitada
      let description = 'Produto TOTVS';
      
      // Padrão 1: "Descrição:" seguido de texto (linha inteira ou em pipe)
      const descMatch1 = descriptionSearchArea.match(/Descri[çc][ãa]o:\s*(.+?)(?:\n|$)/is);
      if (descMatch1) {
        const rawDesc = descMatch1[1].trim();
        // Pular código de operação (ex: "501VENDA DE PRODUCAO")
        const lines = rawDesc.split('\n');
        // Primeira linha geralmente é código de operação, segunda é a descrição real
        const descLine = lines.length > 1 ? lines[1].trim() : lines[0].trim();
        
        if (descLine && descLine.length > 5 && !/^Item\s+\d+/.test(descLine)) {
          description = sanitizeItemDescription(
            descLine
              .replace(/\s+/g, ' ')
              .replace(/^\d+\s*-?\s*/, '') // Remove código numérico inicial
              .substring(0, 200)
          );
        }
      }
      
      // Fallback: se não encontrou, usar primeira linha após match que não seja cabeçalho
      if (description === 'Produto TOTVS') {
        const textAfterMatch = descriptionSearchArea.slice(markdownMatch[0].length);
        const lines = textAfterMatch.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        
        for (const line of lines) {
          if (!/^(Observa[çc][ãa]o|Descri[çc][ãa]o|Item\s+\d+|\|)/.test(line)) {
            description = sanitizeItemDescription(
              line.replace(/\s+/g, ' ').substring(0, 200)
            );
            break;
          }
        }
      }
      
      // VALIDAÇÃO DE CONSISTÊNCIA: quantidade * preço ≈ total (margem 5% para descontos)
      const expectedTotal = quantity * unitPrice - discount;
      const totalDiff = Math.abs(expectedTotal - totalValue);
      const isConsistent = totalValue === 0 || totalDiff < (expectedTotal * 0.05); // 5% margem
      
      if (!isConsistent && import.meta.env.DEV) {
        console.warn(`⚠️ [Markdown] Item ${itemNumber} (${itemCode}): Valores inconsistentes! ` +
          `Qtde(${quantity}) * Preço(${unitPrice.toFixed(2)}) = R$ ${expectedTotal.toFixed(2)} ` +
          `mas Total extraído = R$ ${totalValue.toFixed(2)}`);
      }
      
      items.push({
        itemNumber,
        itemCode,
        description,
        quantity,
        unit,
        warehouse,
        deliveryDate: '',
        sourceType: 'in_stock',
        unitPrice,
        discount,
        ipiPercent: 0,
        icmsPercent: 0,
        totalValue
      });
      
      if (import.meta.env.DEV) {
        console.log(`\n📦 [Markdown] Item ${itemNumber} extraído:`);
        console.log(`   Código: ${itemCode}`);
        console.log(`   Qtde: ${quantity} ${unit}`);
        console.log(`   Preço: R$ ${unitPrice.toFixed(2)}`);
        console.log(`   Total: R$ ${totalValue.toFixed(2)}`);
        console.log(`   Armazém: ${warehouse}`);
        console.log(`   Descrição: ${description.substring(0, 50)}...`);
        console.log(`   Consistente: ${isConsistent ? '✅' : '❌'}`);
      }
      
    } catch (error) {
      continue;
    }
  }
  
  // 7b. VARREDURA DE LINHAS COMPACTAS (SEM RÓTULOS - sempre executada)
  // Regex para capturar linhas compactas: "número código qtde unidade" (sem "Código" ou "Qtde")
  // Tolerante a espaços múltiplos e pipes já removidos
  const rowRegexGeneric = /(?:^|\s)(\d{1,3})\s+(\d{4,})\s+([\d.,]+)\s+([A-ZÇÃÕ]{1,4})(?:\s+([\d.,]+))?(?:\s+([\d.,]+))?/gi;
  
  let genericMatch;
  while ((genericMatch = rowRegexGeneric.exec(tableText)) !== null) {
    try {
      const itemNumber = genericMatch[1].trim().padStart(2, '0');
      const itemCode = genericMatch[2].trim();
      const quantityStr = genericMatch[3].replace(/\./g, '').replace(',', '.');
      const unit = genericMatch[4].trim();
      
      const quantity = parseFloat(quantityStr);
      if (isNaN(quantity) || quantity <= 0) continue;
      
      // Verificar se já foi extraído
      const alreadyExtracted = items.some(
        i => i.itemCode === itemCode && i.itemNumber === itemNumber
      );
      
      if (alreadyExtracted) {
        continue;
      }
      
      // Abrir janela de contexto (+500 chars após o match)
      const contextStart = genericMatch.index;
      const contextEnd = Math.min(tableText.length, contextStart + 500);
      const context = tableText.slice(contextStart, contextEnd);
      
      // VALOR UNITÁRIO (pode estar nos grupos 5 ou buscar no contexto)
      let unitPrice = 0;
      if (genericMatch[5]) {
        const vUnit = genericMatch[5].replace(/\./g, '').replace(',', '.');
        unitPrice = parseFloat(vUnit);
      } else {
        const vUnitMatch = context.match(/V\.?\s*Unit\.?\s+([\d.,]+)/i);
        if (vUnitMatch) {
          unitPrice = parseFloat(vUnitMatch[1].replace(/\./g, '').replace(',', '.'));
        }
      }
      
      // TOTAL (pode estar no grupo 6 ou buscar no contexto)
      let totalValue = 0;
      if (genericMatch[6]) {
        const total = genericMatch[6].replace(/\./g, '').replace(',', '.');
        totalValue = parseFloat(total);
      } else {
        const totalMatch = context.match(/Total\s+([\d.,]+)/i);
        if (totalMatch) {
          totalValue = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'));
        }
      }
      
      // DESCONTO
      const descMatch = context.match(/Desc\s+([\d.,]+)/i);
      const discount = descMatch 
        ? parseFloat(descMatch[1].replace(/\./g, '').replace(',', '.'))
        : 0;
      
      // ARMAZÉM
      const armazemMatch = context.match(/Armaz[ée]m\s+(\d{1,3})/i);
      const warehouse = armazemMatch ? armazemMatch[1] : 'PRINCIPAL';
      
      // DESCRIÇÃO (busca na janela estendida)
      let description = 'Produto TOTVS';
      const extendedContextEnd = Math.min(tableText.length, contextStart + 600);
      const extendedContext = tableText.slice(contextStart, extendedContextEnd);
      
      const descPatterns = [
        new RegExp(`Descri[çc][ãa]o[:\\s]+(.+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|Qtde|LGPD|$)`, 'is'),
        new RegExp(`C[óo]digo\\s+${itemCode}[\\s\\S]{0,400}?Descri[çc][ãa]o[:\\s]+(.+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|$)`, 'is'),
      ];
      
      for (const pattern of descPatterns) {
        const descMatch = extendedContext.match(pattern);
        if (descMatch && descMatch[1].trim().length > 3) {
          description = descMatch[1]
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/^\d+\s*-?\s*/, '')
            .substring(0, 200);
          break;
        }
      }
      
      items.push({
        itemNumber,
        itemCode,
        description,
        quantity,
        unit,
        warehouse,
        deliveryDate: '',
        sourceType: 'in_stock',
        unitPrice,
        discount,
        ipiPercent: 0,
        icmsPercent: 0,
        totalValue
      });
      
      if (import.meta.env.DEV) {
        console.log(`✅ [Compacto] Item ${itemNumber}: ${itemCode} | ${quantity} ${unit} | ${description.substring(0, 40)}...`);
      }
      
    } catch (error) {
      continue;
    }
  }
  
  // 7c. VARREDURA POR 'CÓDIGO' QUANDO NÚMERO DO ITEM AUSENTE
  const codeFirstRegex = /C[óo]digo\s+(\d{4,})[\s\S]{0,150}?Qtde\s+([\d.,]+)\s+(?:Uni(?:d|dade)?\.?\s+)?([A-ZÇÃÕ]{1,4})/gi;

  let codeMatch;
  // Último número já atribuído
  let lastAssigned = items.reduce((max, it) => Math.max(max, parseInt(it.itemNumber || '0', 10) || 0), 0);

  while ((codeMatch = codeFirstRegex.exec(tableText)) !== null) {
    try {
      const itemCode = codeMatch[1].trim();
      const quantityStr = codeMatch[2].replace(/\./g, '').replace(',', '.');
      const unit = codeMatch[3].trim();
      const quantity = parseFloat(quantityStr);
      if (isNaN(quantity) || quantity <= 0) continue;

      // Tentar capturar número do item olhando antes
      const prevWinStart = Math.max(0, codeMatch.index - 100);
      const prevWindow = tableText.slice(prevWinStart, codeMatch.index);
      const numBefore = prevWindow.match(/Item\s+(\d{1,3})/i);
      let itemNumber = numBefore ? numBefore[1].trim().padStart(2, '0') : String(++lastAssigned).padStart(2, '0');

      // Evitar duplicatas
      const alreadyExtracted = items.some(i => i.itemCode === itemCode && i.itemNumber === itemNumber);
      if (alreadyExtracted) continue;

      // Contexto à direita
      const contextStart = codeMatch.index;
      const contextEnd = Math.min(tableText.length, contextStart + 600);
      const context = tableText.slice(contextStart, contextEnd);

      // Valores
      const vUnitMatch = context.match(/V\.?\s*Unit\.?\s+([\d.,]+)/i);
      const unitPrice = vUnitMatch ? parseFloat(vUnitMatch[1].replace(/\./g, '').replace(',', '.')) : 0;

      const totalMatch = context.match(/Total\s+([\d.,]+)/i);
      const totalValue = totalMatch ? parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.')) : 0;

      const descMatch = context.match(/Desc\s+([\d.,]+)/i);
      const discount = descMatch ? parseFloat(descMatch[1].replace(/\./g, '').replace(',', '.')) : 0;

      const armazemMatch = context.match(/Armaz[ée]m\s+(\d{1,3})/i);
      const warehouse = armazemMatch ? armazemMatch[1] : 'PRINCIPAL';

      // Descrição
      let description = 'Produto TOTVS';
      const descPatterns = [
        new RegExp(`Descri[çc][ãa]o[:\\s]+(.+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|Qtde|LGPD|$)`, 'is'),
        new RegExp(`C[óo]digo\\s+${itemCode}[\\s\\S]{0,400}?Descri[çc][ãa]o[:\\s]+(.+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|$)`, 'is'),
      ];
      for (const pattern of descPatterns) {
        const dm = context.match(pattern);
        if (dm && dm[1].trim().length > 3) {
          description = dm[1].trim().replace(/\s+/g, ' ').replace(/^\d+\s*-?\s*/, '').substring(0, 200);
          break;
        }
      }

      items.push({ itemNumber, itemCode, description, quantity, unit, warehouse, deliveryDate: '', sourceType: 'in_stock', unitPrice, discount, ipiPercent: 0, icmsPercent: 0, totalValue });

      if (import.meta.env.DEV) {
        console.log(`✅ [Código] Item ${itemNumber}: ${itemCode} | ${quantity} ${unit} | ${description.substring(0, 40)}...`);
      }

    } catch (_) { continue; }
  }

  // 8. VERIFICAÇÃO DE COMPLETUDE E FALLBACK
  const extractedCount = items.length;
  const completeness = expectedCount > 0 ? (extractedCount / expectedCount) * 100 : 0;
  
  // Calcular distribuição por unidade
  const unitDistribution = items.reduce((acc, item) => {
    acc[item.unit] = (acc[item.unit] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  if (import.meta.env.DEV) {
    console.log(`\n📊 Métricas de extração:`);
    console.log(`   - Âncoras "Item N": ${anchors.length}`);
    console.log(`   - Linhas markdown (STRICT): ${markdownRowsCount}`);
    console.log(`   - Números detectados: ${Array.from(detectedItemNumbers).sort().join(', ')}`);
    console.log(`   - Expected Count: ${expectedCount}`);
    console.log(`   - Itens extraídos: ${extractedCount}`);
    console.log(`   - Completude: ${completeness.toFixed(1)}%`);
    console.log(`   - Distribuição por unidade:`, unitDistribution);
  }
  
  // Se menos de 90% foram extraídos, tentar fallback adicional
  if (completeness < 90 && expectedCount > 0) {
    console.warn(`⚠️ Apenas ${completeness.toFixed(1)}% dos itens foram extraídos. Executando fallback adicional...`);
    
    // Determinar números faltantes baseado APENAS nos números realmente detectados no PDF
    // NÃO inferir itens faltantes pelo maior número
    const extractedNumbers = new Set(items.map(i => i.itemNumber));
    const missingNumbers = Array.from(detectedItemNumbers)
      .filter(num => !extractedNumbers.has(num))
      .sort();
    
    if (import.meta.env.DEV && missingNumbers.length > 0) {
      console.log(`📋 Itens detectados mas não extraídos: ${missingNumbers.join(', ')}`);
    }
    
    // Tentar extração simplificada (usando tableTextRaw para capturar também linhas com pipes)
    const fallbackItems = extractItemsFallback(tableTextRaw, missingNumbers.length > 0 ? missingNumbers : undefined);
    
    fallbackItems.forEach(item => {
      const isDuplicate = items.some(
        i => i.itemCode === item.itemCode && i.itemNumber === item.itemNumber
      );
      if (!isDuplicate) {
        items.push(item);
        if (import.meta.env.DEV) {
          console.log(`✨ [Fallback] Item ${item.itemNumber} recuperado: ${item.itemCode} | ${item.quantity} ${item.unit}`);
        }
      }
    });
    
    if (import.meta.env.DEV) {
      console.log(`📊 Após fallback: ${items.length} itens (${((items.length / expectedCount) * 100).toFixed(1)}%)`);
    }
  }
  
  // 9. VALIDAÇÃO ESPECÍFICA PARA PEDIDOS DE TESTE (baseado em linhas REAIS detectadas)
  const testOrderMatch = tableText.match(/PEDIDO\s+N[º°]:\s*(132081|132087)/i);
  if (testOrderMatch && import.meta.env.DEV) {
    const orderNum = testOrderMatch[1];
    const detectedCount = detectedItemNumbers.size;
    
    console.log(`\n🧪 VALIDAÇÃO PEDIDO ${orderNum}:`);
    console.log(`   - Linhas de item detectadas: ${detectedCount}`);
    console.log(`   - Números de item no PDF: ${Array.from(detectedItemNumbers).sort().join(', ')}`);
    console.log(`   - Itens extraídos com sucesso: ${items.length}`);
    console.log(`   - Taxa de extração: ${detectedCount > 0 ? ((items.length / detectedCount) * 100).toFixed(1) : 0}%`);
    
    if (items.length < detectedCount) {
      const extractedNumbers = new Set(items.map(i => i.itemNumber));
      const missingNumbers = Array.from(detectedItemNumbers)
        .filter(num => !extractedNumbers.has(num))
        .sort();
      
      console.warn(`⚠️ Itens detectados mas não extraídos: ${missingNumbers.join(', ')}`);
      
      // Mostrar snippets dos itens faltantes (primeiros 3)
      missingNumbers.slice(0, 3).forEach(num => {
        const regex = new RegExp(`\\|\\s*${num}\\s*\\|[\\s\\S]{0,200}`, 'i');
        const snippet = tableTextRaw.match(regex);
        if (snippet) {
          console.warn(`   Item ${num} snippet:`, snippet[0].substring(0, 150).replace(/\n/g, ' '));
        }
      });
    }
  }
  
  // 10. MÉTRICAS FINAIS
  if (import.meta.env.DEV) {
    console.log(`\n📦 ═══ EXTRAÇÃO CONCLUÍDA ═══`);
    console.log(`📊 Total de itens: ${items.length}`);
    console.log(`📊 Âncoras "Item N" detectadas: ${anchors.length}`);
    console.log(`📊 Linhas de tabela markdown (STRICT): ${markdownRowsCount}`);
    console.log(`📊 Números de item detectados: ${Array.from(detectedItemNumbers).sort().join(', ')}`);
    console.log(`📊 Expected count: ${expectedCount}`);
    console.log(`📊 Completude final: ${((items.length / expectedCount) * 100).toFixed(1)}%`);
    console.log('📊 Distribuição por unidade:', unitDistribution);
    
    // Se houver itens faltantes, mostrar snippets (baseado nos números DETECTADOS)
    if (expectedCount > items.length) {
      const extractedNumbers = new Set(items.map(i => i.itemNumber));
      const missingNumbers = Array.from(detectedItemNumbers)
        .filter(num => !extractedNumbers.has(num))
        .sort()
        .slice(0, 3);
      
      if (missingNumbers.length > 0) {
        console.warn(`⚠️ ${expectedCount - items.length} itens detectados mas não extraídos`);
        
        missingNumbers.forEach(num => {
          // Tentar em ambos os textos (raw e sanitized)
          const regexRaw = new RegExp(`\\|\\s*${num}\\s*\\|[\\s\\S]{0,200}`, 'i');
          const snippetRaw = tableTextRaw.match(regexRaw);
          
          if (snippetRaw) {
            console.warn(`   Item ${num} snippet:`, snippetRaw[0].substring(0, 150).replace(/\n/g, ' '));
          }
        });
      }
    }
    
    console.log(`════════════════════════════\n`);
  }
  
  console.log(`📦 Itens extraídos com sucesso: ${items.length}`);
  
  if (items.length === 0) {
    console.error('❌ Nenhum item encontrado com nenhum dos padrões');
  }
  
  return {
    items,
    metrics: {
      expectedCount,
      markdownRowsCount,
      detectedItemNumbers: Array.from(detectedItemNumbers).sort(),
      unitDistribution,
      tableTextRaw: tableTextRaw.substring(0, 3000) // Limitar tamanho
    }
  };
}

// FUNÇÃO AUXILIAR: Fallback para extração simplificada
function extractItemsFallback(
  tableText: string, 
  targetNumbers?: string[]
): ParsedOrderData['items'] {
  const items: ParsedOrderData['items'] = [];
  
  if (import.meta.env.DEV) {
    console.log('🔄 Executando fallback de extração simplificada...');
    if (targetNumbers && targetNumbers.length > 0) {
      console.log(`🔄 Buscando itens específicos: ${targetNumbers.join(', ')}`);
    }
  }
  
  // Regex mais amplo: captura várias unidades e formatos tabulares
  // Suporta: CT, CX, PC, UN, KG, MT, M, JG, PÇ, PÇS, LT, DZ, RL, etc.
  const simpleRegex = /(?:Item\s+)?(\d{1,3})\s+(?:C[óo]digo\s+)?(\d{4,})\s+(?:Qtde\s+)?([\d.,]+)\s+(?:Uni(?:d|dade)?\.?\s+)?([A-ZÇÃÕ]{1,4})/gi;
  
  let match;
  const seenKeys = new Set<string>();
  
  while ((match = simpleRegex.exec(tableText)) !== null) {
    try {
      const itemNum = match[1].trim().padStart(2, '0');
      const codigo = match[2].trim();
      const qtd = match[3];
      const unidade = match[4].trim();
      
      // Se targetNumbers foi especificado, filtrar apenas esses números
      if (targetNumbers && targetNumbers.length > 0 && !targetNumbers.includes(itemNum)) {
        continue;
      }
      
      // Evitar duplicatas dentro do fallback
      const key = `${itemNum}-${codigo}`;
      if (seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
      
      const quantityStr = qtd.replace(/\./g, '').replace(',', '.');
      const quantity = parseFloat(quantityStr);
      
      if (isNaN(quantity) || quantity <= 0) continue;
      
      // Abrir janela de contexto para buscar valores
      const contextStart = match.index;
      const contextEnd = Math.min(tableText.length, contextStart + 400);
      const context = tableText.slice(contextStart, contextEnd);
      
      // VALOR UNITÁRIO
      const vUnitMatch = context.match(/V\.?\s*Unit\.?\s+([\d.,]+)/i);
      const unitPrice = vUnitMatch 
        ? parseFloat(vUnitMatch[1].replace(/\./g, '').replace(',', '.'))
        : 0;
      
      // TOTAL
      const totalMatch = context.match(/Total\s+([\d.,]+)/i);
      const totalValue = totalMatch 
        ? parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'))
        : 0;
      
      // Buscar descrição próxima
      let description = 'Produto TOTVS';
      const descPattern = new RegExp(
        `(?:Item\\s+${itemNum}|C[óo]digo\\s+${codigo})[\\s\\S]{0,500}?Descri[çc][ãa]o[:\\s]+(.+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|Qtde|$)`,
        'is'
      );
      const descMatch = tableText.match(descPattern);
      if (descMatch && descMatch[1].trim().length > 3) {
        description = descMatch[1]
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/^\d+\s*-?\s*/, '')
          .substring(0, 200);
      }
      
      items.push({
        itemNumber: itemNum,
        itemCode: codigo,
        description,
        quantity,
        unit: unidade,
        warehouse: 'PRINCIPAL',
        deliveryDate: '',
        sourceType: 'in_stock',
        unitPrice,
        discount: 0,
        ipiPercent: 0,
        icmsPercent: 0,
        totalValue
      });
      
      if (import.meta.env.DEV) {
        console.log(`🔄 [Fallback] Item ${itemNum}: ${codigo} | ${quantity} ${unidade}`);
      }
      
    } catch (e) {
      continue;
    }
  }
  
  if (import.meta.env.DEV) {
    console.log(`🔄 Fallback extraiu ${items.length} itens adicionais`);
  }
  
  return items;
}
