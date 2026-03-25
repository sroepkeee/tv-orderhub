

## Plano: Otimizar Carregamento da Pagina de Indicadores

### Diagnostico

A pagina `Metrics.tsx` faz **5 queries sequenciais** no `loadData`, e apos renderizar, os componentes filhos disparam mais **2 queries independentes**. Problemas identificados:

1. **Queries sequenciais desnecessarias**: `countDateChanges(7)`, `findProblematicOrders(3)`, e `countDateChanges(14)` sao executadas uma apos a outra, quando poderiam ser paralelas
2. **`findProblematicOrders` sem filtro**: busca TODAS as linhas de `delivery_date_changes` sem limite, traz tudo para o client e processa em JS
3. **Payload excessivo**: a query de pedidos concluidos traz 500 pedidos com TODOS os itens (`order_items (*)`), gerando payload massivo
4. **Queries duplicadas de filhos**: `ComparativeMetrics` e `EnhancedDateChangeHistory` fazem queries proprias apos o render, adicionando mais tempo de espera

### Correcoes

#### 1. Paralelizar queries no loadData (`src/pages/Metrics.tsx`)

Trocar as chamadas sequenciais por `Promise.all`:

```typescript
// ANTES (sequencial):
const changes = await countDateChanges(7);
const problematic = await findProblematicOrders(3);
// ... mais awaits

// DEPOIS (paralelo):
const [changes, problematic, changes14] = await Promise.all([
  countDateChanges(7),
  findProblematicOrders(3),
  countDateChanges(14),
]);
```

#### 2. Limitar payload dos pedidos concluidos

Adicionar `.select()` mais restrito na query de concluidos, trazendo apenas os campos necessarios para a tabela:

```typescript
// Reduzir campos retornados
.select(`
  id, order_number, customer_name, status, order_type, priority,
  created_at, updated_at, delivery_date, issue_date, order_category, notes,
  order_items (id, item_code, item_description, requested_quantity, 
               delivered_quantity, unit, item_source_type, item_status, 
               sla_days, sla_deadline, delivery_date)
`)
```

#### 3. Otimizar `findProblematicOrders` (`src/lib/metrics.ts`)

Usar `head: true` com count agrupado ou limitar a query:

```typescript
// Adicionar filtro de data (ultimos 90 dias) e limit
const startDate = new Date();
startDate.setDate(startDate.getDate() - 90);

const { data, error } = await supabase
  .from('delivery_date_changes')
  .select('order_id')
  .gte('changed_at', startDate.toISOString());
```

#### 4. Eliminar re-fetch do `EnhancedDateChangeHistory`

O componente recebe `orders` como prop mas dispara sua propria query ao montar. Adicionar um `useEffect` com dependencia estavel para evitar re-fetches desnecessarios quando `orders` muda referencia.

Estabilizar a dependencia do `useEffect` usando `orders.length` ou IDs em vez do array completo:

```typescript
const orderIds = useMemo(() => orders.map(o => o.id).join(','), [orders]);

useEffect(() => {
  loadDateChanges();
}, [orderIds, limit, showOnlyActive]); // em vez de [orders, ...]
```

### Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Metrics.tsx` | Paralelizar queries com `Promise.all`; reduzir campos do select de concluidos |
| `src/lib/metrics.ts` | Adicionar filtro de data em `findProblematicOrders` |
| `src/components/metrics/EnhancedDateChangeHistory.tsx` | Estabilizar dependencia do useEffect para evitar re-fetches |

### Resultado Esperado

- Reducao de ~60% no tempo de carregamento (queries paralelas em vez de sequenciais)
- Menor payload de rede (campos limitados nos concluidos)
- Sem re-renders desnecessarios nos componentes filhos

