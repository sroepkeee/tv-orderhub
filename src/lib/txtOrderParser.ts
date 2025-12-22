import type { ParsedOrderData } from './excelParser';
import { addBusinessDays, cleanItemDescription } from './utils';

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
  'PP': 'production',      // Produto em Processo
};

/**
 * Verifica se uma string está no formato DD/MM/YYYY
 */
function isValidDateFormat(dateStr: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr);
}

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
  
  console.log('📱 [WhatsApp] Input:', phone, '→ Digits:', digits, `(${digits.length} chars)`);
  
  if (digits.length < 10) {
    console.log('⚠️ [WhatsApp] Telefone muito curto, ignorando');
    return undefined;
  }
  
  // Adiciona DDI 55 se não tiver
  if (digits.length === 10 || digits.length === 11) {
    const formatted = `55${digits}`;
    console.log('✅ [WhatsApp] Formatado:', formatted);
    return formatted;
  }
  
  // Se já tem 12-13 dígitos, assume que já tem DDI
  if (digits.length >= 12) {
    console.log('✅ [WhatsApp] Já com DDI:', digits);
    return digits;
  }
  
  return undefined;
}

/**
 * Converte data DD/MM/YYYY para formato ISO ou calcula se inválida
 */
function parseOrCalculateDate(dateStr: string | undefined, issueDate: string | undefined): string {
  console.log('📅 [parseOrCalculateDate] Input:', { dateStr, issueDate });
  
  // Verificar se a data está no formato correto DD/MM/YYYY
  if (dateStr && isValidDateFormat(dateStr)) {
    try {
      const result = addBusinessDays(dateStr, 0);
      console.log('✅ [parseOrCalculateDate] Data convertida:', result);
      return result;
    } catch (e) {
      console.warn('⚠️ [parseOrCalculateDate] Erro ao converter data:', e);
    }
  }
  
  // Tentar calcular a partir da data de emissão
  if (issueDate && isValidDateFormat(issueDate)) {
    try {
      const result = addBusinessDays(issueDate, 10);
      console.log('✅ [parseOrCalculateDate] Data calculada (+10 dias úteis):', result);
      return result;
    } catch (e) {
      console.warn('⚠️ [parseOrCalculateDate] Erro ao calcular data:', e);
    }
  }
  
  // Fallback: data atual + 14 dias (sem usar addBusinessDays que pode falhar)
  const today = new Date();
  today.setDate(today.getDate() + 14);
  const fallback = today.toISOString().split('T')[0];
  console.log('⚠️ [parseOrCalculateDate] Usando fallback (hoje + 14 dias):', fallback);
  return fallback;
}

/**
 * Limpa e extrai Centro de Custo do texto do Rateio
 */
function extractCostCenter(rateioText: string): string {
  console.log('🔍 [extractCostCenter] Input:', rateioText.substring(0, 100));
  
  // Remover prefixo "ITEM CONTA" se presente
  let cleaned = rateioText.replace(/^ITEM\s+CONTA\s*:?\s*/i, '').trim();
  
  // Padrões conhecidos de Centro de Custo
  const patterns = [
    /SSM\s*-\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+/i,           // SSM - ALGO
    /CUSTOMER\s+SERVICE[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]*/i,   // CUSTOMER SERVICE...
    /FILIAL\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]*/i,            // FILIAL...
    /AUTOATENDIMENTO/i,
    /BOWLING/i,
    /ELEVENTICKETS/i,
    /PAINEIS|PAINÉIS/i,
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const result = match[0].trim();
      console.log('✅ [extractCostCenter] Encontrado:', result);
      return result;
    }
  }
  
  // Se não encontrou padrão específico, retornar o texto limpo
  // mas remover qualquer parte que contenha "PROJETO" (isso é Item Conta)
  const withoutProjeto = cleaned.split(';')[0]
    .replace(/PROJETO\s+.*/i, '')
    .replace(/MANUTEN[CÇ][AÃ]O\s+.*/i, '')
    .replace(/P[OÓ]S[\s-]?VENDA.*/i, '')
    .trim();
  
  const result = withoutProjeto || cleaned.split(';')[0]?.trim() || '';
  console.log('⚠️ [extractCostCenter] Fallback:', result);
  return result;
}

/**
 * Limpa e extrai Item Conta do texto do Rateio
 */
