import * as XLSX from 'xlsx';
import { addBusinessDays } from '@/lib/utils';

export interface ParsedOrderData {
  orderInfo: {
    orderNumber: string;
    customerName: string;
    deliveryAddress: string;
    municipality: string;
    issueDate: string;
    deliveryDate: string;
    carrier?: string;
    freightType?: string;
    freightValue?: number;
    notes?: string;
    priority?: string;
    customerDocument?: string;
    operationCode?: string;
    executiveName?: string;
    shippingDate?: string;
    costCenter?: string;
    accountItem?: string;
    businessArea?: string;
  };
  items: Array<{
    itemNumber: string;
    itemCode: string;
    description: string;
    quantity: number;
    unit: string;
    warehouse: string;
    deliveryDate: string;
    sourceType: string;
    unitPrice?: number;
    discount?: number;
    totalValue?: number;
    ipiPercent?: number;
    icmsPercent?: number;
  }>;
}

export function parseExcelOrder(file: File): Promise<ParsedOrderData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length < 2) {
          throw new Error('O arquivo deve conter 2 abas: PEDIDO e ITENS');
        }
        
        // Ler ABA 1: DADOS DO PEDIDO
        const orderSheet = workbook.Sheets[workbook.SheetNames[0]];
        const orderData = XLSX.utils.sheet_to_json(orderSheet, { header: 1 }) as any[][];
        
        // Ler ABA 2: ITENS DO PEDIDO
        const itemsSheet = workbook.Sheets[workbook.SheetNames[1]];
        const itemsData = XLSX.utils.sheet_to_json(itemsSheet, { header: 1 }) as any[][];
        
        const parsed: ParsedOrderData = {
          orderInfo: extractOrderInfo(orderData),
          items: extractItems(itemsData)
        };
        
        resolve(parsed);
      } catch (error: any) {
        reject(new Error(`Erro ao processar Excel: ${error.message}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

function extractOrderInfo(data: any[][]): ParsedOrderData['orderInfo'] {
  // Pular cabeçalho (linha 0), dados começam na linha 1
  const row = data[1] || [];
  
  const issueDate = String(row[5] || '').trim();
  let deliveryDate = String(row[6] || '').trim();
  
  // Se não houver data de entrega, calcular 10 dias úteis
  if (!deliveryDate && issueDate) {
    deliveryDate = addBusinessDays(issueDate, 10);
    console.log(`✅ Data de entrega calculada: ${deliveryDate} (10 dias úteis a partir de ${issueDate})`);
  }
  
  return {
    orderNumber: String(row[0] || '').trim(),
    customerName: String(row[1] || '').trim(),
    customerDocument: String(row[2] || '').trim(),
    deliveryAddress: String(row[3] || '').trim(),
    municipality: String(row[4] || '').trim(),
    issueDate,
    deliveryDate,
    shippingDate: String(row[7] || '').trim(),
    carrier: String(row[8] || '').trim(),
    freightType: String(row[9] || '').trim(),
    freightValue: parseFloat(String(row[10] || '0').replace(',', '.')),
    operationCode: String(row[11] || '').trim(),
    executiveName: String(row[12] || '').trim(),
    notes: String(row[13] || '').trim(),
    priority: (String(row[14] || 'normal').toLowerCase() as 'low' | 'normal' | 'high') || 'normal'
  };
}

function extractItems(data: any[][]): ParsedOrderData['items'] {
  // Pular cabeçalho (linha 0)
  return data.slice(1)
    .map((row, index) => {
      // Logs de debug para identificar embaralhamento (Solução 2B)
      const itemCode = String(row[1] || '').trim();
      const description = String(row[2] || '').trim();
      
      console.log(`🔍 [Excel Import] Item ${index + 1}:`, {
        itemCode,
        description,
        itemCodeLength: itemCode.length,
        descriptionLength: description.length,
        possibleSwap: itemCode.length > 50 && description.length < 20
      });
      
      return {
      itemNumber: String(row[0] || index + 1),
      itemCode,
      description,
      quantity: parseFloat(String(row[3] || '0').replace(',', '.')) || 0,
      unit: String(row[4] || 'PC').trim(),
      warehouse: String(row[5] || '11').trim(),
      deliveryDate: String(row[6] || '').trim(),
      sourceType: String(row[7] || 'in_stock').trim(),
      unitPrice: parseFloat(String(row[8] || '0').replace(',', '.')) || 0,
      discount: parseFloat(String(row[9] || '0').replace(',', '.')) || 0,
      ipiPercent: parseFloat(String(row[10] || '0').replace(',', '.')) || 0,
      icmsPercent: parseFloat(String(row[11] || '0').replace(',', '.')) || 0,
      totalValue: parseFloat(String(row[12] || '0').replace(',', '.')) || 0
    };
    })
    .filter(item => item.itemCode); // Remover linhas vazias
}
