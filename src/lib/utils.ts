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
  
  // Remove o parágrafo LGPD específico
  const lgpdPattern = /\s*LGPD:\s*Declaro que ao fornecer os meus dados estou de acordo que a Imply proceda com arquivamento de meus dados,\s*conforme previsto na Lei Geral de Proteção de[^\n]*/gi;
  
  return description.replace(lgpdPattern, '').trim();
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
    
    // Verificar se é uma cotação (tem campos específicos)
    if (data.observations || data.recipient_city || data.total_value) {
      const lines: string[] = [];
      
      if (data.observations) {
        lines.push(`📦 Pedido: #${data.observations}`);
      }
      
      if (data.recipient_city && data.recipient_state) {
        lines.push(`📍 Destino: ${data.recipient_city}/${data.recipient_state}`);
      }
      
      if (data.volumes) {
        lines.push(`📊 Volumes: ${data.volumes}`);
      }
      
      if (data.total_weight) {
        lines.push(`⚖️ Peso Total: ${data.total_weight} kg`);
      }
      
      if (data.total_value) {
        lines.push(`💰 Valor Total: R$ ${Number(data.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      }
      
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        lines.push(`\n📦 Itens (${data.items.length}):`);
        data.items.forEach((item: any, idx: number) => {
          lines.push(`  ${idx + 1}. ${item.description || item.name || 'Item'} - ${item.quantity || 1} un`);
        });
      }
      
      return {
        formatted: lines.join('\n'),
        isQuote: true,
        data
      };
    }
    
    // JSON genérico - retornar texto limpo
    return {
      formatted: content,
      isQuote: false,
      data
    };
  } catch {
    // Não é JSON, retornar como texto
    return {
      formatted: content,
      isQuote: false
    };
  }
}