function extractAccountItem(rateioText: string): string {
  console.log('🔍 [extractAccountItem] Input:', rateioText.substring(0, 100));
  
  // Padrões conhecidos de Item Conta
  const patterns = [
    /PROJETO\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+/i,          // PROJETO ALGO
    /MANUTEN[CÇ][AÃ]O\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+/i, // MANUTENÇÃO...
    /P[OÓ]S[\s-]?VENDA\s*-?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]*/i, // PÓS-VENDA...
  ];
  
  for (const pattern of patterns) {
    const match = rateioText.match(pattern);
    if (match) {
      const result = match[0].trim();
      console.log('✅ [extractAccountItem] Encontrado:', result);
      return result;
    }
  }
  
  // Fallback: tentar pegar segunda parte após ;
  const parts = rateioText.split(';');
  if (parts.length > 1) {
    const secondPart = parts[1]?.trim();
    if (secondPart && !secondPart.match(/^SSM|^CUSTOMER|^FILIAL/i)) {
      console.log('⚠️ [extractAccountItem] Fallback (segunda parte):', secondPart);
      return secondPart;
    }
  }
  
  console.log('⚠️ [extractAccountItem] Não encontrado');
  return '';
}

/**
 * Parseia arquivo TXT/CSV do TOTVS
 */
