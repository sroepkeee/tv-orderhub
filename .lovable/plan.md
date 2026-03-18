

## Plano: Corrigir Visualizacao de Pedidos Concluidos na Pagina Metrics

### Diagnostico

Identifiquei **dois problemas** que impedem a exibicao dos pedidos concluidos:

| # | Problema | Local | Impacto |
|---|----------|-------|---------|
| 1 | **Query exclui pedidos concluidos** | `src/pages/Metrics.tsx` linha 71 | `.not('status', 'in', '(delivered,completed,cancelled)')` remove todos os 320+ pedidos finalizados |
| 2 | **CompletedOrdersTable nunca e renderizada** | `src/pages/Metrics.tsx` | O componente existe em `src/components/metrics/CompletedOrdersTable.tsx` mas nao e importado nem usado em nenhuma pagina |

Resultado: a pagina Metrics nunca carrega nem exibe pedidos concluidos.

---

### Solucao

#### 1. Adicionar query separada para pedidos concluidos

A query principal da pagina Metrics deve continuar excluindo concluidos (para calcular metricas de pedidos ativos). Porem, uma **segunda query** buscara especificamente pedidos `completed` e `delivered` para alimentar a tabela de concluidos.

**Arquivo:** `src/pages/Metrics.tsx`

- Novo state: `completedOrders`
- Nova query dentro de `loadData()`:

```typescript
// Query separada para pedidos concluidos (sem limite de 30 dias)
const { data: completedData } = await supabase
  .from('orders')
  .select('*, order_items (*)')
  .in('status', ['completed', 'delivered'])
  .order('updated_at', { ascending: false })
  .range(0, 499);
```

Isso busca ate 500 pedidos concluidos mais recentes, independente da query principal.

#### 2. Importar e renderizar CompletedOrdersTable

**Arquivo:** `src/pages/Metrics.tsx`

- Importar o componente `CompletedOrdersTable`
- Adicionar uma secao no final da pagina (antes do dialog de edicao) com a tabela

#### 3. Remover filtro de 30 dias do CompletedOrdersTable

**Arquivo:** `src/components/metrics/CompletedOrdersTable.tsx`

O componente atualmente filtra internamente apenas pedidos dos ultimos 30 dias (linhas 24-35). Como a query ja traz os dados corretos, esse filtro cliente sera removido ou tornado configuravel, para que todos os pedidos retornados pela query sejam exibidos.

Tambem sera adicionada **paginacao visual** para navegar pelos resultados caso sejam muitos.

---

### Resumo de Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Metrics.tsx` | Adicionar query separada para concluidos, importar e renderizar CompletedOrdersTable |
| `src/components/metrics/CompletedOrdersTable.tsx` | Remover filtro fixo de 30 dias, adicionar paginacao simples |

### Resultado Esperado

- Todos os pedidos concluidos (ate 500 mais recentes) serao exibidos na pagina Metrics
- Tabela com ordenacao, status de prazo e acoes de visualizacao
- Performance mantida pois usa query separada com `.range(0, 499)`

