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
    const newItems = extractItemsTable(fullText);
    
    // Mesclar novos itens com os existentes (evitar duplicatas)
    if (newItems.length > 0) {
      newItems.forEach(newItem => {
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
    
    // Early stop apenas quando detectar fim do documento
    const hasEndMarker = fullText.includes('TOTAL DO PEDIDO') || fullText.includes('LGPD:');
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
  if (!orderHeader) {
    orderHeader = extractOrderHeader(fullText);
  }
  if (items.length === 0) {
    items = extractItemsTable(fullText);
  }
  
  if (import.meta.env.DEV) {
    console.log('✅ Pedido identificado:', orderHeader?.orderNumber);
    console.log(`📦 Parsing concluído: ${items.length} itens extraídos de ${pagesToRead} página(s)`);
    
    // Avisar se parece incompleto
    if (items.length > 0 && items.length < 5 && totalPages > 1) {
      console.warn(`⚠️ Apenas ${items.length} itens extraídos de um PDF com ${totalPages} páginas - pode estar incompleto`);
    }
  }
  
  // Calcular qualidade da extração
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
    ].filter(Boolean).length
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
  
  // EXECUTIVO/REPRESENTANTE - Busca em CENTRO CUSTO, ITEM, CONTA ou campos similares
  // Exemplo: "SSM - CUSTOMER SERVICE" ou "SSM - PAINEIS"
  const execMatch = text.match(/(?:CENTRO\s+CUSTO|ITEM|CONTA)\s+([A-Z\s\-]+?)(?=\s+(?:PROJETO|POS\s+VENDA|TRANSPORTE|\n\n))/i);
  if (execMatch) {
    orderInfo.executiveName = execMatch[1].trim();
    console.log('✅ Executivo:', orderInfo.executiveName);
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
    dataEntrega: !!orderInfo.deliveryDate
  });
  console.log(`✅ Campos extraídos: ${extractedCount}/11`);
  
  return orderInfo;
}

// Helper function to find item description separately
function findItemDescription(text: string, itemCode: string, itemNumber: string): string {
  // Try multiple patterns to find description
  // Pattern 1: "Descrição XXXXX" near the item
  const descRegex1 = new RegExp(`Item\\s+${itemNumber}[\\s\\S]{0,300}?Descri[çc][ãa]o\\s+([^\\n]+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|$)`, 'i');
  const match1 = text.match(descRegex1);
  if (match1 && match1[1].trim().length > 3) {
    return match1[1].trim().substring(0, 200);
  }
  
  // Pattern 2: "Código XXXXX ... Descrição XXXXX"
  const descRegex2 = new RegExp(`C[óo]digo\\s+${itemCode}[\\s\\S]{0,300}?Descri[çc][ãa]o\\s+([^\\n]+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|Qtde|$)`, 'i');
  const match2 = text.match(descRegex2);
  if (match2 && match2[1].trim().length > 3) {
    return match2[1].trim().substring(0, 200);
  }
  
  return 'Produto TOTVS';
}

