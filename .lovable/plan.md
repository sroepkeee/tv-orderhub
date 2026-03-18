

## Plano: Alerta de Matéria-Prima (Placa de Circuito) + Corrigir Dias na Fase

### Problema 1: Dias na fase não aparecem (mostra "—")

**Causa raiz:** O `orderIds` muda de referência a cada render porque `orders.map(o => o.id)` cria um novo array. O `useMemo` depende de `orders` (referência do array), que muda sempre que `PriorityView` re-renderiza com `sortedOrders`. Isso causa o `orderIdsKey` a ser recalculado, mas o problema real é que a **query do React Query pode estar falhando silenciosamente** ou os dados retornados não correspondem aos IDs dos pedidos.

**Investigação adicional necessária:** Verificar se a query `fetchPhaseEntryDates` está retornando dados. Adicionar log temporário ou verificar se `order_history` tem registros para esses pedidos.

**Correção provável:** O `useDaysInPhase` busca `orders` e `order_history` em chunks de 50. Se a query falha silenciosamente (ex: RLS bloqueando), retorna `{}` e todos os cards mostram `null` → `...`. Preciso verificar se `order_history` tem RLS que impede a leitura. Vou:
1. Verificar as RLS policies de `order_history`
2. Se necessário, ajustar para permitir leitura por membros da organização
3. Adicionar fallback: se `order_history` não tem dados, usar `created_at` do pedido

### Problema 2: Alerta visual para itens MP (Matéria-Prima crua)

**Contexto:** Itens com `material_type = 'MP'` e descrições como "Placa de Circuito Impresso" são matéria-prima crua que não deve ser vendida/faturada pelo SSM. O sistema já tem `materialType` nos itens importados do TOTVS.

**Correção:**

**Arquivo: `src/components/ImportOrderDialog.tsx`** (na seção de preview, após linha ~610)
- Detectar itens com `materialType === 'MP'` OU descrição contendo palavras-chave como "placa de circuito", "circuito impresso", "PCB"
- Exibir um `Alert` amarelo/laranja destacado com ícone de aviso
- Mensagem: "⚠️ X item(ns) de Matéria-Prima (MP) detectado(s). Itens MP como Placas de Circuito não são vendidos/faturados pelo SSM. Verifique antes de importar."

**Arquivo: `src/components/OrderItemsReviewTable.tsx`**
- Destacar linhas de itens MP com fundo laranja claro
- Adicionar tooltip no badge MP explicando que precisa validação

**Arquivo: `src/components/EditOrderDialog.tsx`**
- Ao abrir um pedido com itens MP, exibir um banner de alerta similar

### Resumo de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ImportOrderDialog.tsx` | Alert para itens MP na preview de importação |
| `src/components/OrderItemsReviewTable.tsx` | Highlight visual em linhas de itens MP |
| `src/hooks/useDaysInPhase.tsx` | Adicionar log de debug + verificar se query retorna dados |
| RLS de `order_history` | Verificar e corrigir se necessário |

