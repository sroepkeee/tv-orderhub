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
 * Limpa e extrai Centro de Custo do texto do Rateio
 */
function extractCostCenter(rateioText: string): string {
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
      return match[0].trim();
    }
  }
  
  // Se não encontrou padrão específico, retornar o texto limpo
  // mas remover qualquer parte que contenha "PROJETO" (isso é Item Conta)
  const withoutProjeto = cleaned.split(';')[0]
    .replace(/PROJETO\s+.*/i, '')
    .replace(/MANUTEN[CÇ][AÃ]O\s+.*/i, '')
    .replace(/P[OÓ]S[\s-]?VENDA.*/i, '')
    .trim();
  
  return withoutProjeto || cleaned.split(';')[0]?.trim() || '';
}

/**
 * Limpa e extrai Item Conta do texto do Rateio
 */
function extractAccountItem(rateioText: string): string {
  // Padrões conhecidos de Item Conta
  const patterns = [
    /PROJETO\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+/i,          // PROJETO ALGO
    /MANUTEN[CÇ][AÃ]O\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\-]+/i, // MANUTENÇÃO...
    /P[OÓ]S[\s-]?VENDA\s*-?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]*/i, // PÓS-VENDA...
  ];
  
  for (const pattern of patterns) {
    const match = rateioText.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  // Fallback: tentar pegar segunda parte após ;
  const parts = rateioText.split(';');
  if (parts.length > 1) {
    // Retornar segunda parte se não for igual ao centro de custo
    const secondPart = parts[1]?.trim();
    if (secondPart && !secondPart.match(/^SSM|^CUSTOMER|^FILIAL/i)) {
      return secondPart;
    }
  }
  
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
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(';').map(p => p.trim());
    const prefix = parts[0]?.toLowerCase() || '';
    
    console.log(`\n📝 Linha ${i + 1}: [${prefix.toUpperCase()}]`);
    console.log('   Raw:', line.substring(0, 150) + (line.length > 150 ? '...' : ''));
    
    // Cabecalho: Pedido Nº | Data Emissão
    if (prefix === 'cabecalho') {
      orderInfo.orderNumber = parts[1] || '';
      orderInfo.issueDate = parts[2] || '';
      console.log('   ✅ Pedido:', orderInfo.orderNumber);
      console.log('   ✅ Data Emissão:', orderInfo.issueDate);
    }
    
    // Informacoes Gerais: Codigo+Nome | CNPJ | Endereco | Bairro | IE | Telefone | CEP | Idioma | Garantia | Obs
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
      const phonePositions = [6, 5, 7, 4]; // Posições mais comuns
      for (const pos of phonePositions) {
        const phoneCandidate = parts[pos];
        if (phoneCandidate && phoneCandidate.match(/\d{10,}/)) {
          console.log(`   📱 Telefone encontrado na posição ${pos}:`, phoneCandidate);
          customerWhatsapp = formatWhatsApp(phoneCandidate);
          if (customerWhatsapp) break;
        }
      }
      
      // Se não encontrou, procurar em qualquer posição que tenha formato de telefone
      if (!customerWhatsapp) {
        for (let p = 1; p < parts.length; p++) {
          const part = parts[p];
          // Telefone brasileiro: (XX) XXXXX-XXXX ou similar
          if (part && (part.match(/\(\d{2}\)/) || part.match(/^\d{10,11}$/))) {
            console.log(`   📱 Telefone detectado na posição ${p}:`, part);
            customerWhatsapp = formatWhatsApp(part);
            if (customerWhatsapp) break;
          }
        }
      }
      
      // Garantia e Observação → notas
      const notes: string[] = [];
      if (parts[9]) notes.push(`Garantia: ${parts[9]}`);
      if (parts[10]) notes.push(parts[10]);
      orderInfo.notes = notes.join(' | ');
      
      console.log('   ✅ Cliente:', orderInfo.customerName);
      console.log('   ✅ CNPJ/CPF:', orderInfo.customerDocument);
      console.log('   ✅ WhatsApp:', customerWhatsapp || '⚠️ NÃO ENCONTRADO');
    }
    
    // Rateio: Centro de Custos | Item contábil
    else if (prefix === 'rateio') {
      const allRateioText = parts.slice(1).join(';');
      console.log('   📋 Rateio completo:', allRateioText);
      
      // Extrair Centro de Custo e Item Conta com funções dedicadas
      orderInfo.costCenter = extractCostCenter(allRateioText);
      orderInfo.accountItem = extractAccountItem(allRateioText);
      orderInfo.businessArea = deriveBusinessArea(orderInfo.costCenter);
      
      console.log('   ✅ Centro Custo:', orderInfo.costCenter || '⚠️ NÃO ENCONTRADO');
      console.log('   ✅ Item Conta:', orderInfo.accountItem || '⚠️ NÃO ENCONTRADO');
      console.log('   ✅ Área Negócio:', orderInfo.businessArea);
    }
    
    // Transporte: Transportadora | Tipo Frete | Valor Frete
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
    
    // Entrega: Codigo+Loja+Nome | Endereço | Bairro | Municipio | UF | CEP
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
    
    // Instalacao: (ignorar por enquanto)
    else if (prefix === 'instalacao') {
      console.log('   ⏭️ Instalação (ignorado)');
    }
    
    // ITEM: Seq | Codigo | TipoMat | Descrição | Qtd | NCM | Preço | Total | TotalIPI | Armazem | TES+Desc
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
      
      console.log('   ✅ Código:', itemCode, '| Tipo:', materialType || '⚠️ VAZIO');
      console.log('   ✅ NCM:', ncmCode || '⚠️ NÃO ENCONTRADO', `(posição 6 = "${parts[6]}")`);
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
  
  // Verificar NCM nos itens
  const itemsWithNcm = items.filter(i => i.ncmCode);
  const itemsWithMaterialType = items.filter(i => i.materialType);
  console.log(`✅ Itens com NCM: ${itemsWithNcm.length}/${items.length}`);
  console.log(`✅ Itens com Tipo Material: ${itemsWithMaterialType.length}/${items.length}`);
  
  if (itemsWithNcm.length === 0 && items.length > 0) {
    console.log('⚠️ ALERTA: Nenhum item tem NCM - verificar posição no TXT');
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
