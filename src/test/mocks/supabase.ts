import { vi } from 'vitest';

// Tipos para os mocks
export interface MockQueryResult<T> {
  data: T | null;
  error: Error | null;
}

export interface SupabaseMockConfig {
  roles?: string[];
  isApproved?: boolean | null;
  phasePermissions?: Array<{
    phase_key: string;
    can_view: boolean;
    can_edit: boolean;
    can_advance: boolean;
    can_delete: boolean;
  }>;
  menuPermissions?: Array<{
    menu_key: string;
    can_view: boolean;
  }>;
  shouldError?: boolean;
}

// Mock de usuário autenticado
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01',
};

export const mockSession = {
  access_token: 'mock-token',
  refresh_token: 'mock-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockUser,
};

// Cria mock do supabase client
export function createSupabaseMock(config: SupabaseMockConfig = {}) {
  const {
    roles = [],
    isApproved = null,
    phasePermissions = [],
    menuPermissions = [],
    shouldError = false,
  } = config;

  const error = shouldError ? new Error('Supabase error') : null;

  // Cria chainable query mock
  const createQueryChain = (tableName: string) => {
    const selectMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockImplementation((field: string, value: string) => {
      // Retorna dados baseado na tabela
      if (tableName === 'user_roles') {
        return Promise.resolve({
          data: roles.map(role => ({ role })),
          error,
        });
      }
      if (tableName === 'user_approval_status') {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: isApproved !== null ? { status: isApproved ? 'approved' : 'pending' } : null,
            error,
          }),
        };
      }
      if (tableName === 'user_phase_permissions') {
        return Promise.resolve({
          data: phasePermissions,
          error,
        });
      }
      if (tableName === 'menu_permissions') {
        return Promise.resolve({
          data: menuPermissions,
          error,
        });
      }
      return Promise.resolve({ data: null, error });
    });

    return {
      select: selectMock.mockReturnValue({ eq: eqMock }),
    };
  };

  // Mock do channel para real-time subscriptions
  const channelMock = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  };

  return {
    from: vi.fn((tableName: string) => createQueryChain(tableName)),
    channel: vi.fn().mockReturnValue(channelMock),
    removeChannel: vi.fn(),
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  };
}

// Helper para criar cenários de teste comuns
export const testScenarios = {
  adminUser: {
    roles: ['admin'],
    isApproved: true,
    phasePermissions: [],
    menuPermissions: [],
  },
  operatorUser: {
    roles: ['operator'],
    isApproved: true,
    phasePermissions: [
      { phase_key: 'analise', can_view: true, can_edit: true, can_advance: false, can_delete: false },
      { phase_key: 'producao', can_view: true, can_edit: false, can_advance: false, can_delete: false },
    ],
    menuPermissions: [
      { menu_key: 'admin', can_view: false },
      { menu_key: 'ai-agent', can_view: false },
    ],
  },
  pendingUser: {
    roles: ['user'],
    isApproved: false,
    phasePermissions: [],
    menuPermissions: [],
  },
  legacyUser: {
    roles: ['user'],
    isApproved: null, // Sem registro na tabela
    phasePermissions: [],
    menuPermissions: [],
  },
};
