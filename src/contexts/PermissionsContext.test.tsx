import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { PermissionsProvider, usePermissions, ALL_MENU_KEYS } from './PermissionsContext';
import { AuthContext } from './AuthContext';
import { createSupabaseMock, mockUser, mockSession, testScenarios, SupabaseMockConfig } from '@/test/mocks/supabase';

// Helper para waitFor com polling
async function waitFor(callback: () => void | Promise<void>, options?: { timeout?: number }) {
  const timeout = options?.timeout ?? 5000;
  const interval = 50;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await callback();
      return;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  await callback(); // Final attempt, will throw if fails
}

// Mock do módulo supabase
let supabaseMock: ReturnType<typeof createSupabaseMock>;

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return supabaseMock;
  },
}));

// Helper para criar wrapper com AuthContext mockado
function createWrapper(user: typeof mockUser | null = null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const authValue = {
      user,
      session: user ? mockSession : null,
      loading: false,
      signOut: vi.fn(),
    };

    return (
      <AuthContext.Provider value={authValue}>
        <PermissionsProvider>{children}</PermissionsProvider>
      </AuthContext.Provider>
    );
  };
}

// Helper para configurar mock do Supabase
function setupMock(config: SupabaseMockConfig = {}) {
  supabaseMock = createSupabaseMock(config);
}

describe('PermissionsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============= Estado Inicial =============

  describe('Estado Inicial', () => {
    it('retorna valores padrão quando usuário não está autenticado', async () => {
      setupMock();
      
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(null),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.userRoles).toEqual([]);
      expect(result.current.isApproved).toBeNull();
      expect(result.current.userPhasePermissions).toEqual([]);
    });

    it('loading é true durante carregamento inicial', async () => {
      setupMock({ roles: ['user'] });
      
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      // Inicialmente loading deve ser true
      expect(result.current.loading).toBe(true);

      // Espera carregar
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  // ============= Roles =============

  describe('Roles', () => {
    it('usuário com role admin tem isAdmin = true', async () => {
      setupMock(testScenarios.adminUser);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.hasRole('admin')).toBe(true);
      expect(result.current.hasFullAccess()).toBe(true);
    });

    it('usuário sem role admin tem isAdmin = false', async () => {
      setupMock(testScenarios.operatorUser);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.hasFullAccess()).toBe(false);
    });

    it('hasRole retorna true para roles que o usuário possui', async () => {
      setupMock({ roles: ['operator', 'supervisor'] });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRole('operator')).toBe(true);
      expect(result.current.hasRole('supervisor')).toBe(true);
      expect(result.current.hasRole('admin')).toBe(false);
      expect(result.current.hasRole('nonexistent')).toBe(false);
    });
  });

  // ============= Aprovação de Usuário =============

  describe('Aprovação de Usuário', () => {
    it('usuário aprovado tem isApproved = true', async () => {
      setupMock({ roles: ['user'], isApproved: true });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isApproved).toBe(true);
    });

    it('usuário pendente tem isApproved = false', async () => {
      setupMock(testScenarios.pendingUser);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isApproved).toBe(false);
    });

    it('usuário legado (sem registro) tem isApproved = true', async () => {
      setupMock(testScenarios.legacyUser);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Sem registro na tabela = usuário legado = aprovado
      expect(result.current.isApproved).toBe(true);
    });
  });

  // ============= Permissões de Fase - Admin =============

  describe('Permissões de Fase - Admin', () => {
    it('admin pode view/edit/advance/delete qualquer fase', async () => {
      setupMock(testScenarios.adminUser);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Admin tem acesso total a qualquer fase
      expect(result.current.canViewPhase('analise')).toBe(true);
      expect(result.current.canEditPhase('analise')).toBe(true);
      expect(result.current.canAdvancePhase('analise')).toBe(true);
      expect(result.current.canDeleteFromPhase('analise')).toBe(true);

      // Mesmo fases inexistentes
      expect(result.current.canViewPhase('fase_qualquer')).toBe(true);
      expect(result.current.canEditPhase('fase_qualquer')).toBe(true);
    });
  });

  // ============= Permissões de Fase - Usuário Normal =============

  describe('Permissões de Fase - Usuário Normal', () => {
    it('usuário só pode acessar fases com permissão explícita', async () => {
      setupMock(testScenarios.operatorUser);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Fase analise - pode ver e editar
      expect(result.current.canViewPhase('analise')).toBe(true);
      expect(result.current.canEditPhase('analise')).toBe(true);
      expect(result.current.canAdvancePhase('analise')).toBe(false);
      expect(result.current.canDeleteFromPhase('analise')).toBe(false);

      // Fase producao - só pode ver
      expect(result.current.canViewPhase('producao')).toBe(true);
      expect(result.current.canEditPhase('producao')).toBe(false);
      expect(result.current.canAdvancePhase('producao')).toBe(false);
    });

    it('retorna false para fases não configuradas', async () => {
      setupMock({
        roles: ['operator'],
        phasePermissions: [],
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canViewPhase('fase_inexistente')).toBe(false);
      expect(result.current.canEditPhase('fase_inexistente')).toBe(false);
      expect(result.current.canAdvancePhase('fase_inexistente')).toBe(false);
      expect(result.current.canDeleteFromPhase('fase_inexistente')).toBe(false);
    });
  });

  // ============= Permissões de Menu =============

  describe('Permissões de Menu', () => {
    it('admin vê todos os menus', async () => {
      setupMock(testScenarios.adminUser);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      ALL_MENU_KEYS.forEach(key => {
        expect(result.current.canViewMenu(key)).toBe(true);
      });
    });

    it('usuário só vê menus permitidos', async () => {
      setupMock(testScenarios.operatorUser);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Menus restritos
      expect(result.current.canViewMenu('admin')).toBe(false);
      expect(result.current.canViewMenu('ai-agent')).toBe(false);

      // Menus não configurados = visíveis por padrão
      expect(result.current.canViewMenu('kanban')).toBe(true);
      expect(result.current.canViewMenu('metrics')).toBe(true);
    });

    it('menus não configurados são visíveis por padrão', async () => {
      setupMock({
        roles: ['operator'],
        menuPermissions: [], // Nenhuma configuração
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Sem configuração = tudo visível
      expect(result.current.canViewMenu('kanban')).toBe(true);
      expect(result.current.canViewMenu('metrics')).toBe(true);
      expect(result.current.canViewMenu('admin')).toBe(true);
    });
  });

  // ============= Tratamento de Erros =============

  describe('Tratamento de Erros', () => {
    it('em caso de erro, permite todos os menus como fallback', async () => {
      setupMock({ shouldError: true });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockUser),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Fallback: todos os menus visíveis
      ALL_MENU_KEYS.forEach(key => {
        expect(result.current.canViewMenu(key)).toBe(true);
      });
    });
  });

  // ============= usePermissions fora do Provider =============

  describe('usePermissions fora do Provider', () => {
    it('lança erro quando usado fora do PermissionsProvider', () => {
      // Wrapper sem PermissionsProvider
      const WrapperWithoutProvider = ({ children }: { children: ReactNode }) => (
        <AuthContext.Provider value={{ user: null, session: null, loading: false, signOut: vi.fn() }}>
          {children}
        </AuthContext.Provider>
      );

      expect(() => {
        renderHook(() => usePermissions(), {
          wrapper: WrapperWithoutProvider,
        });
      }).toThrow('usePermissions must be used within a PermissionsProvider');
    });
  });
});
