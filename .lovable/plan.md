

## Diagnóstico: Bug na Exclusão de Itens do Pedido

### Problema Identificado

O usuário está enfrentando um bug onde ao excluir um item do pedido:
1. O item desaparece visualmente
2. Aparece toast "Item removido. Clique em Salvar para confirmar."
3. Após clicar em "Salvar Alterações", o item reaparece ao reabrir o pedido

**Causa Raiz:** Race condition entre o real-time subscription e o fluxo de salvamento

```text
┌─────────────────────────────────────────────────────────────────┐
│ FLUXO ATUAL (COM BUG)                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuário clica em excluir item                               │
│     └─> removeItem() atualiza estado local                      │
│     └─> Item some da tela                                       │
│                                                                 │
│  2. Enquanto isso, outro evento real-time chega                 │
│     └─> ignoreNextRealtimeUpdateRef = false (nunca foi ativo!)  │
│     └─> loadItems() é chamado                                   │
│     └─> Itens são recarregados do banco (COM o item excluído)   │
│     └─> O item "volta" para a lista local                       │
│                                                                 │
│  3. Usuário clica "Salvar Alterações"                           │
│     └─> Dashboard.tsx compara items locais vs banco             │
│     └─> Mas o item já está de volta na lista local!             │
│     └─> Nenhum item é identificado para deletar                 │
│                                                                 │
│  4. Pedido é salvo SEM excluir o item                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Solução: Rastrear IDs Excluídos Explicitamente

Em vez de depender apenas da comparação de listas, vamos rastrear explicitamente os IDs dos itens marcados para exclusão:

```text
┌─────────────────────────────────────────────────────────────────┐
│ FLUXO CORRIGIDO                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuário clica em excluir item                               │
│     └─> removeItem() atualiza estado local                      │
│     └─> ID do item é adicionado ao Set "deletedItemIds"         │
│     └─> Item some da tela                                       │
│                                                                 │
│  2. Se evento real-time chegar...                               │
│     └─> loadItems() recarrega do banco                          │
│     └─> MAS filtra itens cujos IDs estão em "deletedItemIds"    │
│     └─> Item excluído NÃO volta para a lista                    │
│                                                                 │
│  3. Usuário clica "Salvar Alterações"                           │
│     └─> Dashboard.tsx recebe "deletedItemIds" como parâmetro    │
│     └─> Deleta explicitamente os IDs marcados                   │
│     └─> Limpa o Set após sucesso                                │
│                                                                 │
│  4. Pedido é salvo COM exclusão garantida                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Alterações Necessárias

#### 1. EditOrderDialog.tsx - Rastrear IDs Excluídos

Adicionar state para rastrear IDs de itens marcados para exclusão:

```typescript
// Novo state para rastrear itens excluídos
const [deletedItemIds, setDeletedItemIds] = useState<Set<string>>(new Set());
```

Modificar `removeItem()`:
```typescript
const removeItem = (index: number) => {
  const itemToRemove = items[index];
  
  // Se o item tem ID (existe no banco), rastrear para exclusão
  if (itemToRemove?.id) {
    setDeletedItemIds(prev => new Set([...prev, itemToRemove.id!]));
  }
  
  setItems(items.filter((_, i) => i !== index));
  toast({
    title: "Item removido",
    description: `${itemToRemove?.itemCode || 'Item'} marcado para exclusão.`,
  });
};
```

Modificar `loadItems()` para filtrar itens excluídos:
```typescript
const loadItems = async () => {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id);
  
  if (data) {
    // Filtrar itens que foram marcados para exclusão localmente
    const filteredData = data.filter(item => !deletedItemIds.has(item.id));
    setItems(mapDbItemsToOrderItems(filteredData));
  }
};
```

Passar `deletedItemIds` para o callback `onSave`:
```typescript
onSave({
  ...updatedOrder,
  deletedItemIds: Array.from(deletedItemIds)
});
```

Limpar `deletedItemIds` ao abrir diálogo:
```typescript
useEffect(() => {
  if (open) {
    setDeletedItemIds(new Set()); // Reset ao abrir
  }
}, [open]);
```

---

#### 2. Dashboard.tsx - Usar IDs Explícitos para Exclusão

