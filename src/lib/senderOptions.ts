export interface SenderOption {
  id: string;
  name: string;
  shortName: string;
  cnpj: string;
  ie: string;
  address: string;
  cep: string;
  city: string;
  state: string;
  phone: string;
  fax: string;
  email: string;
  defaultBusinessArea: string;
}

export const SENDER_OPTIONS: SenderOption[] = [
  {
    id: '0101',
    name: 'IMPLY TECNOLOGIA ELETRÔNICA LTDA.',
    shortName: 'IMPLY TEC (RS)',
    cnpj: '05.681.400/0001-23',
    ie: '108/0136620',
    address: 'Rodovia Imply Tecnologia, 1111 (RST 287 KM 105), Bairro Renascença, Santa Cruz do Sul/RS, CEP 96815-911',
    cep: '96815-911',
    city: 'Santa Cruz do Sul',
    state: 'RS',
    phone: '(51) 2106-8000',
    fax: '(51) 2106-8001',
    email: 'imply@imply.com',
    defaultBusinessArea: 'ssm'
  },
  {
    id: '0201',
    name: 'IMPLY RENTAL LOCAÇÃO DE EQUIPAMENTOS E SERVIÇOS LTDA',
    shortName: 'IMPLY RENTAL',
    cnpj: '14.928.256/0001-78',
    ie: '108/0174505',
    address: 'Rodovia Imply Tecnologia, 1111 (RST 287 KM 105), Bairro Renascença, Santa Cruz do Sul/RS, CEP 96810-971',
    cep: '96810-971',
    city: 'Santa Cruz do Sul',
    state: 'RS',
    phone: '(51) 2106-8000',
    fax: '(51) 2106-8001',
    email: 'nfe@imply.com',
    defaultBusinessArea: 'ssm'
  }
];

export interface CostCenter {
  code: string;
  name: string;
  area: string;
}

export const COST_CENTERS: CostCenter[] = [
  // Customer Service / SSM
  { code: '138020001', name: 'Operações - Customer Service', area: 'ssm' },
  { code: '138010001', name: 'Projetos - Customer Service', area: 'projetos' },
  { code: '138040001', name: 'Pós Venda - Customer Service', area: 'ssm' },
  { code: '138050001', name: 'Retrabalho - Customer Service', area: 'ssm' },
  { code: '138030001', name: 'SSM - Customer Service', area: 'ssm' },
  
  // Diretorias
  { code: '132010001', name: 'Diretoria Indl', area: 'ssm' },
  { code: '112010001', name: 'Financeiro', area: 'ssm' },
  { code: '141010001', name: 'Diretoria P&D Fh', area: 'projetos' },
  { code: '121010001', name: 'Diretoria Coml Ceo', area: 'ssm' },
  { code: '124010001', name: 'Marketing', area: 'ssm' },
  { code: '122010001', name: 'Vendas Nacionais', area: 'ssm' },
  { code: '122020001', name: 'Vendas Internacionais', area: 'ssm' },
  { code: '141010003', name: 'Diretoria Tecnica P&D', area: 'projetos' },
  { code: '121010003', name: 'Diretoria Coml Matriz', area: 'ssm' },
  { code: '143010001', name: 'P&D Software', area: 'projetos' },
  { code: '139010001', name: 'Novos Negócios', area: 'ssm' },
  
  // Operações
  { code: '151010001', name: 'TI - Tecnologia Da Informação', area: 'ssm' },
  { code: '152010001', name: 'Sie', area: 'ssm' },
  { code: '131070001', name: 'Montagem', area: 'projetos' },
  { code: '133020001', name: 'Almoxarifado', area: 'ssm' },
];

export function deriveBusinessAreaFromOrder(senderCompany: string | undefined, costCenter: string | undefined): string {
  // 1. Se Centro de Custo contiver "SSM" → SSM
  if (costCenter?.toUpperCase().includes('SSM')) {
    return 'ssm';
  }
  
  // 2. Se Centro de Custo contiver "Projetos", P&D, Montagem → Projetos
  const upper = costCenter?.toUpperCase() || '';
  if (upper.includes('PROJETO') || upper.includes('P&D') || upper.includes('MONTAGEM')) {
    return 'projetos';
  }
  
  return 'ssm'; // Default
}

export function getSenderById(id: string | undefined): SenderOption | undefined {
  return SENDER_OPTIONS.find(s => s.id === id);
}

export function getSenderShortName(id: string | undefined): string {
  const sender = getSenderById(id);
  return sender?.shortName || '';
}
