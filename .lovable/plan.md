

## Plano: Corrigir Dias na Fase Não Aparecendo no Kanban

### Causa Raiz

O `KanbanColumn` usa `React.memo` com um comparador customizado (`areColumnsEqual`) que **não compara** `getDaysInPhase`, `daysLoading` nem `density`. Quando a query de dias na fase finaliza e `getDaysInPhase` retorna novos valores, o memo bloqueia o re-render porque o comparador só verifica `orders`, `animatedCardIds` e campos básicos.

Trocar a densidade força um re-render por outros caminhos (mudança de layout no pai), e aí os dados já carregados aparecem.

### Correção

**Arquivo: `src/components/KanbanColumn.tsx`** (linhas 280-305 — função `areColumnsEqual`)

Adicionar comparação de `daysLoading` e `getDaysInPhase` (referência da função muda quando os dados carregam):

```typescript
// Adicionar antes do "return true":
if (prev.daysLoading !== next.daysLoading) return false;
if (prev.getDaysInPhase !== next.getDaysInPhase) return false;
if (prev.density !== next.density) return false;
if (prev.searchQuery !== next.searchQuery) return false;
```

### Resumo

| Arquivo | Alteração |
|---------|-----------|
| `src/components/KanbanColumn.tsx` | Adicionar `daysLoading`, `getDaysInPhase`, `density` e `searchQuery` ao comparador do `React.memo` |

### Resultado

Os dias na fase aparecerão imediatamente após o carregamento dos dados, sem necessidade de trocar a densidade ou dar F5.

