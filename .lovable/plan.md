
## Plano: Corrigir Erro de Coluna Inexistente na Edge Function

### Diagnóstico

O erro identificado nos logs do PostgreSQL:
```
column order_items_1.description does not exist
```

**Origem do erro:** Arquivo `supabase/functions/notify-phase-manager/index.ts` (linhas 376-387)

A query atual tenta buscar uma coluna `description` que não existe na tabela `order_items`:

```typescript
order_items(
  id, 
  item_code, 
  description,         // ❌ ERRO - coluna não existe
  item_description,    // ✅ coluna correta
  requested_quantity, 
  unit, 
  ...
)
```

### Impacto

- O erro ocorre toda vez que um pedido muda de status
- A edge function `notify-phase-manager` falha silenciosamente
- Pode causar comportamentos inesperados no frontend (como o Kanban vazio)
- Logs indicam falha constante

### Solução

**Arquivo:** `supabase/functions/notify-phase-manager/index.ts`

Remover a referência à coluna `description` inexistente:

| Linha | Antes | Depois |
|-------|-------|--------|
| 379 | `description,` | *(remover linha)* |

Código corrigido:
```typescript
order_items(
  id, 
  item_code, 
  item_description,    // ✅ apenas esta
  requested_quantity, 
  unit, 
  unit_price, 
  total_value, 
  item_status,
  warehouse
)
```

### Verificação Adicional

Há também uma referência no código que tenta usar `item.description` como fallback (linha 210):
```typescript
const desc = (item.item_description || item.description || '').substring(0, 25);
```

Esta linha está segura porque é um fallback opcional em JavaScript, não uma query SQL.

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/notify-phase-manager/index.ts` | Remover `description,` da linha 379 |

### Resultado Esperado

1. Edge function parará de falhar com erro de coluna inexistente
2. Notificações de mudança de status voltarão a funcionar
3. Dashboard carregará normalmente
