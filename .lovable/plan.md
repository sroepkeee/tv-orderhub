

## Plano: Corrigir Dias na Fase no Primeiro Acesso + Salvamento de OC/OP

### Problema 1: Dias na fase não aparecem no primeiro acesso

**Causa raiz:** O `useDaysInPhase` usa `orderIds` derivado de `optimisticOrders`. No primeiro render, `optimisticOrders` começa vazio (state inicial), depois é preenchido via `useEffect` quando `orders` chega. Porém, o `orderIdsKey` (JSON.stringify dos IDs ordenados) muda de `"[]"` para os IDs reais, disparando a query. O problema é que o `useMemo` em `orderIds` depende de `optimisticOrders`, que é sincronizado com `orders` via `useEffect` — criando um ciclo extra de render antes da query ser habilitada.

Quando o usuário troca a visualização e volta, o cache do React Query já tem os dados, então aparece instantaneamente.

**Correção:** Usar `orders` diretamente (prop) para derivar `orderIds` em vez de `optimisticOrders`. O `optimisticOrders` é para drag-and-drop visual e não deveria atrasar a query de dias.

**Arquivo:** `src/components/KanbanView.tsx` (linha 96)

```
// ANTES:
const orderIds = React.useMemo(() => optimisticOrders.map(o => o.id), [optimisticOrders]);

// DEPOIS:
const orderIds = React.useMemo(() => orders.map(o => o.id), [orders]);
```

---

### Problema 2: OC/OP não salva na linha do item

**Causa raiz:** No `EditOrderDialog.tsx`, quando o usuário altera o campo `production_order_number`, o código na linha 1131 diz explicitamente:

```
// Atualizar apenas o estado local para production_order_number
// O salvamento será feito quando clicar em "Salvar Alterações"
```

O valor é salvo **apenas no state local**. Porém, há uma subscription realtime em `order_items` (linha 957-970) que recarrega os itens do banco quando **outro usuário** faz qualquer alteração. Quando isso acontece, o `loadItems()` sobrescreve o state local com os dados do banco — **apagando o valor de OC/OP que o usuário digitou mas ainda não salvou**.

Fluxo do bug:
1. Jeferson digita "OP-1234" no campo
2. Edson (ou qualquer outro) altera um item no mesmo pedido
3. Realtime dispara `loadItems()` → sobrescreve state com dados do banco
4. O valor "OP-1234" desaparece do state local
5. Jeferson clica "Salvar" → salva o valor vazio/antigo do banco

**Correção:** Alterar `production_order_number` para salvar imediatamente no banco (igual a `item_status`, `warehouse`, etc.), em vez de acumular no state local. Isso elimina a janela de perda de dados.

**Arquivo:** `src/components/EditOrderDialog.tsx` (após linha 1129)

Adicionar bloco de auto-save para `production_order_number`:
- Salvar imediatamente via `supabase.from('order_items').update()`
- Usar `ignoreNextRealtimeUpdateRef` para evitar reload desnecessário
- Registrar mudança no histórico via `recordItemChange()`
- Manter atualização do state local para feedback visual imediato

---

### Resumo de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/KanbanView.tsx` | Usar `orders` em vez de `optimisticOrders` para derivar `orderIds` |
| `src/components/EditOrderDialog.tsx` | Auto-save imediato do campo `production_order_number` no banco |

### Resultado Esperado

| Problema | Antes | Depois |
|----------|-------|--------|
| Dias na fase | Só aparece após trocar visualização | Aparece no primeiro acesso |
| OC/OP | Perde dados se outro usuário edita antes do save | Salva imediatamente, sem perda |

