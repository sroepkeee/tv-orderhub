

## Plano: Otimizacao de Performance do Kanban

### Diagnostico

Analisei o fluxo completo de carregamento do Kanban e identifiquei **5 gargalos principais** que causam a lentidao ao navegar para a pagina:

---

### Gargalos Identificados

| # | Gargalo | Impacto | Dados |
|---|---------|---------|-------|
| 1 | **Sem cache entre navegacoes** | Dashboard usa `useState` puro. Toda vez que o usuario sai e volta, refaz TUDO do zero | ~2-4s por navegacao |
| 2 | **useDaysInPhase carrega todo historico** | Busca 2.508 registros de `order_history` para calcular dias na fase de cada pedido | ~800ms-1.5s |
| 3 | **Pedidos finalizados carregados** | 326 de 481 pedidos sao `delivered/completed/cancelled` mas sao carregados na query principal | 68% de payload desnecessario |
| 4 | **Queries sequenciais no mount** | `get_user_phases` RPC -> `orders+items` -> `phase_config` -> `order_history` executam em sequencia | ~1-2s de espera acumulada |
| 5 | **usePhaseInfo carrega todos profiles** | Busca TODOS os profiles e user_roles a cada mount para mapear responsaveis | ~300-500ms |

```text
Fluxo atual ao abrir o Kanban:

1. PermissionsContext carrega (roles, phases, menus)     ~500ms
2. Dashboard monta -> loadOrders()
   2a. RPC get_user_phases()                              ~200ms
   2b. SELECT orders + order_items (481+2241 registros)   ~800ms
   2c. Processar/transformar dados no client               ~100ms
3. KanbanView monta
   3a. usePhaseInfo -> 3 queries (phase_config + user_roles + profiles)  ~500ms
   3b. useDaysInPhase -> 2 queries chunked (orders + order_history)      ~1000ms
   3c. phase_config (order_index)                          ~200ms
4. Render das 15 colunas com cards                         ~200ms

TOTAL ESTIMADO: ~3.5s na primeira carga, ~3s em navegacoes subsequentes
```

---

### Solucoes Propostas

#### Correcao 1: Migrar loadOrders para React Query (Cache entre paginas)

**Problema:** `useState` + `useEffect` perde dados ao desmontar. Cada navegacao recarrega tudo.

**Solucao:** Usar `useQuery` do TanStack React Query (ja instalado) para cachear pedidos. Quando o usuario volta ao Kanban, os dados aparecem instantaneamente do cache enquanto o refetch acontece em background.

**Arquivo:** `src/components/Dashboard.tsx`

```typescript
// ANTES: useState puro
const [orders, setOrders] = useState<Order[]>([]);
useEffect(() => { loadOrders(); }, [user]);

// DEPOIS: React Query com cache
const { data: orders = [], refetch } = useQuery({
  queryKey: ['kanban-orders', user?.id],
  queryFn: fetchOrders,
  staleTime: 30_000,      // 30s antes de considerar stale
  gcTime: 5 * 60_000,     // 5min no cache apos desmontar
  refetchOnWindowFocus: false,
});
```

**Resultado:** Navegacao de volta ao Kanban = **instantanea** (dados do cache).

---

#### Correcao 2: Filtrar pedidos finalizados na query

**Problema:** 326 pedidos finalizados sao carregados mas nao aparecem no Kanban (coluna "Conclusao" raramente e visivel).

**Solucao:** Excluir `delivered`, `completed`, `cancelled` da query principal. Carregar separadamente so quando a aba "Concluidos" for selecionada.

**Arquivo:** `src/components/Dashboard.tsx` (dentro de `fetchOrders`)

```typescript
// Adicionar filtro na query principal
let query = supabase.from('orders').select(`...`)
  .not('status', 'in', '(delivered,completed,cancelled)');  // Reduz de 481 para ~155 pedidos
```

**Resultado:** Payload reduzido em **68%**, query ~3x mais rapida.

---

