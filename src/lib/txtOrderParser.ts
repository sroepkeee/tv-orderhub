import type { ParsedOrderData } from './excelParser';
import { addBusinessDays } from './utils';

/**
 * Mapeamento de Tipo Material para item_source_type
 */
const materialTypeMapping: Record<string, string> = {
  'PA': 'in_stock',        // Produto Acabado
  'ME': 'in_stock',        // Mercadoria
  'MP': 'production',      // Matéria Prima
  'MC': 'purchase_required', // Material Consumo
  'PI': 'production',      // Produto Intermediário
  'BN': 'in_stock',        // Beneficiamento
};

/**
 * Deriva área de negócio a partir do Centro de Custo
 */
function deriveBusinessArea(costCenter?: string): string {
  if (!costCenter) return 'ssm';
  
  const cc = costCenter.toUpperCase();
  
  if (cc.includes('E-COMMERCE') || cc.includes('ECOMMERCE')) return 'ecommerce';
  if (cc.includes('FILIAL')) return 'filial';
  if (cc.includes('BOWLING') || cc.includes('ELEVENTICKETS') || cc.includes('PAINEIS') || cc.includes('PAINÉIS')) return 'projetos';
  if (cc.includes('SSM') || cc.includes('CUSTOMER') || cc.includes('POS-VENDA') || cc.includes('PÓS-VENDA')) return 'ssm';
  
  return 'ssm';
}

/**
 * Formata número de telefone para WhatsApp (apenas dígitos, com DDI 55)
 */
function formatWhatsApp(phone?: string): string | undefined {
  if (!phone) return undefined;
  
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length < 10) return undefined;
  
  // Adiciona DDI 55 se não tiver
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  
  // Se já tem 12-13 dígitos, assume que já tem DDI
  if (digits.length >= 12) {
    return digits;
  }
  
  return undefined;
}

/**
 * Converte data DD/MM/YYYY para formato brasileiro ou calcula se vazia
 */
function parseOrCalculateDate(dateStr: string | undefined, issueDate: string): string {
  if (dateStr && dateStr.match(/\d{2}\/\d{2}\/\d{4}/)) {
    return dateStr;
  }
  
  // Calcular 10 dias úteis a partir da emissão
  if (issueDate) {
    return addBusinessDays(issueDate, 10);
  }
  
  // Fallback: data atual + 10 dias úteis
  const today = new Date();
  const formatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  return addBusinessDays(formatted, 10);
}

/**
 * Parseia arquivo TXT/CSV do TOTVS
 */
