

## Plano: Campo de Busca + Tabela de Historico Completo com Paginacao

### Problema atual

1. **OrdersTrackingTable** recebe apenas os pedidos ativos do Kanban (107), nao o historico completo
2. Para cada pedido, faz 2 queries individuais (items + date changes) = **214 queries** desnecessarias (items ja vem do parent, date changes e N+1)
3. Nao ha paginacao nem controle de quantidade por pagina
4. Nao ha campo de busca na pagina de Indicadores

### Correcoes

#### 1. Campo de busca no header (`src/pages/Metrics.tsx`)

Adicionar Input com icone Search no header, identico ao Kanban. Estado `searchQuery` + `useMemo` para filtrar `orders` e `completedOrders` por numero de pedido, cliente, codigo/descricao de item. Todas as metricas e componentes filhos usarao os arrays filtrados.

#### 2. Transformar OrdersTrackingTable em tabela com dados proprios (`src/components/metrics/OrdersTrackingTable.tsx`)

**Mudanca principal**: a tabela fara sua propria query paginada ao banco, buscando TODOS os pedidos (ativos + concluidos), em vez de receber apenas os ativos via props.

- Adicionar prop opcional `searchQuery` para filtro externo
- Query interna com `.range(offset, offset + pageSize - 1)` para paginacao server-side
- Select box para escolher 10, 20, 50 ou 100 itens por pagina
- Botoes de navegacao de pagina (anterior/proxima) com indicador "Pagina X de Y"
- **Eliminar N+1**: buscar items junto com a query principal (`order_items(*)`), e buscar date changes em batch unico com `IN` filter em vez de 1 query por pedido
- Filtros de busca aplicados via `.ilike()` ou `.or()` direto na query do Supabase (server-side)

#### 3. Batch de date changes

Em vez de chamar `countOrderDateChanges` para cada pedido individualmente, fazer uma unica query:

```typescript
const { data } = await supabase
  .from('delivery_date_changes')
  .select('order_id')
  .in('order_id', orderIds);

// Agrupar counts no client
const counts = data.reduce((acc, row) => {
  acc[row.order_id] = (acc[row.order_id] || 0) + 1;
  return acc;
}, {});
```

### Resumo de alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Metrics.tsx` | Campo de busca no header; passar searchQuery para componentes |
| `src/components/metrics/OrdersTrackingTable.tsx` | Query propria paginada server-side; select de page size (10/20/50/100); navegacao de paginas; batch date changes; prop searchQuery para filtro |

### Resultado

- Campo de busca identico ao Kanban no topo da pagina de Indicadores
- Tabela de acompanhamento lista TODOS os pedidos historicos, nao apenas os ativos
- Paginacao com opcoes de 10, 20, 50, 100 por pagina
- Performance: de ~214 queries para ~3 queries por carregamento de pagina

