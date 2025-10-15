import type { ParsedOrderData } from './excelParser';

// Lazy load pdfjs to avoid conflicts with React
let pdfjsLib: any = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    // Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
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
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
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
  
  console.log('📊 Texto extraído (primeiros 500 chars):', fullText.substring(0, 500));
  
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
  
  // PEDIDO Nº
  const orderNumberMatch = text.match(/PEDIDO\s+N[ºo°]:\s*(\d+)/i);
  if (orderNumberMatch) {
    orderInfo.orderNumber = orderNumberMatch[1];
  }
  
  // EMISSÃO para issueDate
  const issueDateMatch = text.match(/EMISS[AÃ]O:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (issueDateMatch) {
    orderInfo.issueDate = issueDateMatch[1];
  }
  
  // DATA DE ENTREGA - procurar por padrão específico ou usar emissão como fallback
  const deliveryDateMatch = text.match(/(?:ENTREGA|PREVIS[ÃA]O):\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (deliveryDateMatch) {
    orderInfo.deliveryDate = deliveryDateMatch[1];
  } else if (orderInfo.issueDate) {
    // Usar data de emissão como fallback
    orderInfo.deliveryDate = orderInfo.issueDate;
  }
  
  // CLIENTE
  const clientMatch = text.match(/CLIENTE:\s*([^\n]+?)(?=\s+LOJA:|$)/i);
  if (clientMatch) {
    orderInfo.customerName = clientMatch[1].trim();
  }
  
  // ENDEREÇO
  const addressMatch = text.match(/ENDERE[ÇC]O:\s*([^\n]+?)(?=\s+BAIRRO:|$)/i);
  if (addressMatch) {
    orderInfo.deliveryAddress = addressMatch[1].trim();
  }
  
  // MUNICÍPIO
  const municipioMatch = text.match(/MUNIC[ÍI]PIO:\s*([^\n]+?)(?=\s+ESTADO:|UF:|$)/i);
  if (municipioMatch) {
    orderInfo.municipality = municipioMatch[1].trim();
  }
  
  // FRETE/TIPO e VALOR
  const freteMatch = text.match(/FRETE\/TIPO:\s*([^\s]+)\s+VALOR:\s*([\d.,]+)/i);
  if (freteMatch) {
    orderInfo.freightType = freteMatch[1].trim();
    orderInfo.freightValue = parseFloat(freteMatch[2].replace(/\./g, '').replace(',', '.'));
  }
  
  // TRANSPORTADORA
  const transportadoraMatch = text.match(/TRANSPORTADORA:\s*([^\n]+?)(?=\s+PLACA:|$)/i);
  if (transportadoraMatch) {
    orderInfo.carrier = transportadoraMatch[1].trim();
  }
  
  // OPERAÇÃO
  const operacaoMatch = text.match(/Opera[çc][ãa]o:\s*(\d+)/i);
  if (operacaoMatch) {
    orderInfo.operationCode = operacaoMatch[1];
  }
  
  // EXECUTIVO/REPRESENTANTE
  const execMatch = text.match(/(?:EXECUTIVO|REPRESENTANTE):\s*([^\n]+?)(?=\s+|$)/i);
  if (execMatch) {
    orderInfo.executiveName = execMatch[1].trim();
  }
  
  // CNPJ/CPF
  const docMatch = text.match(/(?:CNPJ|CPF):\s*([\d.\/\-]+)/i);
  if (docMatch) {
    orderInfo.customerDocument = docMatch[1].replace(/[.\-\/]/g, '');
  }
  
  // Valores padrão
  orderInfo.priority = 'normal';
  
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
  
  // Padrões para linhas de itens
  // Formato: | 01 | 052289 | 4,00 | PC | 785,85 | 0,00 | 5,00 | 18,00 | 3.143,40 | TINTA...
  const itemRegex = /\|\s*(\d+)\s*\|\s*([\d]+)\s*\|\s*([\d,]+)\s*\|\s*([A-Z]+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|\s*([^\|]+?)(?=\s*\||\s*$)/gi;
  
  let match;
  let itemIndex = 1;
  while ((match = itemRegex.exec(tableText)) !== null) {
    const [, itemNum, codigo, qtd, unidade, vlrUnit, desc, ipi, icms, vlrMerc, descricao] = match;
    
    items.push({
      itemNumber: String(itemIndex++),
      itemCode: codigo.trim(),
      description: descricao.trim(),
      quantity: parseFloat(qtd.replace(',', '.')),
      unit: unidade.trim(),
      warehouse: 'PRINCIPAL',
      deliveryDate: '', // Será preenchido com a data do pedido na importação
      sourceType: 'in_stock',
      unitPrice: parseFloat(vlrUnit.replace(/\./g, '').replace(',', '.')),
      discount: parseFloat(desc.replace(',', '.')),
      ipiPercent: parseFloat(ipi.replace(',', '.')),
      icmsPercent: parseFloat(icms.replace(',', '.')),
      totalValue: parseFloat(vlrMerc.replace(/\./g, '').replace(',', '.'))
    });
  }
  
  // Fallback: tentar padrão mais simples se não encontrar itens
  if (items.length === 0) {
    console.warn('⚠️ Tentando padrão alternativo de extração');
    const lines = tableText.split('\n');
    
    for (const line of lines) {
      // Procurar por linhas com código de produto (números no início)
      const simpleMatch = line.match(/(\d{6})\s+([\d,]+)\s+([A-Z]{2,3})\s+([\d.,]+)/);
      if (simpleMatch) {
        const [, codigo, qtd, unidade, vlrUnit] = simpleMatch;
        
        // Extrair descrição (texto após os números)
        const descMatch = line.match(/[A-Z]{2,3}\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+(.+)$/);
        
        items.push({
          itemNumber: String(items.length + 1),
          itemCode: codigo.trim(),
          description: descMatch ? descMatch[1].trim() : 'Produto',
          quantity: parseFloat(qtd.replace(',', '.')),
          unit: unidade.trim(),
          warehouse: 'PRINCIPAL',
          deliveryDate: '',
          sourceType: 'in_stock',
          unitPrice: parseFloat(vlrUnit.replace(/\./g, '').replace(',', '.')),
          discount: 0,
          ipiPercent: 0,
          icmsPercent: 0,
          totalValue: 0
        });
      }
    }
  }
  
  console.log(`📦 Itens extraídos com sucesso: ${items.length}`);
  return items;
}