export async function parseTxtOrder(file: File): Promise<ParsedOrderData & { customerWhatsapp?: string }> {
  const text = await file.text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📄 TXT PARSING INICIADO:', file.name);
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📊 Total de linhas: ${lines.length}`);
  
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
  let filialCode: string = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(';').map(p => p.trim());
    const prefix = parts[0]?.toLowerCase() || '';
    
    console.log(`\n📝 Linha ${i + 1}: [${prefix.toUpperCase()}]`);
    console.log('   Raw:', line.substring(0, 150) + (line.length > 150 ? '...' : ''));
    
    // ===== CABECALHO =====
    // Formato pode variar:
    // - Cabecalho;PEDIDO;DATA
    // - Cabecalho;FILIAL;PEDIDO;DATA;REPRESENTANTE
    if (prefix === 'cabecalho') {
      // Detectar formato verificando qual posição tem data válida
      let foundDate = false;
      
      // Tentar formato: Cabecalho;FILIAL;PEDIDO;DATA;REPRESENTANTE
      if (parts[3] && isValidDateFormat(parts[3])) {
        filialCode = parts[1] || '';
        orderInfo.orderNumber = parts[2] || '';
        orderInfo.issueDate = parts[3];
        const representative = parts[4] || '';
        
        // 🆕 Mapear Representante para executiveName
        if (representative) {
          orderInfo.executiveName = representative;
        }
        
        console.log('   ✅ Formato: Cabecalho;FILIAL;PEDIDO;DATA;REPRESENTANTE');
        console.log(`   ✅ Filial: ${filialCode}`);
        console.log(`   ✅ Pedido: ${orderInfo.orderNumber}`);
        console.log(`   ✅ Data Emissão: ${orderInfo.issueDate}`);
        if (representative) console.log(`   ✅ Representante → executiveName: ${representative}`);
        foundDate = true;
      }
      // Tentar formato: Cabecalho;PEDIDO;DATA
      else if (parts[2] && isValidDateFormat(parts[2])) {
        orderInfo.orderNumber = parts[1] || '';
        orderInfo.issueDate = parts[2];
        
        console.log('   ✅ Formato: Cabecalho;PEDIDO;DATA');
        console.log(`   ✅ Pedido: ${orderInfo.orderNumber}`);
        console.log(`   ✅ Data Emissão: ${orderInfo.issueDate}`);
        foundDate = true;
      }
      
      // Se não encontrou data válida, tentar extrair o que for possível
      if (!foundDate) {
        console.warn('   ⚠️ Formato de cabeçalho desconhecido - tentando extrair...');
        
        // Procurar data em todas as posições
        for (let p = 1; p < parts.length; p++) {
          if (isValidDateFormat(parts[p])) {
            orderInfo.issueDate = parts[p];
            // Pedido geralmente é a posição anterior à data
            if (p > 1) {
              orderInfo.orderNumber = parts[p - 1] || '';
            }
            console.log(`   ⚠️ Data encontrada na posição ${p}: ${orderInfo.issueDate}`);
            console.log(`   ⚠️ Pedido (inferido): ${orderInfo.orderNumber}`);
            foundDate = true;
            break;
          }
        }
        
        // Se ainda não encontrou, usar primeira posição como pedido
        if (!foundDate && parts[1]) {
          orderInfo.orderNumber = parts[1];
          console.log(`   ⚠️ Usando primeira posição como pedido: ${orderInfo.orderNumber}`);
        }
      }
      
      // Adicionar filial às notas se disponível
      if (filialCode && !orderInfo.notes?.includes('Filial')) {
        orderInfo.notes = `Filial: ${filialCode}`;
      }
    }
    
    // ===== INFORMACOES GERAIS =====
    else if (prefix === 'informacoes gerais') {
      console.log('   📋 Parts:', parts.map((p, idx) => `[${idx}]=${p?.substring(0, 30) || 'vazio'}`).join(' | '));
      
      // Position 1: "005161 - NOME DO CLIENTE" ou apenas "NOME DO CLIENTE"
      const customerField = parts[1] || '';
      const customerMatch = customerField.match(/^(\d+)\s*-\s*(.+)$/);
      if (customerMatch) {
        orderInfo.customerName = customerMatch[2].trim();
      } else {
        orderInfo.customerName = customerField;
      }
      
      orderInfo.customerDocument = (parts[2] || '').replace(/[.\-\/]/g, '');
      
      // Telefone pode estar em diferentes posições - tentar várias
      const phonePositions = [6, 5, 7, 4, 8]; // Posições mais comuns
      for (const pos of phonePositions) {
        const phoneCandidate = parts[pos];
        if (phoneCandidate) {
          const digits = phoneCandidate.replace(/\D/g, '');
          if (digits.length >= 10 && digits.length <= 13) {
            console.log(`   📱 Telefone encontrado na posição ${pos}:`, phoneCandidate);
            customerWhatsapp = formatWhatsApp(phoneCandidate);
            if (customerWhatsapp) break;
          }
        }
      }
      
      // Se não encontrou, procurar em qualquer posição que tenha formato de telefone
      if (!customerWhatsapp) {
        for (let p = 1; p < parts.length; p++) {
          const part = parts[p];
          if (part && (part.match(/\(\d{2}\)/) || part.match(/^\d{10,11}$/))) {
            console.log(`   📱 Telefone detectado na posição ${p}:`, part);
            customerWhatsapp = formatWhatsApp(part);
            if (customerWhatsapp) break;
          }
        }
      }
      
      // Garantia e Observação → notas
      const notes: string[] = [];
      if (orderInfo.notes) notes.push(orderInfo.notes);
      if (parts[9]) notes.push(`Garantia: ${parts[9]}`);
      if (parts[10]) notes.push(parts[10]);
      orderInfo.notes = notes.filter(Boolean).join(' | ');
      
      console.log('   ✅ Cliente:', orderInfo.customerName);
      console.log('   ✅ CNPJ/CPF:', orderInfo.customerDocument);
      console.log('   ✅ WhatsApp:', customerWhatsapp || '⚠️ NÃO ENCONTRADO');
    }
    
    // ===== RATEIO =====
    else if (prefix === 'rateio') {
      const allRateioText = parts.slice(1).join(';');
      console.log('   📋 Rateio completo:', allRateioText.substring(0, 100));
      
      // Formato especial: Rateio;NAO SE APLICA - DESPESA;;INDUSTRIAL;
      const firstField = (parts[1] || '').trim();
      const thirdField = (parts[3] || '').trim();
      
      if (firstField.includes('NAO SE APLICA') || firstField === '-') {
        // Caso especial: sem centro de custo, BU no terceiro campo
        orderInfo.businessUnit = thirdField || '';
        orderInfo.costCenter = '';
        orderInfo.accountItem = '';
        console.log('   ⚠️ RATEIO especial (NAO SE APLICA)');
        console.log('   ✅ Business Unit:', orderInfo.businessUnit);
      } else {
        // Extrair Centro de Custo e Item Conta com funções dedicadas
        orderInfo.costCenter = extractCostCenter(allRateioText);
        orderInfo.accountItem = extractAccountItem(allRateioText);
        console.log('   ✅ Centro Custo:', orderInfo.costCenter || '⚠️ NÃO ENCONTRADO');
        console.log('   ✅ Item Conta:', orderInfo.accountItem || '⚠️ NÃO ENCONTRADO');
      }
      
      orderInfo.businessArea = deriveBusinessArea(orderInfo.costCenter);
      console.log('   ✅ Área Negócio:', orderInfo.businessArea);
    }
    
    // ===== TRANSPORTE =====
    else if (prefix === 'transporte') {
      orderInfo.carrier = parts[1] || '';
      orderInfo.freightType = parts[2] || '';
      if (parts[3]) {
        const freightValue = parseFloat(parts[3].replace(/\./g, '').replace(',', '.'));
        if (!isNaN(freightValue)) {
          orderInfo.freightValue = freightValue;
        }
      }
      console.log('   ✅ Transportadora:', orderInfo.carrier);
      console.log('   ✅ Tipo Frete:', orderInfo.freightType);
      console.log('   ✅ Valor Frete:', orderInfo.freightValue);
    }
    
    // ===== ENTREGA =====
    else if (prefix === 'entrega') {
      const endereco = parts[2] || '';
      const bairro = parts[3] || '';
      const municipio = parts[4] || '';
      const uf = parts[5] || '';
      const cep = parts[6] || '';
      
      // Montar endereço de entrega completo
      const addressParts = [endereco, bairro].filter(Boolean);
      orderInfo.deliveryAddress = addressParts.join(', ');
      if (cep) {
        orderInfo.deliveryAddress += ` - CEP: ${cep}`;
      }
      
      // Município com UF
      orderInfo.municipality = municipio;
      if (uf) {
        orderInfo.municipality += `/${uf}`;
      }
      
      console.log('   ✅ Endereço:', orderInfo.deliveryAddress);
      console.log('   ✅ Município:', orderInfo.municipality);
    }
    
    // ===== INSTALACAO =====
    else if (prefix === 'instalacao') {
      console.log('   ⏭️ Instalação (ignorado)');
    }
    
    // ===== ITEM =====
    // Formato: ITEM;Seq;Codigo;TipoMat;Descrição;Qtd;NCM;Preço;Total;TotalIPI;Armazem;TES+Desc
    else if (prefix === 'item') {
      console.log('   📦 Item parts:', parts.slice(1, 12).map((p, idx) => `[${idx+1}]=${p?.substring(0, 20) || 'vazio'}`).join(' | '));
      
      const itemNumber = parts[1] || String(items.length + 1);
      const itemCode = parts[2] || '';
      const materialType = (parts[3] || '').toUpperCase();
      const rawDescription = parts[4] || '';
      const description = cleanItemDescription(rawDescription); // Limpar LGPD
      const quantity = parseFloat((parts[5] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const ncmCode = (parts[6] || '').trim(); // NCM - Nomenclatura Comum do Mercosul
      const unitPrice = parseFloat((parts[7] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const totalValue = parseFloat((parts[8] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const totalWithIpi = parseFloat((parts[9] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const warehouse = parts[10] || '11';
      const tesOperation = parts[11] || '';
      
      console.log('   ✅ Código:', itemCode, '| Tipo Material:', materialType || '⚠️ VAZIO');
      console.log('   ✅ NCM:', ncmCode || '⚠️ NÃO ENCONTRADO', `(parts[6] = "${parts[6]}")`);
      console.log('   ✅ Descrição:', description.substring(0, 50) + (description.length > 50 ? '...' : ''));
      if (rawDescription !== description) {
        console.log('   🧹 LGPD removido da descrição');
      }
      
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
          ncmCode: ncmCode || undefined,
          materialType: materialType || undefined,
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
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 RESUMO DO PARSING');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Pedido:', orderInfo.orderNumber);
  console.log('✅ Cliente:', orderInfo.customerName);
  console.log('✅ Data Emissão:', orderInfo.issueDate);
  console.log('✅ Data Entrega:', orderInfo.deliveryDate);
  console.log('✅ Centro Custo:', orderInfo.costCenter || '⚠️ VAZIO');
  console.log('✅ Item Conta:', orderInfo.accountItem || '⚠️ VAZIO');
  console.log('✅ Área Negócio:', orderInfo.businessArea);
  console.log('✅ WhatsApp:', customerWhatsapp || '⚠️ NÃO ENCONTRADO');
  console.log('✅ Itens:', items.length);
  
  // Verificar NCM e MaterialType nos itens
  const itemsWithNcm = items.filter(i => i.ncmCode);
  const itemsWithMaterialType = items.filter(i => i.materialType);
  console.log(`✅ Itens com NCM: ${itemsWithNcm.length}/${items.length}`);
  console.log(`✅ Itens com Tipo Material: ${itemsWithMaterialType.length}/${items.length}`);
  
  if (itemsWithNcm.length === 0 && items.length > 0) {
    console.log('⚠️ ALERTA: Nenhum item tem NCM - verifique a posição no arquivo TXT');
  }
  if (itemsWithMaterialType.length === 0 && items.length > 0) {
    console.log('⚠️ ALERTA: Nenhum item tem Tipo Material - verifique a posição no arquivo TXT');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  
  return {
    orderInfo: {
      ...orderInfo,
      customerWhatsapp,
    } as any,
    items,
    customerWhatsapp,
  };
}
