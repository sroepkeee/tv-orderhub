import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { addDays, isWeekend, parse, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata data do formato YYYY-MM-DD para DD-MM-YYYY
 * @param dateString - Data em formato YYYY-MM-DD
 * @returns Data em formato DD-MM-YYYY
 */
export function formatDateBR(dateString: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}-${month}-${year}`;
}

/**
 * Calcula a data após N dias úteis (excluindo sábados e domingos)
 * @param startDate - Data inicial em formato DD/MM/YYYY ou Date
 * @param businessDays - Número de dias úteis a adicionar
 * @returns Data final em formato DD/MM/YYYY
 */
export function addBusinessDays(startDate: string | Date, businessDays: number): string {
  let currentDate: Date;
  
  // Converter string DD/MM/YYYY para Date
  if (typeof startDate === 'string') {
    currentDate = parse(startDate, 'dd/MM/yyyy', new Date());
  } else {
    currentDate = startDate;
  }
  
  let daysAdded = 0;
  
  while (daysAdded < businessDays) {
    currentDate = addDays(currentDate, 1);
    
    // Contar apenas se não for fim de semana
    if (!isWeekend(currentDate)) {
      daysAdded++;
    }
  }
  
  // Retornar em formato DD/MM/YYYY
  return format(currentDate, 'dd/MM/yyyy');
}

/**
 * Remove o texto de LGPD das descrições de itens
 * @param description - Descrição do item
 * @returns Descrição limpa sem o texto LGPD
 */
export function cleanItemDescription(description: string): string {
  if (!description) return '';
  
  let cleaned = description
    // Remove LGPD e tudo depois (formato "LGPD:" ou "LGPD :")
    .replace(/\s*LGPD\s*:?\s*.*/gi, '')
    // Remove declarações de consentimento que podem aparecer sem "LGPD:"
    .replace(/\s*Declaro\s+que\s+ao\s+fornecer.*/gi, '')
    // Remove texto de consentimento de dados
    .replace(/\s*autorizo\s+o\s+uso.*/gi, '')
    // Remove dados pessoais que vazaram
    .replace(/\s*CPF\s*:?\s*\d{3}\.?\d{3}\.?\d{3}-?\d{2}.*/gi, '')
    // Remove headers/footers que podem vazar do PDF
    .replace(/\s*EMPRESA\s*:.*$/gi, '')
    .replace(/\s*PEDIDO\s+N[ºo]\s*:.*$/gi, '')
    .replace(/\s*EMISS[ÃA]O\s*:.*$/gi, '')
    .trim();
  
  return cleaned;
}

/**
 * Formata mensagem de cotação JSON para exibição legível
 * @param content - Conteúdo da mensagem
 * @returns Objeto com informações formatadas
 */
export function formatCarrierMessage(content: string): { 
  formatted: string; 
  isQuote: boolean;
  data?: any;
} {
  try {
    const data = JSON.parse(content);
    
    // Se já vier como string (mensagem formatada do edge function), retornar diretamente
    if (typeof data === 'string') {
      return {
        formatted: data,
        isQuote: true
      };
    }
    
    // Verificar se é uma cotação (tem campos específicos)
    if (data.observations || data.recipient_city || data.declared_value) {
      const lines: string[] = [];
      
      // === CABEÇALHO ===
      if (data.user_message) {
        lines.push(data.user_message);
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('');
      }
      
      lines.push('🔔 SOLICITAÇÃO DE COTAÇÃO DE FRETE');
      if (data.observations) {
        lines.push(`📦 Pedido: #${data.observations}`);
      }
      if (data.totvs_order_number) {
        lines.push(`📋 Pedido TOTVS: ${data.totvs_order_number}`);
      }
      lines.push('');
      
      // === DADOS DO REMETENTE ===
      lines.push('📤 *1. DADOS DO REMETENTE*');
      lines.push('');
      lines.push('Razão Social: IMPLY TECNOLOGIA ELETRÔNICA LTDA.');
      lines.push('CNPJ: 05.681.400/0001-23');
      lines.push('Telefone: (51) 2106-8000');
      lines.push('Endereço: Rodovia Imply Tecnologia, 1111 (RST 287 KM 105)');
      lines.push('Bairro: Renascença');
      lines.push('Cidade/UF: Santa Cruz do Sul/RS');
      lines.push('CEP: 96815-710');
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      
      // === DADOS DO DESTINATÁRIO ===
      lines.push('📥 *2. DADOS DO DESTINATÁRIO*');
      lines.push('');
      if (data.recipient_name) {
        lines.push(`Nome: ${data.recipient_name}`);
      }
      if (data.recipient_document) {
        const docLabel = data.recipient_document.length > 14 ? 'CNPJ' : 'CPF';
        lines.push(`${docLabel}: ${data.recipient_document}`);
      }
      if (data.recipient_city) {
        lines.push(`Cidade: ${data.recipient_city}`);
      }
      if (data.recipient_state) {
        lines.push(`Estado: ${data.recipient_state}`);
      }
      if (data.recipient_address) {
        lines.push(`Endereço Completo: ${data.recipient_address}`);
      }
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      
      // === DADOS DA CARGA ===
      lines.push('📦 *3. DADOS DA CARGA*');
      lines.push('');
      
      if (data.product_description) {
        lines.push(`Produto: ${data.product_description}`);
        lines.push('');
      }
      
      // Lista de itens detalhada
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        lines.push(`Itens do Pedido (${data.items.length}):`);
        data.items.forEach((item: any, index: number) => {
          lines.push(`  ${index + 1}. ${item.description || item.item_description || 'Item'}`);
          if (item.code || item.item_code) {
            lines.push(`     • Código: ${item.code || item.item_code}`);
          }
          if (item.quantity || item.requested_quantity) {
            lines.push(`     • Quantidade: ${item.quantity || item.requested_quantity} ${item.unit || 'UND'}`);
          }
          if (item.unit_price) {
            lines.push(`     • Valor Unitário: R$ ${parseFloat(item.unit_price).toFixed(2)}`);
          }
          if (item.total_value) {
            lines.push(`     • Valor Total: R$ ${parseFloat(item.total_value).toFixed(2)}`);
          }
        });
        lines.push('');
      }
      
      if (data.package_type) {
        lines.push(`Embalagem: ${data.package_type}`);
        lines.push('');
      }
      
      if (data.declared_value) {
        lines.push(`💰 Valor Declarado: R$ ${Number(data.declared_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        lines.push('');
      }
      
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      
      // === INFORMAÇÕES DE FRETE ===
      if (data.freight_type || data.freight_modality) {
        lines.push('🚚 *4. INFORMAÇÕES DE FRETE*');
        lines.push('');
        
        if (data.freight_type) {
          lines.push(`Tipo de Frete: ${data.freight_type}`);
        }
        if (data.freight_modality) {
          lines.push(`Modalidade: ${data.freight_modality}`);
        }
        if (data.freight_payer) {
          lines.push(`Pagador do Frete: ${data.freight_payer}`);
        }
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('');
      }
      
      // === DIMENSÕES E PESO ===
      lines.push('📏 *5. DIMENSÕES E PESO*');
      lines.push('');
      
      if (data.weight_kg) {
        lines.push(`Peso Total: ${data.weight_kg} kg`);
      }
      
      if (data.volumes) {
        lines.push(`Quantidade de Volumes: ${data.volumes}`);
      }
      
      if (data.length_m || data.width_m || data.height_m) {
        const length = data.length_m || 0;
        const width = data.width_m || 0;
        const height = data.height_m || 0;
        lines.push(`Dimensões por Volume: ${length}m (C) x ${width}m (L) x ${height}m (A)`);
        
        if (length && width && height) {
          const cubicMeters = length * width * height;
          lines.push(`Cubagem: ${cubicMeters.toFixed(3)} m³`);
        }
      }
      lines.push('');
      
      // === PRAZOS ===
      if (data.issue_date || data.delivery_date || data.shipping_date) {
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('');
        lines.push('📅 *6. PRAZOS*');
        lines.push('');
        
        if (data.issue_date) {
          lines.push(`Data de Emissão: ${data.issue_date}`);
        }
        if (data.delivery_date) {
          lines.push(`Data de Entrega Prevista: ${data.delivery_date}`);
        }
        if (data.shipping_date) {
          lines.push(`Data de Embarque: ${data.shipping_date}`);
        }
        lines.push('');
      }
      
      // === OBSERVAÇÕES ===
      if (data.notes || data.additional_notes) {
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('');
        lines.push('📝 *OBSERVAÇÕES ADICIONAIS*');
        lines.push('');
        lines.push(data.notes || data.additional_notes);
        lines.push('');
      }
      
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      lines.push('');
      lines.push('✅ Aguardamos sua cotação!');
      
      return {
        formatted: lines.join('\n'),
        isQuote: true,
        data
      };
    }
    
    // JSON genérico - retornar formatado
    return {
      formatted: JSON.stringify(data, null, 2),
      isQuote: false,
      data
    };
  } catch {
    // Não é JSON, retornar como texto (provavelmente já formatado)
    return {
      formatted: content,
      isQuote: false
    };
  }
}