function extractItemsTable(text: string): ParsedOrderData['items'] {
  const items: ParsedOrderData['items'] = [];
  
  // Encontrar início da tabela de composição
  const composicaoIndex = text.search(/COMPOSI[ÇC][ÃA]O/i);
  if (composicaoIndex === -1) {
    console.warn('⚠️ Tabela de composição não encontrada');
    return items;
  }
  
  const tableText = text.substring(composicaoIndex);
  
  // Log detalhado para debug (apenas em DEV)
  if (import.meta.env.DEV) {
    console.log('📄 Texto da tabela (preview):', tableText.substring(0, 1000));
  }
  
  // PADRÃO MELHORADO: Campos opcionais para maior flexibilidade
  // Captura Item + Código + Qtde + Uni (obrigatórios) e tenta capturar valores quando disponíveis
  const blockRegex = /Item\s+(\d+)\s+.*?C[óo]digo\s+(\d+)\s+.*?Qtde\s+([\d,]+)\s+.*?Uni?\s+([A-Z]+)(?:\s+.*?V\.?\s*Unit?\.?\s+([\d.,]+))?(?:\s+.*?(?:Desc|%Desc)\.?\s+([\d.,]+))?(?:\s+.*?%IPI\s+([\d.,]+))?(?:\s+.*?%ICMS\s+([\d.,]+))?(?:\s+.*?Total(?:\s+c\/\s*IPI)?\s+([\d.,]+))?(?:\s+.*?Armaz[ée]m\s+(\S+))?(?:\s+.*?Descri[çc][ãa]o\s+([^\n]+?))?(?=Item\s+\d+|$)/gis;
  
  let match;
  let itemIndex = 1;
  
  while ((match = blockRegex.exec(tableText)) !== null) {
    try {
      const [, itemNum, codigo, qtd, unidade, vlrUnit, desc, ipi, icms, total, armazem, descricao] = match;
      
      // Convert quantity (Brazilian decimal format: 10,00 → 10.00)
      const quantityStr = qtd.trim().replace(',', '.');
      const quantity = parseFloat(quantityStr);
      
      // Validar quantidade mínima
      if (isNaN(quantity) || quantity <= 0) {
        console.warn(`⚠️ Quantidade inválida para item ${codigo}: ${qtd}`);
        continue;
      }
      
      // Buscar descrição: usar a capturada ou buscar separadamente
      let itemDescription = descricao?.trim();
      if (!itemDescription || itemDescription.length < 3) {
        itemDescription = findItemDescription(tableText, codigo.trim(), itemNum.trim());
      } else {
        itemDescription = itemDescription.split('\n')[0].substring(0, 200);
      }
      
      console.log(`📦 Item ${itemNum}: Código ${codigo}, Qtde ${quantity}, Desc: ${itemDescription.substring(0, 50)}...`);
      
      items.push({
        itemNumber: itemNum.trim(),
        itemCode: codigo.trim(),
        description: itemDescription,
        quantity,
        unit: unidade.trim(),
        warehouse: armazem?.trim() || 'PRINCIPAL',
        deliveryDate: '',
        sourceType: 'in_stock',
        unitPrice: vlrUnit ? parseFloat(vlrUnit.replace(/\./g, '').replace(',', '.')) : 0,
        discount: desc ? parseFloat(desc.replace(',', '.')) : 0,
        ipiPercent: ipi ? parseFloat(ipi.replace(',', '.')) : 0,
        icmsPercent: icms ? parseFloat(icms.replace(',', '.')) : 0,
        totalValue: total ? parseFloat(total.replace(/\./g, '').replace(',', '.')) : 0
      });
      itemIndex++;
    } catch (e) {
      console.error(`❌ Erro ao parsear item:`, e);
      continue;
    }
  }
  
  // FALLBACK 1: Padrão melhorado - tenta extrair valores disponíveis
  if (items.length === 0) {
    console.warn('⚠️ Tentando fallback melhorado: extrair valores disponíveis');
    
    // Regex mais permissivo que captura o máximo possível
    const flexibleRegex = /Item\s+(\d+)\s+.*?C[óo]digo\s+(\d+)\s+.*?Qtde\s+([\d,]+)\s+.*?Uni?\s+([A-Z]+)(?:.*?V\.?\s*Unit?\.?\s+([\d.,]+))?(?:.*?Total.*?\s+([\d.,]+))?(?:.*?Armaz[ée]m\s+(\S+))?/gis;
    
    while ((match = flexibleRegex.exec(tableText)) !== null) {
      try {
        const [, itemNum, codigo, qtd, unidade, vlrUnit, total, armazem] = match;
        
        const quantityStr = qtd.trim().replace(',', '.');
        const quantity = parseFloat(quantityStr);
        
        if (isNaN(quantity) || quantity <= 0) {
          console.warn(`⚠️ Quantidade inválida para item ${codigo}: ${qtd}`);
          continue;
        }
        
        // Buscar descrição separadamente
        const description = findItemDescription(tableText, codigo.trim(), itemNum.trim());
        
        const unitPrice = vlrUnit ? parseFloat(vlrUnit.replace(/\./g, '').replace(',', '.')) : 0;
        const totalValue = total ? parseFloat(total.replace(/\./g, '').replace(',', '.')) : 0;
        
        console.log(`📦 Item ${itemNum} (fallback): Código ${codigo}, Qtde ${quantity}, Vlr Unit: ${unitPrice}, Total: ${totalValue}`);
        
        items.push({
          itemNumber: itemNum.trim(),
          itemCode: codigo.trim(),
          description,
          quantity,
          unit: unidade.trim(),
          warehouse: armazem?.trim() || 'PRINCIPAL',
          deliveryDate: '',
          sourceType: 'in_stock',
          unitPrice,
          discount: 0,
          ipiPercent: 0,
          icmsPercent: 0,
          totalValue
        });
      } catch (e) {
        console.error(`❌ Erro ao parsear item (fallback):`, e);
        continue;
      }
    }
  }
  
  // FALLBACK 2: Buscar apenas "Código + Qtde + Uni" (mais permissivo)
  if (items.length === 0) {
    console.warn('⚠️ Tentando fallback final: apenas Código + Qtde');
    const minimalRegex = /C[óo]digo\s+(\d+)\s+.*?Qtde\s+([\d,]+)\s+.*?Uni?\s+([A-Z]+)/gis;
    
    let fallbackIndex = 1;
    while ((match = minimalRegex.exec(tableText)) !== null) {
      try {
        const [, codigo, qtd, unidade] = match;
        
        const quantityStr = qtd.trim().replace(',', '.');
        const quantity = parseFloat(quantityStr);
        
        if (isNaN(quantity) || quantity <= 0) {
          continue;
        }
        
        console.log(`📦 Item ${fallbackIndex} (minimal): Código ${codigo}, Qtde ${quantity}`);
        
        items.push({
          itemNumber: String(fallbackIndex++),
          itemCode: codigo.trim(),
          description: 'Produto TOTVS',
          quantity,
          unit: unidade.trim(),
          warehouse: 'PRINCIPAL',
          deliveryDate: '',
          sourceType: 'in_stock',
          unitPrice: 0,
          discount: 0,
          ipiPercent: 0,
          icmsPercent: 0,
          totalValue: 0
        });
      } catch (e) {
        console.error(`❌ Erro ao parsear item (minimal):`, e);
        continue;
      }
    }
  }
  
  console.log(`📦 Itens extraídos com sucesso: ${items.length}`);
  
  if (items.length === 0) {
    console.error('❌ Nenhum item encontrado com nenhum dos padrões');
  }
  
  return items;
}
