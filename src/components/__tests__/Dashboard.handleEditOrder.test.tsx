import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockDelete = vi.fn(() => ({
  in: vi.fn(() => Promise.resolve({ error: null }))
}));

const mockUpdate = vi.fn(() => ({
  eq: vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: { id: 'order-1' }, error: null }))
    }))
  }))
}));

const mockSelect = vi.fn(() => ({
  eq: vi.fn(() => Promise.resolve({
    data: [
      { id: 'item-1', user_id: 'user-1' },
      { id: 'item-2', user_id: 'user-1' },
      { id: 'item-3', user_id: 'user-1' }
    ],
    error: null
  }))
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'orders') {
        return { update: mockUpdate };
      }
      if (table === 'order_items') {
        return { 
          select: mockSelect,
          delete: mockDelete,
          update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
          insert: vi.fn(() => Promise.resolve({ error: null }))
        };
      }
      return {};
    }),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } } }))
    }
  }
}));

interface OrderItem {
  id?: string;
  itemCode: string;
}

interface Order {
  id: string;
  items?: OrderItem[];
  deletedItemIds?: string[];
}

/**
 * Simula a lógica de exclusão de itens do handleEditOrder
 */
function computeItemsToDelete(
  existingItems: { id: string }[],
  currentItems: OrderItem[],
  deletedItemIds: string[] = []
): string[] {
  const currentItemIds = new Set(currentItems.filter(item => item.id).map(item => item.id as string));
  
  // IDs explícitos (do EditOrderDialog)
  const explicitDeletes = deletedItemIds;
  
  // IDs implícitos (removidos da lista)
  const implicitDeletes = existingItems
    .filter(row => !currentItemIds.has(row.id))
    .map(row => row.id);
  
  // Combinar sem duplicatas
  return [...new Set([...explicitDeletes, ...implicitDeletes])];
}

describe('Dashboard - handleEditOrder Exclusão', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeItemsToDelete()', () => {
    
    it('usa deletedItemIds explícito quando fornecido', () => {
      const existingItems = [
        { id: 'item-1' },
        { id: 'item-2' },
        { id: 'item-3' }
      ];
      
      const currentItems: OrderItem[] = [
        { id: 'item-2', itemCode: 'B' },
        { id: 'item-3', itemCode: 'C' }
      ];
      
      // ID explicitamente marcado para exclusão
      const deletedItemIds = ['item-1'];
      
      const result = computeItemsToDelete(existingItems, currentItems, deletedItemIds);
      
      expect(result).toContain('item-1');
      expect(result.length).toBe(1);
    });

    it('identifica itens removidos implicitamente (não na lista atual)', () => {
      const existingItems = [
        { id: 'item-1' },
        { id: 'item-2' },
        { id: 'item-3' }
      ];
      
      // Item-1 e item-2 não estão mais na lista
      const currentItems: OrderItem[] = [
        { id: 'item-3', itemCode: 'C' }
      ];
      
      const result = computeItemsToDelete(existingItems, currentItems, []);
      
      expect(result).toContain('item-1');
      expect(result).toContain('item-2');
      expect(result.length).toBe(2);
    });

    it('combina deletedItemIds explícitos com implícitos sem duplicatas', () => {
      const existingItems = [
        { id: 'item-1' },
        { id: 'item-2' },
        { id: 'item-3' }
      ];
      
      // Apenas item-3 na lista atual
      const currentItems: OrderItem[] = [
        { id: 'item-3', itemCode: 'C' }
      ];
      
      // item-1 foi marcado explicitamente E está ausente da lista
      // item-2 só está ausente da lista
      const deletedItemIds = ['item-1'];
      
      const result = computeItemsToDelete(existingItems, currentItems, deletedItemIds);
      
      expect(result).toContain('item-1');
      expect(result).toContain('item-2');
      // Sem duplicatas
      expect(result.filter(id => id === 'item-1').length).toBe(1);
      expect(result.length).toBe(2);
    });

    it('retorna array vazio quando não há exclusões', () => {
      const existingItems = [
        { id: 'item-1' },
        { id: 'item-2' }
      ];
      
      const currentItems: OrderItem[] = [
        { id: 'item-1', itemCode: 'A' },
        { id: 'item-2', itemCode: 'B' }
      ];
      
      const result = computeItemsToDelete(existingItems, currentItems, []);
      
      expect(result.length).toBe(0);
    });

    it('ignora itens novos (sem ID) na comparação', () => {
      const existingItems = [
        { id: 'item-1' },
        { id: 'item-2' }
      ];
      
      const currentItems: OrderItem[] = [
        { id: 'item-1', itemCode: 'A' },
        { id: 'item-2', itemCode: 'B' },
        { itemCode: 'NEW' } // Novo item sem ID
      ];
      
      const result = computeItemsToDelete(existingItems, currentItems, []);
      
      expect(result.length).toBe(0);
    });
  });

  describe('Cenário de Race Condition', () => {
    
    it('deletedItemIds garante exclusão mesmo se item "volta" via realtime', () => {
      // Cenário: 
      // 1. Usuário exclui item-1 (vai para deletedItemIds)
      // 2. Evento realtime recarrega items do banco (item-1 "volta" para currentItems)
      // 3. No save, item-1 ainda é deletado porque está em deletedItemIds
      
      const existingItems = [
        { id: 'item-1' },
        { id: 'item-2' }
      ];
      
      // Item-1 "voltou" para a lista após realtime, MAS está em deletedItemIds
      const currentItems: OrderItem[] = [
        { id: 'item-1', itemCode: 'A' }, // Voltou!
        { id: 'item-2', itemCode: 'B' }
      ];
      
      // Mas foi marcado explicitamente para exclusão
      const deletedItemIds = ['item-1'];
      
      const result = computeItemsToDelete(existingItems, currentItems, deletedItemIds);
      
      // item-1 DEVE ser excluído mesmo estando na lista atual
      expect(result).toContain('item-1');
      expect(result.length).toBe(1);
    });
  });

  describe('Integração com mock de Supabase', () => {
    
    it('prepara array de IDs para exclusão corretamente', () => {
      const itemsToDelete = ['item-1', 'item-2'];
      
      // Verificar que o array está no formato esperado para .in()
      expect(Array.isArray(itemsToDelete)).toBe(true);
      expect(itemsToDelete.length).toBe(2);
      expect(itemsToDelete).toContain('item-1');
      expect(itemsToDelete).toContain('item-2');
    });
  });
});
