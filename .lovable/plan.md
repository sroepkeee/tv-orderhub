

## Plano: Corrigir Tela Branca e Lentidao ao Retornar a Aba

### Diagnostico

A tela branca apos a atualizacao foi causada pelo hot-reload do codigo (HMR) — comportamento normal apos deploy de mudancas. Porem, ha um problema real no handler `visibilitychange` que pode causar lentidao e flash de tela branca em uso normal:

1. **Sem debounce**: Cada troca de aba dispara `loadOrders()` incondicionalmente, mesmo que o usuario tenha saido por 1 segundo
2. **Loading state agressivo**: `setRealtimeStatus('updating')` e chamado antes de verificar se realmente precisa recarregar
3. **Sem uso do cache**: O handler ignora o cache do React Query e sempre faz query completa ao banco

### Correcao

**Arquivo:** `src/components/Dashboard.tsx` (linhas 700-723)

Adicionar logica de **tempo minimo fora da aba** (30 segundos) antes de disparar recarregamento. Se o usuario saiu por menos de 30s, nao faz nada — os dados ainda estao frescos.

```typescript
// ANTES:
useEffect(() => {
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible' && user) {
      setRealtimeStatus('updating');
      await supabase.auth.getSession();
      loadOrders();
      setTimeout(() => setRealtimeStatus('synced'), 2000);
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [user]);

// DEPOIS:
useEffect(() => {
  let hiddenAt = 0;
  
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    
    if (document.visibilityState === 'visible' && user) {
      const awaySeconds = (Date.now() - hiddenAt) / 1000;
      
      // Se ficou fora por menos de 30s, nao precisa recarregar
      if (awaySeconds < 30) {
        console.log('👁️ [Visibility] Retornou em', awaySeconds.toFixed(0), 's - sem reload');
        return;
      }
      
      console.log('👁️ [Visibility] Retornou apos', awaySeconds.toFixed(0), 's - reconectando...');
      
      // Renovar token apenas se ficou fora por mais de 5 minutos
      if (awaySeconds > 300) {
        await supabase.auth.getSession();
      }
      
      // Recarregar dados (usa loading bifurcado - nao mostra tela branca)
      loadOrders();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [user]);
```

### Resumo de Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/Dashboard.tsx` | Adicionar threshold de 30s no visibilitychange, renovar token apenas apos 5min |

### Resultado Esperado

- Trocas rapidas de aba (< 30s) nao disparam reload — zero impacto visual
- Ausencias longas (> 30s) recarregam dados sem tela branca (usa `setRefreshing` em vez de `setLoading`)
- Token so e renovado quando realmente necessario (> 5 min fora)

