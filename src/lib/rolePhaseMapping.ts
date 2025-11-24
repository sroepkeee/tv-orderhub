export interface PhaseAccess {
  phases: string[];
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export const ROLE_PHASE_MAPPING: Record<string, PhaseAccess> = {
  // Admin vê e edita tudo
  admin: {
    phases: ['almox_ssm', 'order_generation', 'almox_general', 'production', 
             'balance_generation', 'laboratory', 'packaging', 
             'freight_quote', 'invoicing', 
             'logistics', 'in_transit', 'completion'],
    canView: true,
    canEdit: true,
    canDelete: true
  },
  
  // Cada role vê e edita apenas sua própria fase
  almox_ssm: {
    phases: ['almox_ssm'],
    canView: true,
    canEdit: true,
    canDelete: false
  },
  
  order_generation: {
    phases: ['order_generation'],
    canView: true,
    canEdit: true,
    canDelete: false
  },
  
  almox_general: {
    phases: ['almox_general'],
    canView: true,
    canEdit: true,
    canDelete: false
  },
  
  production: {
    phases: ['production'],
    canView: true,
    canEdit: true,
    canDelete: false
  },
  
  balance_generation: {
    phases: ['balance_generation'],
    canView: true,
    canEdit: true,
    canDelete: false
  },
  
  laboratory: {
    phases: ['laboratory'],
    canView: true,
    canEdit: true,
    canDelete: false
  },
  
  packaging: {
    phases: ['packaging'],
    canView: true,
    canEdit: true,
    canDelete: false
  },
  
  freight_quote: {
    phases: ['freight_quote'],
    canView: true,
    canEdit: true,
    canDelete: false
  },
  
  invoicing: {
    phases: ['invoicing'],
    canView: true,
    canEdit: true,
    canDelete: false
  },
  
  logistics: {
    phases: ['logistics', 'in_transit'],
    canView: true,
    canEdit: true,
    canDelete: false
  },
  
  completion: {
    phases: ['completion'],
    canView: true,
    canEdit: true,
    canDelete: false
  }
};

// Função helper para obter todas as fases que um usuário pode ver baseado em suas roles
export const getPhasesForRoles = (roles: string[]): string[] => {
  const phases = new Set<string>();
  
  roles.forEach(role => {
    const mapping = ROLE_PHASE_MAPPING[role];
    if (mapping) {
      mapping.phases.forEach(phase => phases.add(phase));
    }
  });
  
  return Array.from(phases);
};

// Função helper para verificar se uma role pode visualizar uma fase
export const canRoleViewPhase = (role: string, phase: string): boolean => {
  const mapping = ROLE_PHASE_MAPPING[role];
  return mapping ? mapping.phases.includes(phase) && mapping.canView : false;
};

// Função helper para verificar se uma role pode editar uma fase
export const canRoleEditPhase = (role: string, phase: string): boolean => {
  const mapping = ROLE_PHASE_MAPPING[role];
  return mapping ? mapping.phases.includes(phase) && mapping.canEdit : false;
};

// Função helper para verificar se uma role pode deletar de uma fase
export const canRoleDeletePhase = (role: string, phase: string): boolean => {
  const mapping = ROLE_PHASE_MAPPING[role];
  return mapping ? mapping.phases.includes(phase) && mapping.canDelete : false;
};
