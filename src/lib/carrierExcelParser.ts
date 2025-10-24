import * as XLSX from 'xlsx';
import type { CarrierContact } from '@/types/carriers';

export interface ParsedCarrierData {
  name: string;
  cnpj?: string;
  email?: string;
  quote_email?: string;
  collection_email?: string;
  whatsapp?: string;
  phone?: string;
  contact_person?: string;
  contact_position?: string;
  additional_contacts: CarrierContact[];
  service_states: string[];
  coverage_notes?: string;
  notes?: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ParsedCarrierWithValidation extends ParsedCarrierData {
  rowIndex: number;
  validationIssues: ValidationIssue[];
  isValid: boolean;
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// Suggested headers - não obrigatórios, apenas recomendados
const SUGGESTED_HEADERS = [
  'nome_transportadora',
  'email_principal',
  'contato_principal',
  'estados_atendidos'
];

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function normalizeCNPJ(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

function parseStates(statesStr: string): string[] {
  if (!statesStr) return [];
  
  // Split by comma, space, semicolon, or pipe
  const states = statesStr
    .split(/[,;\s|]+/)
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 0);
  
  return states;
}

function validateStates(states: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const invalidStates = states.filter(s => !BRAZILIAN_STATES.includes(s));
  
  if (invalidStates.length > 0) {
    issues.push({
      field: 'estados_atendidos',
      message: `Estados inválidos: ${invalidStates.join(', ')}`,
      severity: 'error'
    });
  }
  
  return issues;
}

function extractAdditionalContacts(row: any): CarrierContact[] {
  const contacts: CarrierContact[] = [];
  
  for (let i = 2; i <= 5; i++) {
    const name = String(row[`contato_${i}_nome`] || '').trim();
    const phone = String(row[`contato_${i}_telefone`] || '').trim();
    const role = String(row[`contato_${i}_cargo`] || '').trim();
    
    if (name && phone) {
      contacts.push({
        name,
        phone: normalizePhone(phone),
        role: role || 'Contato'
      });
    }
  }
  
  return contacts;
}

function validateCarrierData(data: ParsedCarrierData, rowIndex: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // ÚNICO CAMPO OBRIGATÓRIO: nome da transportadora
  if (!data.name || data.name.length < 3) {
    issues.push({
      field: 'nome_transportadora',
      message: 'Nome deve ter pelo menos 3 caracteres',
      severity: 'error'
    });
  }
  
  // AVISOS (não bloqueiam importação) para campos recomendados vazios
  if (!data.email) {
    issues.push({
      field: 'email_principal',
      message: 'Email principal não informado - recomendado completar após importação',
      severity: 'warning'
    });
  } else if (!validateEmail(data.email)) {
    issues.push({
      field: 'email_principal',
      message: 'Email principal inválido',
      severity: 'warning'
    });
  }
  
  if (!data.contact_person || data.contact_person.length < 3) {
    issues.push({
      field: 'contato_principal',
      message: 'Nome do contato não informado - recomendado completar após importação',
      severity: 'warning'
    });
  }
  
  if (!data.service_states || data.service_states.length === 0) {
    issues.push({
      field: 'estados_atendidos',
      message: 'Nenhum estado informado - recomendado completar após importação',
      severity: 'warning'
    });
  } else {
    // Validar estados apenas se foram informados
    const stateIssues = validateStates(data.service_states);
    // Converter erros de estados inválidos para warnings
    stateIssues.forEach(issue => {
      issues.push({ ...issue, severity: 'warning' });
    });
  }
  
  // Optional email validations
  if (data.quote_email && !validateEmail(data.quote_email)) {
    issues.push({
      field: 'email_cotacao',
      message: 'Email de cotação inválido',
      severity: 'warning'
    });
  }
  
  if (data.collection_email && !validateEmail(data.collection_email)) {
    issues.push({
      field: 'email_coleta',
      message: 'Email de coleta inválido',
      severity: 'warning'
    });
  }
  
  // CNPJ validation (if provided)
  if (data.cnpj) {
    const cnpjNumbers = normalizeCNPJ(data.cnpj);
    if (cnpjNumbers.length !== 14) {
      issues.push({
        field: 'cnpj',
        message: 'CNPJ deve ter 14 dígitos',
        severity: 'warning'
      });
    }
  }
  
  // Generic email warning
  if (data.email && (data.email.includes('@gmail') || data.email.includes('@hotmail') || data.email.includes('@outlook'))) {
    issues.push({
      field: 'email_principal',
      message: 'Email pessoal detectado - considere usar email corporativo',
      severity: 'warning'
    });
  }
  
  return issues;
}

export async function parseCarrierExcel(file: File): Promise<ParsedCarrierWithValidation[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Try to find the "DADOS" sheet, or use the first sheet
        let sheetName = workbook.SheetNames.find(name => 
          name.toUpperCase().includes('DADOS') || name.toUpperCase().includes('DATA')
        ) || workbook.SheetNames[0];
        
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { 
          raw: false,
          defval: ''
        }) as any[];
        
        if (jsonData.length === 0) {
          throw new Error('A planilha está vazia ou não contém dados válidos');
        }
        
        // Check for suggested headers (não bloqueia, apenas avisa)
        const firstRow = jsonData[0];
        const headers = Object.keys(firstRow).map(h => h.toLowerCase().trim());
        const missingHeaders = SUGGESTED_HEADERS.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          console.warn(`Colunas sugeridas não encontradas: ${missingHeaders.join(', ')}`);
        }
        
        // Parse each row
        const carriers: ParsedCarrierWithValidation[] = jsonData.map((row, index) => {
          const states = parseStates(String(row.estados_atendidos || ''));
          
          const emailPrincipal = row.email_principal ? String(row.email_principal).trim().toLowerCase() : undefined;
          const emailCotacao = row.email_cotacao ? String(row.email_cotacao).trim().toLowerCase() : undefined;
          
          const parsedData: ParsedCarrierData = {
            name: String(row.nome_transportadora || '').trim(),
            cnpj: row.cnpj ? normalizeCNPJ(String(row.cnpj)) : undefined,
            email: emailPrincipal || emailCotacao, // Usa email_cotacao como fallback se email_principal estiver vazio
            quote_email: emailCotacao,
            collection_email: row.email_coleta ? String(row.email_coleta).trim().toLowerCase() : undefined,
            whatsapp: row.whatsapp ? normalizePhone(String(row.whatsapp)) : undefined,
            phone: row.telefone ? normalizePhone(String(row.telefone)) : undefined,
            contact_person: row.contato_principal ? String(row.contato_principal).trim() : undefined,
            contact_position: row.cargo_contato ? String(row.cargo_contato).trim() : undefined,
            additional_contacts: extractAdditionalContacts(row),
            service_states: states.filter(s => BRAZILIAN_STATES.includes(s)),
            coverage_notes: row.observacoes_cobertura ? String(row.observacoes_cobertura).trim() : undefined,
            notes: row.notas_gerais ? String(row.notas_gerais).trim() : undefined
          };
          
          const validationIssues = validateCarrierData(parsedData, index + 2);
          
          return {
            ...parsedData,
            rowIndex: index + 2, // +2 because Excel is 1-indexed and we skip header
            validationIssues,
            isValid: validationIssues.filter(i => i.severity === 'error').length === 0
          };
        });
        
        resolve(carriers);
      } catch (error: any) {
        reject(new Error(`Erro ao processar Excel: ${error.message}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}
