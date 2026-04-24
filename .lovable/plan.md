
# Correção de Filtros Inconsistentes — Visão Produtividade

## Diagnóstico

Identifiquei 3 causas-raiz que fazem o filtro de **usuário** parecer "errado" e o intervalo de **datas** parecer "diferente" entre abas:

### 1. Cada view usa um campo de data diferente (mesmo intervalo no calendário → resultados diferentes)

| Aba | View | Coluna de data filtrada |
|---|---|---|
| Importados | `v_orders_imported_daily` | `DATE(created_at)` |
| Faturamento | `v_orders_invoice_requested_daily` | `DATE(updated_at)` |
| Concluídos | `v_orders_completed_daily` | `DATE(updated_at)` |
| Por Tipo | `v_productivity_by_type_daily` | `DATE(created_at)` |
| SLA | `v_productivity_sla_daily` | `DATE(COALESCE(shipping_date, updated_at))` |
| Complexidade | `v_productivity_complexity_daily` | `DATE(created_at)` |
| Drill "Ver pedidos" | `orders` direto | `created_at` |

→ Selecionar `01/01 → 24/04` numa aba conta pedidos **criados** nesse período; em outra conta pedidos **atualizados/enviados** nesse período. Mesmo cliente/usuário pode aparecer em uma e sumir em outra.

### 2. A lista de usuários do filtro depende **só** de `byTypeQuery` (created_at)

`allUsers` é construído a partir de `byTypeQuery.data`. Se um usuário só aparece em pedidos finalizados (concluídos via updated_at) mas nada criado dentro do período, ele **não aparece no dropdown** — porém aparece no ranking/gráfico da aba Concluídos. Isso gera a sensação de "filtra errado".

### 3. Ao clicar em "Faturamento" com filtro de usuário ativo, gráfico e ranking mostram dados que **não batem entre si**

Acontece porque o filtro só compara por `user_id || user_name`. Quando `user_id` é `NULL` numa view e preenchido em outra, o mesmo usuário tem chaves distintas → o filtro deixa passar registros indesejados ou esconde corretos.

---

## Plano de correção

### Etapa 1 — Unificar a coluna de data nas views simples (migration SQL)

Recriar as 3 views simples para usar **`DATE(created_at) AS activity_date`** consistentemente, mantendo as colunas antigas (`import_date`, `request_date`, `completion_date`) como aliases para retrocompatibilidade. Assim, o intervalo selecionado significa sempre "pedidos criados nesse período" — e os números do **Por Tipo** vão bater com Importados / Faturamento / Concluídos.

```text
v_orders_imported_daily         → DATE(created_at) AS import_date  (já é)
v_orders_invoice_requested_daily → DATE(created_at) AS request_date (mudar)
v_orders_completed_daily        → DATE(created_at) AS completion_date (mudar)
v_productivity_sla_daily        → DATE(created_at) AS activity_date (mudar)
v_productivity_cycle_time       → DATE(created_at) AS activity_date (mudar)
```

Justificativa: "produtividade" no contexto Pós-Venda significa **quantos pedidos cada usuário cuidou** dentre os recebidos no período. Usar `created_at` como eixo temporal padroniza tudo. SLA continua medindo on-time pelo `delivery_date` vs `shipping_date` (a métrica não muda, só o eixo de agrupamento).

### Etapa 2 — Fonte única para a lista de usuários

No `ProductivityViewDialog.tsx`, montar `allUsers`/`allTypes`/`allPriorities` consolidando dados de **todas as queries carregadas** (importedQuery + invoiceQuery + completedQuery + byTypeQuery), não apenas do `byTypeQuery`. Assim o dropdown sempre lista quem aparece em qualquer aba.

### Etapa 3 — Normalizar a chave de usuário

Padronizar a chave usada em `matchesFilters` e nos agregadores (`byUser`, `slaByUser`, `complexityByUser`) usando sempre **`user_id` quando existir, senão fallback para `email` lowercased, senão `user_name` trim+lower**. Hoje o mix `user_id || user_name` cria duplicatas e falsos negativos quando o `user_id` vem `null` em uma view e preenchido em outra.

### Etapa 4 — Drill-down ("Ver pedidos") respeitar a aba ativa

Hoje `useProductivityOrders` filtra **sempre por `created_at`**. Vamos:
- Manter o filtro padrão por `created_at` (alinhado com etapa 1).
- Passar o contexto da aba ativa para o sheet (ex.: "Faturamento") apenas para fins de título/subtítulo e para incluir filtro de status correspondente quando aplicável (`invoice_requested`-like statuses na aba Faturamento, `completed/delivered` na aba Concluídos, etc).

### Etapa 5 — Indicar visualmente o eixo de data em cada aba

Adicionar um pequeno texto auxiliar abaixo do seletor de data ("Período baseado na **data de criação** do pedido") para evitar dúvida futura do usuário.

---

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — recriar as 5 views unificando para `created_at`.
- `src/hooks/useProductivityMetrics.tsx` — sem mudança (continua lendo `import_date`/`request_date`/`completion_date`, agora todas vindo de `created_at`).
- `src/components/metrics/ProductivityViewDialog.tsx`:
  - `allUsers/allTypes/allPriorities` consolidados de todas as queries.
  - Função `userKey()` centralizada e usada em todos os agregadores.
  - Texto explicativo do eixo de data.
- `src/components/metrics/ProductivityOrdersSheet.tsx` + `useProductivityOrders.tsx` — aceitar status alvo opcional por aba.

---

## Resultado esperado

1. Selecionar `01/01 → 24/04` retorna o **mesmo conjunto base de pedidos** em todas as abas (recorte por criação).
2. Filtrar por "Carlos Ecke" mostra apenas seus pedidos consistentemente — sem registros vazando, sem desaparecer ao trocar de aba.
3. Ranking, gráfico diário e drill-down "Ver pedidos" passam a coincidir em totais.
4. A aba **SLA** continua medindo on-time corretamente (a métrica é independente do eixo temporal).
