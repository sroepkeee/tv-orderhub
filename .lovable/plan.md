
## Plano: Corrigir Erro de Foreign Key na Exclusão de Itens

### Problema Identificado

O erro `foreign key constraint "purchase_request_items_order_item_id_fkey"` ocorre porque:

1. Um `order_item` (ex: item 034275) está referenciado na tabela `purchase_request_items`
2. Quando tentamos deletar o `order_item`, o banco de dados impede porque há registros dependentes
3. A constraint está configurada como `NO ACTION` - não permite exclusão automática

### Tabelas com Foreign Keys para `order_items`

| Tabela | Constraint | Delete Action |
|--------|-----------|---------------|
| `purchase_request_items` | order_item_id_fkey | NO ACTION ❌ |
| `technician_dispatch_items` | order_item_id_fkey | NO ACTION ❌ |
| `return_request_items` | order_item_id_fkey | NO ACTION ❌ |
| `delivery_date_changes` | order_item_id_fkey | CASCADE ✅ |
| `order_item_history` | order_item_id_fkey | CASCADE ✅ |
| `stock_movements` | order_item_id_fkey | CASCADE ✅ |
| `lab_item_work` | order_item_id_fkey | CASCADE ✅ |

### Solução Proposta

Antes de deletar `order_items`, remover as referências nas tabelas dependentes:

```text
┌─────────────────────────────────────────────────────────────────┐
│ ANTES DE DELETAR order_items:                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SET NULL em purchase_request_items.order_item_id            │
│  2. SET NULL em technician_dispatch_items.order_item_id         │
│  3. SET NULL em return_request_items.order_item_id              │
│  4. Então deletar order_items (dependências CASCADE são auto)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> **Nota**: Usamos SET NULL ao invés de DELETE porque os registros de compras/despachos/devoluções ainda têm valor histórico - só removemos o vínculo com o item excluído.

---

### Alteração: `src/components/Dashboard.tsx`

**Arquivo:** `src/components/Dashboard.tsx`  
**Linhas:** ~1613-1623

Adicionar limpeza de dependências antes da exclusão:

```typescript
if (allItemsToDelete.length > 0) {
  console.log('🗑️ [handleEditOrder] Deletando itens:', {
    explicitDeletes,
    implicitDeletes,
    allItemsToDelete
  });
  
  // ✨ NOVO: Limpar referências de foreign keys antes de deletar
  // SET NULL para preservar histórico de compras/despachos/devoluções
  await supabase
    .from('purchase_request_items')
    .update({ order_item_id: null })
    .in('order_item_id', allItemsToDelete);
    
  await supabase
    .from('technician_dispatch_items')
    .update({ order_item_id: null })
    .in('order_item_id', allItemsToDelete);
    
  await supabase
    .from('return_request_items')
    .update({ order_item_id: null })
    .in('order_item_id', allItemsToDelete);
  
  // Agora pode deletar os itens com segurança
  const { error: deleteError } = await supabase
    .from('order_items')
    .delete()
    .in('id', allItemsToDelete);
    
  if (deleteError) throw deleteError;
}
```

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/Dashboard.tsx` | Adicionar 3 operações `UPDATE SET NULL` antes do `DELETE` |

---

### Benefícios

1. **Elimina erro de foreign key** - Referências são limpas antes da exclusão
2. **Preserva histórico** - Registros de compras/despachos/devoluções continuam existindo
3. **Consistente** - Mesma abordagem usada na exclusão de pedido inteiro
4. **Sem impacto em performance** - Operações UPDATE são rápidas com índices
