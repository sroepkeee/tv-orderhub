/**
 * Detecção de intenção de alteração em mensagens de clientes
 * Identifica quando o cliente quer modificar algo no pedido
 */

export type ChangeRequestType = 
  | 'delivery_address'
  | 'delivery_date'
  | 'add_item'
  | 'remove_item'
  | 'change_quantity'
  | 'cancel_order'
  | 'change_contact'
  | 'other';

interface DetectedChange {
  type: ChangeRequestType;
  confidence: number; // 0-1
  extractedValue?: string;
}

// Padrões para cada tipo de alteração
const changePatterns: Record<ChangeRequestType, RegExp[]> = {
  delivery_address: [
    /mudar?\s*(o)?\s*endere[çc]o/i,
    /alterar?\s*(o)?\s*endere[çc]o/i,
    /trocar?\s*(o)?\s*endere[çc]o/i,
    /entregar?\s*(em)?\s*outro\s*(lugar|endere[çc]o)/i,
    /endere[çc]o\s*(est[aá]|t[aá])\s*errado/i,
    /mand[ae]r?\s*(pra|para)\s*outro\s*(lugar|endere[çc]o)/i,
    /novo\s*endere[çc]o/i,
  ],
  delivery_date: [
    /mudar?\s*(a)?\s*data/i,
    /alterar?\s*(a)?\s*data/i,
    /antecipar?\s*(a)?\s*(entrega|data)/i,
    /adiar?\s*(a)?\s*(entrega|data)/i,
    /preciso?\s*(para|at[ée])\s*(o)?\s*dia/i,
    /mudar?\s*(o)?\s*prazo/i,
    /postergar?/i,
    /reprogramar?/i,
    /reagendar?/i,
    /nova\s*data/i,
  ],
  add_item: [
    /adicionar?\s*(um|mais)?\s*item/i,
    /incluir?\s*(um|mais)?\s*item/i,
    /acrescentar?\s*(um|mais)?\s*item/i,
    /colocar?\s*mais/i,
    /quero?\s*mais/i,
  ],
  remove_item: [
    /remover?\s*(o|um)?\s*item/i,
    /tirar?\s*(o|um)?\s*item/i,
    /excluir?\s*(o|um)?\s*item/i,
    /retirar?\s*(o|um)?\s*item/i,
    /n[ãa]o\s*quero\s*(mais)?\s*(o|esse|este)/i,
  ],
  change_quantity: [
    /mudar?\s*(a)?\s*quantidade/i,
    /alterar?\s*(a)?\s*quantidade/i,
    /trocar?\s*(a)?\s*quantidade/i,
    /aumentar?\s*(a)?\s*quantidade/i,
    /diminuir?\s*(a)?\s*quantidade/i,
    /menos\s*unidades/i,
    /mais\s*unidades/i,
  ],
  cancel_order: [
    /cancelar?\s*(o)?\s*pedido/i,
    /desistir?\s*(do)?\s*pedido/i,
    /n[ãa]o\s*quero\s*mais\s*(o\s*pedido)?/i,
    /anular?\s*(o)?\s*pedido/i,
    /estornar?/i,
    /devolver?\s*tudo/i,
  ],
  change_contact: [
    /mudar?\s*(o)?\s*(telefone|contato|celular)/i,
    /alterar?\s*(o)?\s*(telefone|contato|celular)/i,
    /trocar?\s*(o)?\s*(telefone|contato|celular)/i,
    /novo\s*(telefone|contato|celular)/i,
    /ligar?\s*(para|pra)\s*outro\s*n[uú]mero/i,
  ],
  other: [
    /quero?\s*(fazer)?\s*(uma)?\s*altera[çc][ãa]o/i,
    /preciso?\s*mudar/i,
    /preciso?\s*alterar/i,
    /d[aá]\s*(pra|para)\s*mudar/i,
    /d[aá]\s*(pra|para)\s*alterar/i,
    /como\s*(fa[çc]o\s*para|posso)\s*mudar/i,
    /como\s*(fa[çc]o\s*para|posso)\s*alterar/i,
  ],
};

// Labels em português
export const changeTypeLabels: Record<ChangeRequestType, string> = {
  delivery_address: 'alteração de endereço de entrega',
  delivery_date: 'alteração de data de entrega',
  add_item: 'adição de item ao pedido',
  remove_item: 'remoção de item do pedido',
  change_quantity: 'alteração de quantidade',
  cancel_order: 'cancelamento de pedido',
  change_contact: 'alteração de contato',
  other: 'outra alteração',
};

