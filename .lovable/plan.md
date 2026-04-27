## Diagnóstico

O gráfico da aba **Faturamento** mostra apenas dados a partir de **15/03** para o usuário Carlos Ecke porque a view `v_orders_invoice_requested_daily` tem uma falha conceitual:

```sql
WHERE o.status = ANY (ARRAY['invoice_requested', 'ready_to_invoice', ...])
GROUP BY DATE(o.created_at)
```

Ou seja, ela só conta pedidos **que ainda estão hoje** em algum status de faturamento. Como faturamento é um estado **transitório**, todos os pedidos que Carlos faturou em Jan/Fev/Mar já avançaram para `completed`/`delivered` e desapareceram da view. O 15/03 é simplesmente o pedido mais antigo dele que ainda não foi concluído.

Verificado no banco:
- View atual retorna **8 registros** para Carlos (todos a partir de 16/03)
- Tabela `order_history` tem **60+ transições reais** de Carlos para statuses de faturamento entre Jan e 14/03

## Solução

Reconstruir a view `v_orders_invoice_requested_daily` para usar a tabela `order_history`, contando **transições efetivas** para statuses de faturamento (independente do status atual do pedido). A data passa a ser `DATE(oh.changed_at)` — quando o pedido foi de fato encaminhado para faturar.

A mesma lógica já existe e funciona em `v_orders_completed_daily` (concluídos é um estado terminal, então usar status atual ainda funciona, mas idealmente também deveria usar histórico — ver passo opcional).

### Passo 1 — Recriar `v_orders_invoice_requested_daily` baseada em `order_history`

```sql
CREATE OR REPLACE VIEW public.v_orders_invoice_requested_daily AS
SELECT
  DATE(oh.changed_at) AS request_date,
  o.user_id,
  o.organization_id,
  COALESCE(p.full_name, p.email, 'Desconhecido') AS user_name,
  p.email AS user_email,
  COUNT(DISTINCT oh.order_id) AS orders_invoice_requested
FROM order_history oh
JOIN orders o ON o.id = oh.order_id
LEFT JOIN profiles p ON p.id = o.user_id
WHERE oh.new_status IN (
  'invoice_requested','ready_to_invoice','pending_invoice_request',
  'awaiting_invoice','invoice_issued','invoice_sent'
)
  AND (oh.old_status IS NULL OR oh.old_status NOT IN (
    'invoice_requested','ready_to_invoice','pending_invoice_request',
    'awaiting_invoice','invoice_issued','invoice_sent'
  )) -- só conta a primeira entrada em "faturamento" para evitar contagem dupla
GROUP BY DATE(oh.changed_at), o.user_id, o.organization_id, p.full_name, p.email;
```

O `COUNT(DISTINCT oh.order_id)` + filtro `old_status NOT IN (...)` garante que cada pedido seja contado **uma única vez** no dia em que entrou pela primeira vez na fase de faturamento, mesmo que tenha trafegado entre vários sub-statuses de faturamento (p.ex. `ready_to_invoice` → `invoice_requested` → `invoice_issued`).

### Passo 2 — Recriar `v_orders_completed_daily` da mesma forma (consistência)

```sql
CREATE OR REPLACE VIEW public.v_orders_completed_daily AS
SELECT
  DATE(oh.changed_at) AS completion_date,
  o.user_id,
  o.organization_id,
  COALESCE(p.full_name, p.email, 'Desconhecido') AS user_name,
  p.email AS user_email,
  COUNT(DISTINCT oh.order_id) AS orders_completed
FROM order_history oh
JOIN orders o ON o.id = oh.order_id
LEFT JOIN profiles p ON p.id = o.user_id
WHERE oh.new_status IN ('completed','delivered')
  AND (oh.old_status IS NULL OR oh.old_status NOT IN ('completed','delivered'))
GROUP BY DATE(oh.changed_at), o.user_id, o.organization_id, p.full_name, p.email;
```

Assim a "data de conclusão" passa a ser de fato o dia em que o pedido foi concluído (não a data de criação).

### Passo 3 — Ajustar drill-down "Ver pedidos" da aba Faturamento

O hook `useProductivityOrders` filtra hoje por `created_at` no range. Para a aba Faturamento, os pedidos cuja **transição** ocorreu no range podem ter sido **criados** antes do range. Vamos ampliar a janela do drill-down quando `statuses` for de faturamento, mostrando pedidos que **estão** em qualquer status de faturamento OU **já passaram** por faturamento (joins com `order_history`).

Edição em `src/hooks/useProductivityOrders.tsx`: quando `statuses` corresponder ao set de faturamento, trocar a query para um JOIN com `order_history` filtrando pela data da transição em vez de `created_at`.

### Passo 4 — Validar no preview

Após o deploy, abrir Visão Produtividade → Faturamento → filtrar Carlos Ecke + range 01/01/2026 a 24/04/2026. Esperado: gráfico apresenta barras desde 05/01.

## Arquivos afetados

**Migration nova:**
- `supabase/migrations/<timestamp>_fix_invoice_view_history.sql` — recria as 2 views.

**Código (1 arquivo):**
- `src/hooks/useProductivityOrders.tsx` — quando `statuses` for de faturamento, consultar via `order_history` para que o drill-down mostre os pedidos cuja transição ocorreu no período (não os criados).

Nenhuma alteração necessária em `ProductivityViewDialog.tsx` — os labels e queries continuam compatíveis.

## Observações

- As views permanecem com os **mesmos nomes de colunas** (`request_date`, `completion_date`, etc.), então o frontend não precisa de mudanças além do hook do drill-down.
- Pedidos importados (`Importados`) continuam usando `created_at` — correto, pois "importação" = criação.
- SLA / Cycle Time / Complexidade continuam baseados em `status atual = completed/delivered`, o que é correto para essas métricas (só faz sentido medir SLA de pedidos concluídos).