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
  
  // CLIENTE - padrão mais específico para evitar capturar texto extra
  // Padrão 1: CLIENTE: NOME até próximo campo (LOJA, CNPJ, CPF, ENDEREÇO)
  let clientMatch = text.match(/CLIENTE:?\s*([A-Z0-9\s\-\.]+?)(?=\s*(?:LOJA|CNPJ|CPF|ENDERE[ÇC]O|INSCRI[ÇC][ÃA]O|\n\n))/i);
  
  // Padrão 2: Se não encontrou, tentar pegar até quebra de linha dupla
  if (!clientMatch) {
    clientMatch = text.match(/CLIENTE:?\s*([^\n]+?)(?=\s*CNPJ|CPF|LOJA)/i);
  }
  
  // Padrão 3: Razão Social como alternativa
  if (!clientMatch) {
    clientMatch = text.match(/RAZ[ÃA]O\s+SOCIAL:?\s*([A-Z0-9\s\-\.]+?)(?=\s*(?:CNPJ|CPF|INSCRI[ÇC][ÃA]O|\n))/i);
  }
  
  if (clientMatch) {
    // Limpar nome: remover espaços extras, números isolados no final
    let cleanName = clientMatch[1]
      .trim()
      .replace(/\s+/g, ' ') // Normalizar espaços
      .replace(/\s+\d+$/, '') // Remover código de loja no final
      .replace(/LOJA\s*\d*$/i, ''); // Remover "LOJA" no final
    
    orderInfo.customerName = cleanName;
    console.log('✅ Cliente:', orderInfo.customerName);
  } else {
    console.warn('⚠️ Nome do cliente não encontrado');
  }
  
  // CNPJ/CPF - extrair primeiro para evitar contaminar outros campos
  const docMatch = text.match(/(?:CNPJ|CPF):?\s*([\d.\-\/]+)/i);
  if (docMatch) {
    orderInfo.customerDocument = docMatch[1].trim();
    console.log('✅ CNPJ/CPF:', orderInfo.customerDocument);
  }
  
  // ENDEREÇO - padrão mais específico
  const addressMatch = text.match(/ENDERE[ÇC]O:?\s*([^\n]+?)(?=\s*(?:N[ºo°]|BAIRRO|MUNIC[ÍI]PIO|COMPLEMENTO|\n))/i);
  if (addressMatch) {
    orderInfo.deliveryAddress = addressMatch[1].trim();
    console.log('✅ Endereço:', orderInfo.deliveryAddress);
  }
  
  // MUNICÍPIO - separar de UF
  const municipioMatch = text.match(/MUNIC[ÍI]PIO:?\s*([A-Z\s]+?)(?=\s*(?:ESTADO|UF|CEP|\d{5}|\n))/i);
  if (municipioMatch) {
    orderInfo.municipality = municipioMatch[1].trim();
    console.log('✅ Município:', orderInfo.municipality);
  }
  
  // TRANSPORTADORA - evitar capturar placa
  const transportadoraMatch = text.match(/TRANSPORTADORA:?\s*([A-Z0-9\s\-\.]+?)(?=\s*(?:PLACA|FRETE|REDESPACHO|\n))/i);
  if (transportadoraMatch) {
    orderInfo.carrier = transportadoraMatch[1].trim();
    console.log('✅ Transportadora:', orderInfo.carrier);
  }
  
  // FRETE/TIPO e VALOR - padrões separados
  const freightTypeMatch = text.match(/(?:FRETE\/TIPO|TIPO\s+FRETE):?\s*(CIF|FOB|[A-Z]+)/i);
  if (freightTypeMatch) {
    orderInfo.freightType = freightTypeMatch[1].trim().toUpperCase();
    console.log('✅ Tipo Frete:', orderInfo.freightType);
  }
  
  const freightValueMatch = text.match(/(?:VALOR\s+FRETE|FRETE.*?VALOR):?\s*R?\$?\s*([\d.,]+)/i);
  if (freightValueMatch) {
    orderInfo.freightValue = parseFloat(freightValueMatch[1].replace(/\./g, '').replace(',', '.'));
    console.log('✅ Valor Frete:', orderInfo.freightValue);
  }
  
  // OPERAÇÃO - código numérico
  const operacaoMatch = text.match(/(?:OPERA[ÇC][ÃA]O|C[ÓO]D\.?\s*OPERA[ÇC][ÃA]O):?\s*(\d+)/i);
  if (operacaoMatch) {
    orderInfo.operationCode = operacaoMatch[1];
    console.log('✅ Código Operação:', orderInfo.operationCode);
  }
  
  // EXECUTIVO/REPRESENTANTE - evitar capturar código
  const execMatch = text.match(/(?:EXECUTIVO|REPRESENTANTE|VENDEDOR):?\s*([A-Z\s]+?)(?=\s*(?:C[ÓO]DIGO|COMISS[ÃA]O|\d{4}|\n))/i);
  if (execMatch) {
    orderInfo.executiveName = execMatch[1].trim();
    console.log('✅ Executivo:', orderInfo.executiveName);
  }
  
  // Valores padrão
  orderInfo.priority = 'normal';
  
  console.log('📊 Resumo da extração:', {
    pedido: !!orderInfo.orderNumber,
    cliente: !!orderInfo.customerName,
    endereco: !!orderInfo.deliveryAddress,
    municipio: !!orderInfo.municipality,
    transportadora: !!orderInfo.carrier,
    frete: !!orderInfo.freightType,
    operacao: !!orderInfo.operationCode,
    executivo: !!orderInfo.executiveName,
    documento: !!orderInfo.customerDocument
  });
  
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
  
  // Padrão 1: Formato "Item XX Código XXX Qtde X,XX Uni XX V.Unit XXX" (texto corrido)
  // Exemplo: Item 01   Código 061171 Qtde 2,00   Uni PC   V.Unit 154,41   Desc 0,00...
  const itemTextRegex = /Item\s+(\d+)\s+C[óo]digo\s+(\d+)\s+Qtde\s+([\d,]+)\s+Uni\s+([A-Z]+)\s+V\.Unit\s+([\d.,]+)\s+Desc\s+([\d.,]+)\s+V\.\s*C\/\s*Desc\s+([\d.,]+)\s+NCM\s+\d+\s+%IPI\s+([\d.,]+)\s+Val\.\s*IPI\s+([\d.,]+)\s+%ICMS\s+([\d.,]+)\s+ICMS\s+([\d.,]+)\s+Total\s+([\d.,]+)\s+Total\s+c\/\s*IPI\s+([\d.,]+)\s+Armaz[ée]m\s+(\S+)\s+(?:Observa[çc][ãa]o\s+)?(?:Opera[çc][ãa]o\s+\S+\s+)?Descri[çc][ãa]o\s+(.+?)(?=Item\s+\d+\s+C[óo]digo|$)/gi;
  
  let match;
  let itemIndex = 1;
  while ((match = itemTextRegex.exec(tableText)) !== null) {
    const [, itemNum, codigo, qtd, unidade, vlrUnit, desc, vlrComDesc, ipi, vlrIpi, icmsPercent, icmsValor, total, totalComIpi, armazem, descricao] = match;
    
    items.push({
      itemNumber: String(itemIndex++),
      itemCode: codigo.trim(),
      description: descricao.trim(),
      quantity: Math.round(parseFloat(qtd.replace(',', '.'))), // Arredondar para inteiro
      unit: unidade.trim(),
      warehouse: armazem.trim(),
      deliveryDate: '',
      sourceType: 'in_stock',
      unitPrice: parseFloat(vlrUnit.replace(/\./g, '').replace(',', '.')),
      discount: parseFloat(desc.replace(',', '.')),
      ipiPercent: parseFloat(ipi.replace(',', '.')),
      icmsPercent: parseFloat(icmsPercent.replace(',', '.')),
      totalValue: parseFloat(total.replace(/\./g, '').replace(',', '.'))
    });
  }
  
  // Padrão 2: Tabela com pipes (formato TOTVS tradicional)
  if (items.length === 0) {
    console.warn('⚠️ Tentando padrão com pipes');
    const itemRegex = /\|\s*(\d+)\s*\|\s*([\d]+)\s*\|\s*([\d,]+)\s*\|\s*([A-Z]+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|\s*([^\|]+?)(?=\s*\||\s*$)/gi;
    
    while ((match = itemRegex.exec(tableText)) !== null) {
      const [, itemNum, codigo, qtd, unidade, vlrUnit, desc, ipi, icms, vlrMerc, descricao] = match;
      
      items.push({
        itemNumber: String(itemIndex++),
        itemCode: codigo.trim(),
        description: descricao.trim(),
        quantity: Math.round(parseFloat(qtd.replace(',', '.'))),
        unit: unidade.trim(),
        warehouse: 'PRINCIPAL',
        deliveryDate: '',
        sourceType: 'in_stock',
        unitPrice: parseFloat(vlrUnit.replace(/\./g, '').replace(',', '.')),
        discount: parseFloat(desc.replace(',', '.')),
        ipiPercent: parseFloat(ipi.replace(',', '.')),
        icmsPercent: parseFloat(icms.replace(',', '.')),
        totalValue: parseFloat(vlrMerc.replace(/\./g, '').replace(',', '.'))
      });
    }
  }
  
  // Padrão 3: Simplificado - buscar código e quantidade
  if (items.length === 0) {
    console.warn('⚠️ Tentando padrão simplificado');
    // Buscar sequências: Código XXXXXX Qtde X,XX
    const simpleRegex = /C[óo]digo\s+(\d+)\s+Qtde\s+([\d,]+)\s+Uni\s+([A-Z]+)/gi;
    
    while ((match = simpleRegex.exec(tableText)) !== null) {
      const [, codigo, qtd, unidade] = match;
      
      items.push({
        itemNumber: String(items.length + 1),
        itemCode: codigo.trim(),
        description: 'Produto',
        quantity: Math.round(parseFloat(qtd.replace(',', '.'))),
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
    }
  }
  
  console.log(`📦 Itens extraídos com sucesso: ${items.length}`);
  return items;
}