/**
 * Detecta se a mensagem contém intenção de alteração
 */
export function detectChangeRequest(message: string): DetectedChange | null {
  const normalizedMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Verificar cada tipo de alteração
  for (const [type, patterns] of Object.entries(changePatterns) as [ChangeRequestType, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        // Tentar extrair valor solicitado (ex: nova data, novo endereço)
        const extractedValue = extractRequestedValue(message, type);
        
        return {
          type,
          confidence: type === 'other' ? 0.6 : 0.85,
          extractedValue,
        };
      }
    }
  }
  
  return null;
}

/**
 * Tenta extrair o valor solicitado da mensagem
 */
function extractRequestedValue(message: string, type: ChangeRequestType): string | undefined {
  switch (type) {
    case 'delivery_date': {
      // Tentar extrair data
      const datePatterns = [
        /dia\s*(\d{1,2})\s*(de)?\s*(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)?/i,
        /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
        /sexta|sábado|domingo|segunda|terça|quarta|quinta/i,
        /semana\s*que\s*vem/i,
        /próxima\s*semana/i,
      ];
      
      for (const pattern of datePatterns) {
        const match = message.match(pattern);
        if (match) {
          return match[0];
        }
      }
      break;
    }
    
    case 'delivery_address': {
      // Tentar extrair endereço após palavras-chave
      const afterKeyword = message.match(/(?:para|pra|no|na|em)\s*:?\s*(.{10,100})/i);
      if (afterKeyword) {
        return afterKeyword[1].trim();
      }
      break;
    }
    
    case 'change_quantity': {
      // Tentar extrair quantidade
      const quantityMatch = message.match(/(\d+)\s*(unidades?|itens?|peças?)/i);
      if (quantityMatch) {
        return quantityMatch[0];
      }
      break;
    }
  }
  
  return undefined;
}

/**
 * Verifica se a mensagem é uma confirmação de alteração
 */
export function isChangeConfirmation(message: string): boolean {
  const confirmationPatterns = [
    /^sim$/i,
    /^isso$/i,
    /^isso\s*mesmo$/i,
    /^confirm[ao]?$/i,
    /^pode\s*(ser|fazer)?$/i,
    /^ok$/i,
    /^certo$/i,
    /^correto$/i,
    /^exato$/i,
    /^[ée]\s*isso$/i,
  ];
  
  return confirmationPatterns.some(p => p.test(message.trim()));
}

/**
 * Verifica se a mensagem é uma negação de alteração
 */
export function isChangeCancellation(message: string): boolean {
  const cancellationPatterns = [
    /^n[ãa]o$/i,
    /^deixa\s*(pra\s*l[aá]|quieto)$/i,
    /^esquece$/i,
    /^cancela$/i,
    /^desisto$/i,
    /^mudei\s*de\s*ideia$/i,
    /^n[ãa]o\s*precisa$/i,
  ];
  
  return cancellationPatterns.some(p => p.test(message.trim()));
}

/**
 * Gera mensagem de confirmação para o tipo de alteração
 */
export function generateChangeConfirmationPrompt(type: ChangeRequestType, extractedValue?: string): string {
  const basePrompts: Record<ChangeRequestType, string> = {
    delivery_address: `Entendi que você quer alterar o *endereço de entrega*${extractedValue ? ` para: ${extractedValue}` : ''}.`,
    delivery_date: `Entendi que você quer alterar a *data de entrega*${extractedValue ? ` para: ${extractedValue}` : ''}.`,
    add_item: `Entendi que você quer *adicionar um item* ao pedido.`,
    remove_item: `Entendi que você quer *remover um item* do pedido.`,
    change_quantity: `Entendi que você quer *alterar a quantidade*${extractedValue ? ` para: ${extractedValue}` : ''}.`,
    cancel_order: `Entendi que você quer *cancelar o pedido*.`,
    change_contact: `Entendi que você quer *alterar o contato* para entrega.`,
    other: `Entendi que você quer fazer uma *alteração no pedido*.`,
  };
  
  return `${basePrompts[type]}

📝 Vou registrar sua solicitação para análise de um gestor, que entrará em contato em breve.

Pode me dar mais detalhes sobre o que precisa?`;
}
