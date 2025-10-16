import type { ParsedOrderData } from './excelParser';

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

export async function parsePdfOrder(file: File): Promise<ParsedOrderData & { quality?: ExtractionQuality }> {
  console.log('📄 PDF parsing iniciado:', file.name);
  
  // Get pdfjs dynamically to avoid React conflicts
  const pdfjs = await getPdfJs();
  
  const arrayBuffer = await file.arrayBuffer();
  
  // Try to load PDF with worker; fallback to inline processing if worker fails
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
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
  
  let fullText = '';
  
  // Extrair texto de todas as páginas
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  console.log('📊 Texto extraído (primeiros 1000 chars):', fullText.substring(0, 1000));
  
  const orderInfo = extractOrderHeader(fullText);
  const items = extractItemsTable(fullText);
  
  console.log('✅ Pedido identificado:', orderInfo.orderNumber);
  console.log('📦 Total de itens encontrados:', items.length);
  
  // Calcular qualidade da extração
  const quality: ExtractionQuality = {
    orderNumber: !!orderInfo.orderNumber,
    customerName: !!orderInfo.customerName,
    itemsCount: items.length,
    itemsWithPrice: items.filter(i => i.unitPrice).length,
    totalFields: 11,
    extractedFields: [
      orderInfo.orderNumber,
      orderInfo.customerName,
      orderInfo.deliveryAddress,
      orderInfo.deliveryDate,
      orderInfo.freightType,
      orderInfo.carrier,
      orderInfo.operationCode,
      orderInfo.executiveName,
      orderInfo.municipality,
      orderInfo.freightValue,
      orderInfo.customerDocument
    ].filter(Boolean).length
  };
  
  return {
    orderInfo,
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
    console.log('✅ Data Entrega:', orderInfo.deliveryDate);
  } else if (orderInfo.issueDate) {
    orderInfo.deliveryDate = orderInfo.issueDate;
    console.log('⚠️ Usando data de emissão como entrega');
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

function extractItemsTable(text: string): ParsedOrderData['items'] {
  const items: ParsedOrderData['items'] = [];
  
  // Encontrar início da tabela de composição
  const composicaoIndex = text.search(/COMPOSI[ÇC][ÃA]O/i);
  if (composicaoIndex === -1) {
    console.warn('⚠️ Tabela de composição não encontrada');
    return items;
  }
  
  const tableText = text.substring(composicaoIndex);
  console.log('📋 Primeiras linhas da tabela:', tableText.substring(0, 500));
  
  // NOVO PADRÃO ROBUSTO: Buscar blocos "Item XX ... Código XXXXXX ... Qtde XX,XX"
  // Permite qualquer quantidade de espaços/pipes entre os campos
  const blockRegex = /Item\s+(\d+)\s+.*?C[óo]digo\s+(\d+)\s+.*?Qtde\s+([\d,]+)\s+.*?Uni?\s+([A-Z]+)\s+.*?V\.?\s*Unit?\s+([\d.,]+)\s+.*?(?:Desc|%Desc)\s+([\d.,]+)\s+.*?%IPI\s+([\d.,]+)\s+.*?%ICMS\s+([\d.,]+)\s+.*?Total(?:\s+c\/\s*IPI)?\s+([\d.,]+)\s+.*?Armaz[ée]m\s+(\S+)\s+.*?Descri[çc][ãa]o\s+(.+?)(?=Item\s+\d+|$)/gis;
  
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
      
      console.log(`📦 Item ${itemNum}: Código ${codigo}, Qtde ${quantity}, Uni ${unidade}`);
      
      items.push({
        itemNumber: itemNum.trim(),
        itemCode: codigo.trim(),
        description: descricao.trim().split('\n')[0].substring(0, 200), // Pega primeira linha, max 200 chars
        quantity,
        unit: unidade.trim(),
        warehouse: armazem.trim(),
        deliveryDate: '',
        sourceType: 'in_stock',
        unitPrice: parseFloat(vlrUnit.replace(/\./g, '').replace(',', '.')),
        discount: parseFloat(desc.replace(',', '.')),
        ipiPercent: parseFloat(ipi.replace(',', '.')),
        icmsPercent: parseFloat(icms.replace(',', '.')),
        totalValue: parseFloat(total.replace(/\./g, '').replace(',', '.'))
      });
      itemIndex++;
    } catch (e) {
      console.error(`❌ Erro ao parsear item:`, e);
      continue;
    }
  }
  
  // FALLBACK 1: Padrão simplificado sem todos os campos
  if (items.length === 0) {
    console.warn('⚠️ Tentando fallback: padrão simplificado');
    const simpleBlockRegex = /Item\s+(\d+)\s+.*?C[óo]digo\s+(\d+)\s+.*?Qtde\s+([\d,]+)\s+.*?Uni?\s+([A-Z]+)/gis;
    
    while ((match = simpleBlockRegex.exec(tableText)) !== null) {
      try {
        const [, itemNum, codigo, qtd, unidade] = match;
        
        const quantityStr = qtd.trim().replace(',', '.');
        const quantity = parseFloat(quantityStr);
        
        if (isNaN(quantity) || quantity <= 0) {
          console.warn(`⚠️ Quantidade inválida para item ${codigo}: ${qtd}`);
          continue;
        }
        
        console.log(`📦 Item ${itemNum} (fallback): Código ${codigo}, Qtde ${quantity}`);
        
        items.push({
          itemNumber: itemNum.trim(),
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
