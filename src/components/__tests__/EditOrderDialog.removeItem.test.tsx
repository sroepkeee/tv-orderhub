import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } } }))
    }
  }
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

interface OrderItem {
  id?: string;
  itemCode: string;
  itemDescription: string;
  requestedQuantity: number;
}

/**
 * Simula o hook de gerenciamento de itens do EditOrderDialog
 */
function useItemDeletionLogic(initialItems: OrderItem[]) {
  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [deletedItemIds, setDeletedItemIds] = useState<Set<string>>(new Set());

  const removeItem = (index: number) => {
    const itemToRemove = items[index];
    
    // Se o item tem ID (existe no banco), rastrear para exclusão explícita
    if (itemToRemove?.id) {
      setDeletedItemIds(prev => new Set([...prev, itemToRemove.id!]));
    }
    
    setItems(items.filter((_, i) => i !== index));
  };

  const resetDeletedIds = () => {
    setDeletedItemIds(new Set());
  };

  const filterItemsByDeletedIds = (dbItems: OrderItem[]): OrderItem[] => {
    return dbItems.filter(item => !item.id || !deletedItemIds.has(item.id));
  };

  return {
    items,
    setItems,
    deletedItemIds,
    removeItem,
    resetDeletedIds,
    filterItemsByDeletedIds
  };
}

