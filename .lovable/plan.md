

## Plano: Restaurar Pedidos da Fase "Conclusao" e Corrigir Filtro

### Causa Raiz Confirmada

A otimizacao de performance implementada recentemente adicionou este filtro na query principal do Dashboard (linha 901):

```text
.not('status', 'in', '(delivered,completed,cancelled)')
```

Isso **removeu 363 pedidos** (325 completed + 38 delivered) que pertenciam a fase "Conclusao" do Kanban. A coluna "Conclusao" ainda existe no KanbanView, mas como os pedidos com esses status nao sao mais carregados, ela aparece **vazia para todos os usuarios**.

```text
Fluxo do problema:

1. Dashboard.fetchOrders() -> exclui delivered/completed/cancelled
2. KanbanView.getOrdersByPhase("completion") -> filtra pedidos com status de conclusao
3. kanbanPhase.ts mapeia delivered/completed/cancelled -> "completion"
4. RESULTADO: 0 pedidos na coluna Conclusao (deveria ter 363)
```

---

### Solucao

#### Correcao 1: Remover filtro agressivo e substituir por filtro inteligente

**Arquivo:** `src/components/Dashboard.tsx` (linha 901)

O filtro atual exclui TODOS os pedidos finalizados. A correcao correta e:
- Manter pedidos `delivered` e `completed` dos **ultimos 7 dias** (para que aparecam na coluna Conclusao)
- Excluir apenas pedidos finalizados ha mais de 7 dias (que ja nao sao relevantes)
- Manter `cancelled` visivel tambem (pode ter pedidos cancelados recentes que precisam de atencao)

```text
ANTES (linha 901):
  .not('status', 'in', '(delivered,completed,cancelled)')

DEPOIS:
  .or(
    'status.not.in.(delivered,completed,cancelled),' +
    'and(status.in.(delivered,completed,cancelled),updated_at.gte.' + sevenDaysAgo + ')'
  )
```

Isso garante:
- Pedidos ativos: sempre carregados (sem filtro)
- Pedidos finalizados recentes (7 dias): carregados na coluna Conclusao
- Pedidos finalizados antigos (mais de 7 dias): excluidos para manter performance

---

#### Correcao 2: Adicionar contador visivel na coluna Conclusao

**Arquivo:** `src/components/KanbanView.tsx`

Adicionar indicador na coluna Conclusao mostrando que existem mais pedidos antigos que nao estao sendo exibidos, com opcao de "ver todos" se necessario.

---

### Resumo de Alteracoes

| Prioridade | Arquivo | Descricao |
|------------|---------|-----------|
| **URGENTE** | `src/components/Dashboard.tsx` | Substituir filtro agressivo por filtro com janela de 7 dias |
| Media | `src/components/KanbanView.tsx` | Indicador opcional de pedidos antigos ocultos |

### Resultado Esperado

| Metrica | Antes (com bug) | Depois |
|---------|-----------------|--------|
| Pedidos na coluna Conclusao | 0 | ~30-50 (ultimos 7 dias) |
| Pedidos carregados no total | ~140 | ~170-190 |
| Performance mantida | Sim | Sim (ainda exclui ~320 pedidos antigos) |

### Nenhum dado foi perdido

Os 363 pedidos continuam intactos no banco de dados. Apenas nao estao sendo carregados pela query do frontend. A correcao e exclusivamente no filtro da query.

