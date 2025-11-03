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
  
  // 1. SANITIZAÇÃO: Normalizar espaços múltiplos e quebras de linha isoladas
  const sanitizedText = text
    .replace(/\s{2,}/g, ' ')  // Múltiplos espaços → 1 espaço
    .replace(/([A-Za-z])\.\s*\n\s*([A-Za-z])/g, '$1. $2');  // Reunir quebras no meio de palavras
  
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
    return items;
  }

  // 3. Encontrar o fim da tabela
  const endPatterns = [
    /TOTAL\s+DO\s+PEDIDO/i,
    /LGPD:/i,
    /Observa[çc][õo]es\s+Gerais/i
  ];
  let tableEnd = sanitizedText.length;
  for (const pat of endPatterns) {
    const m = sanitizedText.slice(tableStart).search(pat);
    if (m !== -1) { tableEnd = tableStart + m; break; }
  }

  const tableText = sanitizedText.slice(tableStart, tableEnd);
  
  if (import.meta.env.DEV) {
    console.log('🔍 [Parser por blocos] Iniciando extração de itens...');
    console.log('📄 Texto da tabela (primeiros 1500 chars):', tableText.substring(0, 1500));
  }

  // 4. SEGMENTAÇÃO POR BLOCOS "Item N"
  // Encontrar todas as âncoras "Item \d+"
  const itemAnchorsRegex = /(?:^|\s)Item\s+(\d{1,3})(?=\s)/gi;
  const anchors: { itemNumber: string; start: number }[] = [];
  let anchorMatch;
  
  while ((anchorMatch = itemAnchorsRegex.exec(tableText)) !== null) {
    anchors.push({
      itemNumber: anchorMatch[1],
      start: anchorMatch.index
    });
  }
  
  if (import.meta.env.DEV) {
    console.log(`📍 Âncoras "Item N" detectadas: ${anchors.length}`, anchors.map(a => a.itemNumber).join(', '));
  }
  
  // Se não encontrou âncoras, tentar fallback simples
  if (anchors.length === 0) {
    console.warn('⚠️ Nenhuma âncora "Item N" encontrada, tentando fallback...');
    return extractItemsFallback(tableText);
  }
  
  // 5. EXTRAÇÃO CAMPO A CAMPO PARA CADA BLOCO
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const nextAnchor = anchors[i + 1];
    
    // Definir limites do bloco
    const blockStart = anchor.start;
    const blockEnd = nextAnchor ? nextAnchor.start : tableText.length;
    const blockText = tableText.slice(blockStart, blockEnd);
    
    try {
      // Extração campo a campo com regex tolerantes
      const itemNumber = anchor.itemNumber;
      
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
      
      // DESCRIÇÃO (busca estendida - até 800 chars antes e depois)
      let description = 'Produto TOTVS';
      
      // Tentar extrair descrição no bloco expandido
      const expandedStart = Math.max(0, blockStart - 500);
      const expandedEnd = Math.min(tableText.length, blockEnd + 300);
      const expandedBlock = tableText.slice(expandedStart, expandedEnd);
      
      const descPatterns = [
        // Padrão 1: "Descrição: TEXTO"
        new RegExp(`Descri[çc][ãa]o[:\\s]+(.+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|Qtde|LGPD|TOTAL\\s+DO\\s+PEDIDO|$)`, 'is'),
        // Padrão 2: Próximo ao código
        new RegExp(`C[óo]digo\\s+${itemCode}[\\s\\S]{0,400}?Descri[çc][ãa]o[:\\s]+(.+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|Qtde|$)`, 'is'),
        // Padrão 3: Próximo ao número do item
        new RegExp(`Item\\s+${itemNumber}[\\s\\S]{0,400}?Descri[çc][ãa]o[:\\s]+(.+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|Qtde|$)`, 'is')
      ];
      
      for (const pattern of descPatterns) {
        const descMatch = expandedBlock.match(pattern);
        if (descMatch && descMatch[1].trim().length > 3) {
          description = descMatch[1]
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/^\d+\s*-?\s*/, '')  // Remove código numérico inicial
            .substring(0, 200);
          break;
        }
      }
      
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
          console.log(`✅ Item ${itemNumber}: ${itemCode} | ${quantity} ${unit} | ${description.substring(0, 40)}...`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Erro ao processar Item ${anchor.itemNumber}:`, error);
      if (import.meta.env.DEV) {
        console.log('📄 Bloco com erro:', blockText.substring(0, 300));
      }
    }
  }
  
  // 6. VERIFICAÇÃO DE COMPLETUDE
  const extractedCount = items.length;
  const expectedCount = anchors.length;
  const completeness = expectedCount > 0 ? (extractedCount / expectedCount) * 100 : 0;
  
  if (import.meta.env.DEV) {
    console.log(`📊 Extração: ${extractedCount}/${expectedCount} itens (${completeness.toFixed(1)}%)`);
  }
  
  // 7. FALLBACK SE MENOS DE 80% FORAM EXTRAÍDOS
  if (completeness < 80 && anchors.length > 0) {
    console.warn(`⚠️ Apenas ${completeness.toFixed(1)}% dos itens foram extraídos. Executando fallback...`);
    
    const missingNumbers = anchors
      .map(a => a.itemNumber)
      .filter(num => !items.some(i => i.itemNumber === num));
    
    if (import.meta.env.DEV) {
      console.log(`📋 Itens faltantes: ${missingNumbers.join(', ')}`);
    }
    
    // Tentar extração simplificada para itens faltantes
    const fallbackItems = extractItemsFallback(tableText, missingNumbers);
    
    fallbackItems.forEach(item => {
      const isDuplicate = items.some(
        i => i.itemCode === item.itemCode && i.itemNumber === item.itemNumber
      );
      if (!isDuplicate) {
        items.push(item);
        if (import.meta.env.DEV) {
          console.log(`✨ [Fallback] Item ${item.itemNumber} recuperado`);
        }
      }
    });
  }
  
  // 8. VALIDAÇÃO ESPECÍFICA PARA PEDIDOS DE TESTE
  const testOrderMatch = tableText.match(/132081|132087/);
  if (testOrderMatch && items.length < 32) {
    console.error(
      `❌ ERRO CRÍTICO: Pedido ${testOrderMatch[0]} deveria ter 32 itens, ` +
      `mas apenas ${items.length} foram extraídos (${((items.length / 32) * 100).toFixed(1)}%)`
    );
    
    if (import.meta.env.DEV) {
      const missingNumbers = Array.from({ length: 32 }, (_, i) => String(i + 1).padStart(2, '0'))
        .filter(num => !items.some(i => i.itemNumber === num));
      console.error(`📋 Itens faltantes no pedido de teste: ${missingNumbers.join(', ')}`);
    }
  }
  
  // 9. MÉTRICAS FINAIS
  if (import.meta.env.DEV) {
    console.log(`📦 Extração concluída: ${items.length} itens`);
    console.log(`📊 Âncoras detectadas vs Extraídos: ${anchors.length} → ${items.length}`);
    
    // Distribuição por unidade
    const unitDist = items.reduce((acc, item) => {
      acc[item.unit] = (acc[item.unit] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('📊 Distribuição por unidade:', unitDist);
  }
  
  console.log(`📦 Itens extraídos com sucesso: ${items.length}`);
  
  if (items.length === 0) {
    console.error('❌ Nenhum item encontrado com nenhum dos padrões');
  }
  
  return items;
}

// FUNÇÃO AUXILIAR: Fallback para extração simplificada
function extractItemsFallback(
  tableText: string, 
  targetNumbers?: string[]
): ParsedOrderData['items'] {
  const items: ParsedOrderData['items'] = [];
  
  if (import.meta.env.DEV) {
    console.log('🔄 Executando fallback de extração simplificada...');
  }
  
  // Regex simples: captura linhas tabulares básicas
  // Formato: Item? NumeroItem? Codigo Quantidade Unidade Valores...
  const simpleRegex = /(?:Item\s+)?(\d{1,3})\s+(\d{4,})\s+([\d.,]+)\s+(CT|CX|PC|UN|KG|MT|M|JG|P[ÇC]S?)\s+(?:[\d.,]+\s+)?(?:R?\$?\s*)?([\d.,]+)/gi;
  
  let match;
  while ((match = simpleRegex.exec(tableText)) !== null) {
    try {
      const [, itemNum, codigo, qtd, unidade, vlr] = match;
      
      // Se targetNumbers foi especificado, filtrar apenas esses números
      if (targetNumbers && !targetNumbers.includes(itemNum)) {
        continue;
      }
      
      const quantityStr = qtd.replace(/\./g, '').replace(',', '.');
      const quantity = parseFloat(quantityStr);
      
      if (isNaN(quantity) || quantity <= 0) continue;
      
      // Buscar descrição próxima
      let description = 'Produto TOTVS';
      const descPattern = new RegExp(
        `(?:Item\\s+${itemNum}|C[óo]digo\\s+${codigo})[\\s\\S]{0,500}?Descri[çc][ãa]o[:\\s]+(.+?)(?=Item\\s+\\d+|C[óo]digo\\s+\\d+|Qtde|$)`,
        'is'
      );
      const descMatch = tableText.match(descPattern);
      if (descMatch && descMatch[1].trim().length > 3) {
        description = descMatch[1].trim().replace(/\s+/g, ' ').substring(0, 200);
      }
      
      items.push({
        itemNumber: itemNum.trim(),
        itemCode: codigo.trim(),
        description,
        quantity,
        unit: unidade.trim(),
        warehouse: 'PRINCIPAL',
        deliveryDate: '',
        sourceType: 'in_stock',
        unitPrice: vlr ? parseFloat(vlr.replace(/\./g, '').replace(',', '.')) : 0,
        discount: 0,
        ipiPercent: 0,
        icmsPercent: 0,
        totalValue: 0
      });
      
    } catch (e) {
      continue;
    }
  }
  
  if (import.meta.env.DEV) {
    console.log(`🔄 Fallback extraiu ${items.length} itens adicionais`);
  }
  
  return items;
}
