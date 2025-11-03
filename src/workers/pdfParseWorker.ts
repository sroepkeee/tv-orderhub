// Web Worker para parsing de PDF fora do thread principal
// Evita travamento da UI durante leitura de PDFs grandes

let shouldCancel = false;

interface ParseOptions {
  maxPages?: number | 'ALL';
  earlyStop?: boolean;
}

interface StartMessage {
  type: 'start';
  fileBuffer: ArrayBuffer;
  options?: ParseOptions;
}

interface CancelMessage {
  type: 'cancel';
}

type WorkerMessage = StartMessage | CancelMessage;

// Funções de extração (simplificadas do pdfParser.ts)
function extractOrderHeader(text: string): any {
  const orderNumberMatch = text.match(/(?:PEDIDO|Pedido|ORDEM)\s*(?:N[°º]?|Nº|#)?\s*[:.]?\s*(\d{6,})/i);
  const customerMatch = text.match(/(?:CLIENTE|Cliente|Razão Social)[:.\s]+([A-ZÀ-Ú][A-ZÀ-Ú\s.&-]+?)(?=\s{2,}|$)/i);
  const dateMatch = text.match(/(?:DATA|Data|Emissão)[:.\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/i);
  
  return {
    orderNumber: orderNumberMatch?.[1] || '',
    customerName: customerMatch?.[1]?.trim() || '',
    issueDate: dateMatch?.[1] || '',
  };
}

function extractItemsTable(text: string): any[] {
  const items: any[] = [];
  
  // Procura por padrões de tabela de itens
  const tablePattern = /(\d+)\s+([A-Z0-9\-\.]+)\s+([A-ZÀ-Ú\s]+?)\s+(\d+[\.,]?\d*)\s+(UN|PC|KG|MT|CX)/gi;
  let match;
  
  while ((match = tablePattern.exec(text)) !== null) {
    items.push({
      item: match[1],
      code: match[2],
      description: match[3].trim(),
      quantity: parseFloat(match[4].replace(',', '.')),
      unit: match[5],
    });
  }
  
  return items;
}

function calculateQuality(header: any, items: any[]): any {
  let score = 0;
  const issues: string[] = [];
  
  if (header.orderNumber) score += 30;
  else issues.push('Número do pedido não encontrado');
  
  if (header.customerName) score += 20;
  else issues.push('Nome do cliente não encontrado');
  
  if (items.length > 0) score += 50;
  else issues.push('Nenhum item encontrado');
  
  return {
    score,
    level: score >= 80 ? 'good' : score >= 50 ? 'medium' : 'poor',
    issues,
  };
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data?.type === 'cancel') {
    shouldCancel = true;
    return;
  }

  if (e.data?.type === 'start') {
    shouldCancel = false;
    const { fileBuffer, options } = e.data;
    
    try {
      // Importar pdfjs-dist dinamicamente no worker
      const pdfjs = await import('pdfjs-dist');
      
      // No worker, não criar outro worker interno
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(fileBuffer),
        useWorkerFetch: false,
        disableAutoFetch: true,
        disableStream: true,
      });
      
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      const maxPages = options?.maxPages === 'ALL' 
        ? totalPages 
        : Math.min(options?.maxPages ?? 10, totalPages);
      
      let fullText = '';
      let header: any = null;
      let items: any[] = [];
      
      // Processar páginas com progresso
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        if (shouldCancel) {
          self.postMessage({ 
            type: 'error', 
            message: 'Leitura cancelada pelo usuário' 
          });
          return;
        }
        
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ') + '\n';
        
        fullText += pageText;
        
        // Reportar progresso
        self.postMessage({
          type: 'progress',
          page: pageNum,
          total: maxPages,
          totalPages,
        });
        
        // Tentar extrair dados incrementalmente
        if (!header || !header.orderNumber) {
          header = extractOrderHeader(fullText);
        }
        
        if (items.length === 0) {
          items = extractItemsTable(fullText);
        }
        
        // Early stop: se já temos pedido + itens, parar
        if (options?.earlyStop && header?.orderNumber && items.length > 0) {
          console.log(`✅ [Worker] Early stop na página ${pageNum}/${maxPages}`);
          break;
        }
        
        // Yield para não travar o worker
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Garantir que temos pelo menos estruturas vazias
      if (!header) header = { orderNumber: '', customerName: '', issueDate: '' };
      
      const quality = calculateQuality(header, items);
      
      self.postMessage({
        type: 'result',
        data: {
          orderInfo: header,
          items,
          quality,
        },
      });
      
    } catch (error: any) {
      self.postMessage({
        type: 'error',
        message: error.message || 'Erro ao processar PDF',
      });
    }
  }
};