export async function parseTxtOrder(file: File): Promise<ParsedOrderData & { customerWhatsapp?: string }> {
  const text = await file.text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('📄 TXT parsing iniciado:', file.name, `(${lines.length} linhas)`);
  
  const orderInfo: ParsedOrderData['orderInfo'] & { customerWhatsapp?: string } = {
    orderNumber: '',
    customerName: '',
    deliveryAddress: '',
    municipality: '',
    issueDate: '',
    deliveryDate: '',
    priority: 'normal',
  };
  
  const items: ParsedOrderData['items'] = [];
  let customerWhatsapp: string | undefined;
  
  for (const line of lines) {
    const parts = line.split(';').map(p => p.trim());
    const prefix = parts[0]?.toLowerCase() || '';
    
    // Cabecalho: Pedido Nº | Data Emissão
    if (prefix === 'cabecalho') {
      orderInfo.orderNumber = parts[1] || '';
      orderInfo.issueDate = parts[2] || '';
      console.log('✅ Cabecalho:', { orderNumber: orderInfo.orderNumber, issueDate: orderInfo.issueDate });
    }
    
    // Informacoes Gerais: Codigo+Nome | CNPJ | Endereço | Bairro | IE | Telefone | CEP | Idioma | Garantia | Observação
    else if (prefix === 'informacoes gerais') {
      // Position 1: "005161 - NOME DO CLIENTE" ou apenas "NOME DO CLIENTE"
      const customerField = parts[1] || '';
      const customerMatch = customerField.match(/^(\d+)\s*-\s*(.+)$/);
      if (customerMatch) {
        orderInfo.customerName = customerMatch[2].trim();
      } else {
        orderInfo.customerName = customerField;
      }
      
      orderInfo.customerDocument = (parts[2] || '').replace(/[.\-\/]/g, '');
      orderInfo.deliveryAddress = [parts[3], parts[4]].filter(Boolean).join(', '); // Endereço + Bairro
      // parts[5] = IE (ignorar)
      customerWhatsapp = formatWhatsApp(parts[6]); // Telefone → WhatsApp
      // parts[7] = CEP (adicionar ao endereço)
      if (parts[7]) {
        orderInfo.deliveryAddress += ` - CEP: ${parts[7]}`;
      }
      // parts[8] = Idioma (ignorar)
      
      // Garantia e Observação → notas
      const notes: string[] = [];
      if (parts[9]) notes.push(`Garantia: ${parts[9]}`);
      if (parts[10]) notes.push(parts[10]);
      orderInfo.notes = notes.join(' | ');
      
      console.log('✅ Informacoes Gerais:', { 
        customerName: orderInfo.customerName, 
        customerDocument: orderInfo.customerDocument,
        customerWhatsapp 
      });
    }
    
    // Rateio: Centro de Custos | Item contábil
    else if (prefix === 'rateio') {
      orderInfo.costCenter = parts[1] || '';
      orderInfo.accountItem = parts[2] || '';
      orderInfo.businessArea = deriveBusinessArea(orderInfo.costCenter);
      console.log('✅ Rateio:', { costCenter: orderInfo.costCenter, accountItem: orderInfo.accountItem, businessArea: orderInfo.businessArea });
    }
    
    // Transporte: Transportadora | Tipo Frete | Valor Frete (assumindo este formato)
    else if (prefix === 'transporte') {
      orderInfo.carrier = parts[1] || '';
      orderInfo.freightType = parts[2] || '';
      if (parts[3]) {
        const freightValue = parseFloat(parts[3].replace(/\./g, '').replace(',', '.'));
        if (!isNaN(freightValue)) {
          orderInfo.freightValue = freightValue;
        }
      }
      console.log('✅ Transporte:', { carrier: orderInfo.carrier, freightType: orderInfo.freightType, freightValue: orderInfo.freightValue });
    }
    
    // Entrega: Município ou Cidade/UF
    else if (prefix === 'entrega') {
      orderInfo.municipality = parts[1] || '';
      console.log('✅ Entrega:', { municipality: orderInfo.municipality });
    }
    
    // Instalacao: (ignorar por enquanto)
    else if (prefix === 'instalacao') {
      // Dados de instalação - não mapeados no momento
    }
    
    // ITEM: Seq | Codigo | TipoMat | Descrição | Qtd | NCM | Preço | Total | TotalIPI | Armazem | TES+Desc
    else if (prefix === 'item') {
      const itemNumber = parts[1] || String(items.length + 1);
      const itemCode = parts[2] || '';
      const materialType = (parts[3] || '').toUpperCase();
      const description = parts[4] || '';
      const quantity = parseFloat((parts[5] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      // parts[6] = NCM (ignorar)
      const unitPrice = parseFloat((parts[7] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const totalValue = parseFloat((parts[8] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const totalWithIpi = parseFloat((parts[9] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const warehouse = parts[10] || '11';
      const tesOperation = parts[11] || '';
      
      // Calcular IPI percent
      let ipiPercent: number | undefined;
      if (totalValue > 0 && totalWithIpi > totalValue) {
        ipiPercent = ((totalWithIpi - totalValue) / totalValue) * 100;
      }
      
      // Extrair código de operação do TES
      let operationCode: string | undefined;
      const tesMatch = tesOperation.match(/^(\d+)/);
      if (tesMatch) {
        operationCode = tesMatch[1];
        // Setar no orderInfo se ainda não tiver
        if (!orderInfo.operationCode) {
          orderInfo.operationCode = tesOperation;
        }
      }
      
      // Mapear tipo de material para sourceType
      const sourceType = materialTypeMapping[materialType] || 'in_stock';
      
      if (itemCode) {
        items.push({
          itemNumber,
          itemCode,
          description,
          quantity,
          unit: 'UN',
          warehouse,
          deliveryDate: '', // Será preenchido depois
          sourceType,
          unitPrice,
          totalValue,
          ipiPercent,
        });
      }
    }
  }
  
  // Calcular data de entrega se não informada
  orderInfo.deliveryDate = parseOrCalculateDate(undefined, orderInfo.issueDate);
  
  // Preencher data de entrega nos itens
  items.forEach(item => {
    if (!item.deliveryDate) {
      item.deliveryDate = orderInfo.deliveryDate;
    }
  });
  
  console.log('✅ TXT parsing concluído:', {
    orderNumber: orderInfo.orderNumber,
    customerName: orderInfo.customerName,
    itemsCount: items.length,
    customerWhatsapp
  });
  
  return {
    orderInfo: {
      ...orderInfo,
      customerWhatsapp,
    } as any,
    items,
    customerWhatsapp,
  };
}