Modificar `handleEditOrder()` para usar os IDs rastreados:

```typescript
const handleEditOrder = async (updatedOrder: Order & { deletedItemIds?: string[] }) => {
  // ...existing code...
  
  // Deletar itens usando IDs explícitos (mais confiável)
  const idsToDelete = updatedOrder.deletedItemIds || [];
  
  // Também identificar itens removidos da lista (backup)
  const existingItemIds = new Set((existingItems || []).map(item => item.id));
  const currentItemIds = new Set(updatedOrder.items.filter(item => item.id).map(item => item.id));
  const implicitDeletes = [...existingItemIds].filter(id => !currentItemIds.has(id));
  
  // Combinar ambas as listas (explícita + implícita)
  const allItemsToDelete = [...new Set([...idsToDelete, ...implicitDeletes])];
  
  if (allItemsToDelete.length > 0) {
    console.log('🗑️ Deletando itens:', allItemsToDelete);
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .in('id', allItemsToDelete);
    
    if (deleteError) throw deleteError;
  }
};
```

---

#### 3. Testes Unitários

Criar arquivo de testes para validar o fluxo de exclusão:

**Arquivo:** `src/components/__tests__/EditOrderDialog.removeItem.test.tsx`

```typescript
describe('EditOrderDialog - Exclusão de Itens', () => {
  
  it('removeItem() adiciona ID ao Set de exclusão', () => {
    // Simular item com ID existente
    // Chamar removeItem(index)
    // Verificar que deletedItemIds contém o ID
  });
  
  it('removeItem() para item novo (sem ID) não afeta deletedItemIds', () => {
    // Simular item sem ID (novo)
    // Chamar removeItem(index)
    // Verificar que deletedItemIds permanece vazio
  });
  
  it('loadItems() filtra itens marcados para exclusão', async () => {
    // Mockar supabase.from().select() retornando 3 itens
    // Definir deletedItemIds com 1 ID
    // Verificar que items tem apenas 2 itens
  });
  
  it('onSave recebe deletedItemIds no payload', async () => {
    // Mockar removeItem() para 2 itens
    // Simular submit
    // Verificar que onSave foi chamado com deletedItemIds: ['id1', 'id2']
  });
  
  it('deletedItemIds é limpo ao reabrir diálogo', () => {
    // Simular removeItem()
    // Fechar diálogo
    // Reabrir diálogo
    // Verificar que deletedItemIds está vazio
  });
  
});
```

**Arquivo:** `src/components/__tests__/Dashboard.handleEditOrder.test.tsx`

```typescript
describe('Dashboard - handleEditOrder Exclusão', () => {
  
  it('deleta itens usando deletedItemIds explícito', async () => {
    // Mockar supabase.delete()
    // Chamar handleEditOrder com deletedItemIds: ['item-123']
    // Verificar que delete().in() foi chamado com ['item-123']
  });
  
  it('combina deletedItemIds com itens removidos implicitamente', async () => {
    // Cenário: item foi removido da lista MAS não está em deletedItemIds
    // (fallback para compatibilidade)
    // Verificar que ambos são deletados
  });
  
  it('mostra toast de sucesso após exclusão', async () => {
    // Chamar handleEditOrder com exclusões
    // Verificar toast "Pedido atualizado"
  });
  
});
```

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/EditOrderDialog.tsx` | Adicionar state `deletedItemIds`, modificar `removeItem()`, `loadItems()`, e `onSubmit()` |
| `src/components/Dashboard.tsx` | Modificar `handleEditOrder()` para usar `deletedItemIds` explícito |
| `src/components/__tests__/EditOrderDialog.removeItem.test.tsx` | Novo arquivo de testes |
| `src/components/__tests__/Dashboard.handleEditOrder.test.tsx` | Novo arquivo de testes |

---

### Benefícios da Solução

1. **Confiabilidade** - IDs explícitos garantem exclusão mesmo com race conditions
2. **Resiliência ao Real-time** - Itens excluídos não "voltam" mesmo após loadItems()
3. **Fallback** - Mantém lógica de comparação implícita como backup
4. **Testável** - Lógica isolada facilita testes unitários
5. **Logging** - Adiciona console.log para facilitar debug em produção

