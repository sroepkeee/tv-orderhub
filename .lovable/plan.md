

## Plano: Persistencia de Mudanca de Codigo, Historico e Notificacao de Rateio

### Problema 1: Mudanca de codigo de item nao persiste corretamente

**Causa raiz**: Quando o usuario altera o `itemCode` no EditOrderDialog, a mudanca passa pelo `updateItem` generico que apenas atualiza o estado local. Diferente de `warehouse`, `item_status` e `production_order_number` que tem auto-save imediato no banco, o `itemCode` so e salvo no submit geral do formulario. Se o dialogo fechar ou houver reload realtime antes do submit, a alteracao e perdida.

**Correcao**: Implementar auto-save imediato para `itemCode` e `itemDescription`, identico ao padrao ja existente para `warehouse` e `production_order_number`.

### Problema 2: Historico de mudanca de codigo inexistente

**Causa raiz**: `recordItemChange` aceita apenas campos especificos (`item_status`, `warehouse`, etc). `item_code` e `item_description` nao estao na lista.

### Problema 3: Notificacao ao importador do pedido

Quando um codigo muda, o usuario que criou/importou o pedido precisa ser notificado para atualizar o pedido RAIZ no TOTVS.

### Problema 4: Rateio obrigatorio com alerta visual

Ja existe validacao no submit, mas nao ha alerta proativo na tela para pedidos sem rateio.

---

### Alteracoes

#### 1. Auto-save de `itemCode` e `itemDescription` (`EditOrderDialog.tsx`)

Adicionar bloco no `updateItem` (apos o bloco de `production_order_number`, linha ~1167):

```
if (field === 'itemCode' && oldItem.itemCode !== value && oldItem.id) {
  // auto-save imediato no banco
  // registrar no order_item_history (old_code -> new_code)
  // registrar em order_changes
  // criar notificacao para order.user_id (importador)
  // toast de alerta sobre TOTVS
}
```

Mesma logica para `itemDescription`.

#### 2. Expandir `recordItemChange` para aceitar `item_code` e `item_description`

Atualizar o type union do parametro `field` para incluir `'item_code' | 'item_description'`.

#### 3. Notificacao ao importador do pedido

Quando `itemCode` mudar, inserir registro na tabela `notifications`:
- `user_id`: `order.user_id` (quem importou o pedido)
- `type`: `'item_code_change'`
- `title`: "Codigo de item alterado no pedido #XXX"
- `message`: "O codigo ANTIGO foi substituido por NOVO. Atualize o pedido RAIZ no TOTVS."
- `order_id`: referencia ao pedido

#### 4. Badge/alerta de rateio pendente no Dashboard

Adicionar no `KanbanCard.tsx` um indicador visual (badge amarelo) quando o pedido nao tem `cost_center` nem `account_item` preenchidos, para que todos vejam que o rateio esta pendente.

Adicionar banner de alerta no topo do `EditOrderDialog` quando rateio estiver vazio.

---

### Arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/EditOrderDialog.tsx` | Auto-save itemCode/itemDescription; expandir recordItemChange; notificacao ao importador; banner de rateio |
| `src/components/KanbanCard.tsx` | Badge visual de rateio pendente |

### Sem migracoes necessarias

As tabelas `order_item_history`, `order_changes` e `notifications` ja existem e suportam os campos necessarios.

