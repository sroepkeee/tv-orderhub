

## Plano: Corrigir Erro "stock_movements_movement_type_check" ao Concluir Pedidos

### Causa Raiz

O trigger `log_stock_movement` dispara quando um pedido muda para `completed` ou `delivered`. Ele busca `stock_operation` da tabela `order_type_config` e insere diretamente como `movement_type` na tabela `stock_movements`.

O problema:

| Tabela | Valor | Valido? |
|--------|-------|---------|
| `order_type_config` (transferencia_filial) | `transfer` | --- |
| CHECK constraint `stock_movements` | `entry, exit, transfer_out, transfer_in, temporary_exit, return` | `transfer` **NAO EXISTE** |

Qualquer pedido do tipo "Transferência de Filiais" que chega ao status `completed` ou `delivered` dispara o erro.

### Correcao

**Migration SQL** — Atualizar o valor inconsistente em `order_type_config`:

```sql
UPDATE order_type_config 
SET stock_operation = 'transfer_out' 
WHERE order_type = 'transferencia_filial' AND stock_operation = 'transfer';
```

Isso alinha o valor com a constraint existente. `transfer_out` e o valor semanticamente correto para transferencia entre filiais (saida do estoque de origem).

### Resumo

| Alteracao | Tipo |
|-----------|------|
| `order_type_config`: corrigir `transfer` → `transfer_out` | UPDATE de dados |

Nenhuma alteracao de codigo necessaria. O trigger `log_stock_movement` ja funciona corretamente — o problema e exclusivamente o dado inconsistente.