describe('EditOrderDialog - Exclusão de Itens', () => {
  
  describe('removeItem()', () => {
    
    it('adiciona ID ao Set de exclusão quando item tem ID', () => {
      const initialItems: OrderItem[] = [
        { id: 'item-123', itemCode: 'ABC001', itemDescription: 'Item 1', requestedQuantity: 10 },
        { id: 'item-456', itemCode: 'ABC002', itemDescription: 'Item 2', requestedQuantity: 5 }
      ];

      const { result } = renderHook(() => useItemDeletionLogic(initialItems));

      // Remover primeiro item
      act(() => {
        result.current.removeItem(0);
      });

      // Verificar que o ID foi adicionado ao Set
      expect(result.current.deletedItemIds.has('item-123')).toBe(true);
      expect(result.current.deletedItemIds.size).toBe(1);
      
      // Verificar que item foi removido da lista
      expect(result.current.items.length).toBe(1);
      expect(result.current.items[0].id).toBe('item-456');
    });

    it('não afeta deletedItemIds quando item é novo (sem ID)', () => {
      const initialItems: OrderItem[] = [
        { id: 'item-123', itemCode: 'ABC001', itemDescription: 'Item 1', requestedQuantity: 10 },
        { itemCode: 'NEW001', itemDescription: 'Novo Item', requestedQuantity: 3 } // Sem ID
      ];

      const { result } = renderHook(() => useItemDeletionLogic(initialItems));

      // Remover item novo (índice 1)
      act(() => {
        result.current.removeItem(1);
      });

      // deletedItemIds deve estar vazio
      expect(result.current.deletedItemIds.size).toBe(0);
      
      // Item foi removido da lista
      expect(result.current.items.length).toBe(1);
    });

    it('acumula múltiplos IDs ao excluir vários itens', () => {
      const initialItems: OrderItem[] = [
        { id: 'item-1', itemCode: 'A', itemDescription: 'Item A', requestedQuantity: 1 },
        { id: 'item-2', itemCode: 'B', itemDescription: 'Item B', requestedQuantity: 2 },
        { id: 'item-3', itemCode: 'C', itemDescription: 'Item C', requestedQuantity: 3 }
      ];

      const { result } = renderHook(() => useItemDeletionLogic(initialItems));

      // Remover primeiro item (índice 0)
      act(() => {
        result.current.removeItem(0);
      });

      // Remover o novo primeiro item (era índice 1, agora é 0)
      act(() => {
        result.current.removeItem(0);
      });

      // Ambos IDs devem estar no Set
      expect(result.current.deletedItemIds.has('item-1')).toBe(true);
      expect(result.current.deletedItemIds.has('item-2')).toBe(true);
      expect(result.current.deletedItemIds.size).toBe(2);
      
      // Apenas 1 item restante
      expect(result.current.items.length).toBe(1);
      expect(result.current.items[0].id).toBe('item-3');
    });
  });

  describe('filterItemsByDeletedIds()', () => {
    
    it('filtra itens marcados para exclusão ao recarregar do banco', () => {
      const initialItems: OrderItem[] = [
        { id: 'item-A', itemCode: 'A', itemDescription: 'Item A', requestedQuantity: 1 }
      ];

      const { result } = renderHook(() => useItemDeletionLogic(initialItems));

      // Marcar item para exclusão
      act(() => {
        result.current.removeItem(0);
      });

      // Simular dados vindos do banco (com o item que foi excluído localmente)
      const dbItems: OrderItem[] = [
        { id: 'item-A', itemCode: 'A', itemDescription: 'Item A', requestedQuantity: 1 },
        { id: 'item-B', itemCode: 'B', itemDescription: 'Item B', requestedQuantity: 2 }
      ];

      // Filtrar usando a função
      const filtered = result.current.filterItemsByDeletedIds(dbItems);

      // Item-A deve ser filtrado
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('item-B');
    });

    it('permite itens novos (sem ID) mesmo com exclusões pendentes', () => {
      const initialItems: OrderItem[] = [
        { id: 'item-X', itemCode: 'X', itemDescription: 'Item X', requestedQuantity: 1 }
      ];

      const { result } = renderHook(() => useItemDeletionLogic(initialItems));

      // Marcar item para exclusão
      act(() => {
        result.current.removeItem(0);
      });

      // Simular dados vindos do banco (com item novo sem ID)
      const dbItems: OrderItem[] = [
        { id: 'item-X', itemCode: 'X', itemDescription: 'Item X', requestedQuantity: 1 },
        { itemCode: 'NEW', itemDescription: 'Novo', requestedQuantity: 5 } // Sem ID
      ];

      const filtered = result.current.filterItemsByDeletedIds(dbItems);

      // Item-X filtrado, novo item mantido
      expect(filtered.length).toBe(1);
      expect(filtered[0].itemCode).toBe('NEW');
    });
  });

  describe('resetDeletedIds()', () => {
    
    it('limpa o Set de IDs excluídos ao reabrir o diálogo', () => {
      const initialItems: OrderItem[] = [
        { id: 'item-1', itemCode: 'A', itemDescription: 'A', requestedQuantity: 1 },
        { id: 'item-2', itemCode: 'B', itemDescription: 'B', requestedQuantity: 2 }
      ];

      const { result } = renderHook(() => useItemDeletionLogic(initialItems));

      // Excluir itens
      act(() => {
        result.current.removeItem(0);
        result.current.removeItem(0);
      });

      expect(result.current.deletedItemIds.size).toBe(2);

      // Simular reabertura do diálogo
      act(() => {
        result.current.resetDeletedIds();
      });

      expect(result.current.deletedItemIds.size).toBe(0);
    });
  });

  describe('Integração com onSave', () => {
    
    it('deletedItemIds é convertido para array ao salvar', () => {
      const initialItems: OrderItem[] = [
        { id: 'item-abc', itemCode: 'ABC', itemDescription: 'ABC', requestedQuantity: 10 },
        { id: 'item-def', itemCode: 'DEF', itemDescription: 'DEF', requestedQuantity: 20 }
      ];

      const { result } = renderHook(() => useItemDeletionLogic(initialItems));

      // Excluir ambos os itens
      act(() => {
        result.current.removeItem(0);
        result.current.removeItem(0);
      });

      // Converter para array (como faria no onSubmit)
      const deletedArray = Array.from(result.current.deletedItemIds);

      expect(deletedArray).toContain('item-abc');
      expect(deletedArray).toContain('item-def');
      expect(deletedArray.length).toBe(2);
    });
  });
});