#### Correcao 3: Otimizar useDaysInPhase com view materializada ou calculo server-side

**Problema:** Busca 2.508 registros de `order_history` no client e processa em JS.

**Solucao:** Criar uma RPC (funcao SQL) que calcula dias na fase diretamente no banco, retornando apenas `{order_id, days_in_phase, phase_entered_at}`.

**Arquivo:** Nova migration SQL + refatorar `src/hooks/useDaysInPhase.tsx`

```sql
-- Nova RPC que calcula tudo no banco
CREATE OR REPLACE FUNCTION get_days_in_phase(order_ids uuid[])
RETURNS TABLE(order_id uuid, days_in_phase int, phase_entered_at timestamptz)
AS $$
  -- Logica SQL que substitui o calculo JS
  -- Retorna apenas 155 linhas em vez de 2508 registros de historico
$$;
```

**Resultado:** De ~2.500 registros transferidos para ~155 linhas compactas. Calculo ~10x mais rapido no banco.

---

#### Correcao 4: Paralelizar queries iniciais

**Problema:** Queries executam em sequencia: RPC -> orders -> phase_config -> history.

**Solucao:** Executar em paralelo usando `Promise.all`.

**Arquivo:** `src/components/Dashboard.tsx` e `src/components/KanbanView.tsx`

```typescript
// ANTES: sequencial
const userPhases = await supabase.rpc('get_user_phases', ...);
const orders = await supabase.from('orders').select(...);

// DEPOIS: paralelo
const [userPhasesResult, ordersResult] = await Promise.all([
  supabase.rpc('get_user_phases', ...),
  supabase.from('orders').select(...)
]);
```

**Resultado:** Reduz tempo total de ~1.5s para ~800ms (a query mais lenta define o tempo).

---

#### Correcao 5: Cache usePhaseInfo e phase_config

**Problema:** `usePhaseInfo` busca 3 tabelas (phase_config, user_roles, profiles) a cada mount do KanbanView.

**Solucao:** Migrar para `useQuery` com `staleTime` alto (dados mudam raramente).

**Arquivo:** `src/hooks/usePhaseInfo.tsx`

```typescript
const { data: phaseConfigs } = useQuery({
  queryKey: ['phase-configs'],
  queryFn: loadPhaseData,
  staleTime: 5 * 60_000,  // 5 min - muda muito raramente
});
```

**Resultado:** Depois do primeiro load, phase info vem do cache instantaneamente.

---

### Resumo de Alteracoes

| Prioridade | Arquivo | Descricao |
|------------|---------|-----------|
| **CRITICA** | `src/components/Dashboard.tsx` | Migrar orders para React Query com cache |
| **CRITICA** | `src/components/Dashboard.tsx` | Filtrar pedidos finalizados da query principal |
| **ALTA** | `src/hooks/useDaysInPhase.tsx` | Migrar para React Query + otimizar query |
| **ALTA** | `src/hooks/usePhaseInfo.tsx` | Migrar para React Query com staleTime alto |
| **MEDIA** | `src/components/Dashboard.tsx` | Paralelizar get_user_phases + orders query |
| **MEDIA** | `src/components/KanbanView.tsx` | Remover query duplicada de phase_config |

### Resultado Esperado

| Metrica | Antes | Depois |
|---------|-------|--------|
| Primeiro carregamento | ~3.5s | ~1.2s |
| Retorno ao Kanban (navegacao) | ~3s | **Instantaneo** (cache) |
| Payload de rede | ~481 pedidos + 2241 items + 2508 historico | ~155 pedidos + ~600 items |
| Realtime sync | Reload completo a cada evento | Update seletivo (ja implementado) |

### Manutencao do Realtime

O sistema de realtime existente (broadcast + postgres_changes + updateSingleOrder) sera **mantido intacto**. A unica mudanca e que em vez de `setOrders()`, o realtime atualizara o cache do React Query via `queryClient.setQueryData()`, garantindo que todos os componentes recebam a atualizacao.

