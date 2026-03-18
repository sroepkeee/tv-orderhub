

## Plano: Corrigir Desconexões Frequentes (Caso Denise Gassen)

### Diagnóstico

Os console logs confirmam ciclos `CHANNEL_ERROR → SUBSCRIBED` frequentes. A session replay mostra transição `Desconectado → Sincronizado` em poucos segundos. O sistema não tem:
1. **Listener de visibilidade da aba** — quando o browser suspende a aba, o WebSocket morre silenciosamente e nunca reconecta
2. **Retry automático em CHANNEL_ERROR** — o canal apenas marca "disconnected" sem tentar reconectar
3. **Refresh de token ao retornar** — `autoRefreshToken` não funciona com aba em background

### Alterações

#### 1. `src/App.tsx` — Aumentar retry do QueryClient

```typescript
// ANTES: retry: 1
// DEPOIS:
retry: 3,
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
```

#### 2. `src/components/Dashboard.tsx` — Adicionar reconexão por visibilidade

Adicionar um `useEffect` com listener `visibilitychange` que, ao retornar à aba:
- Força `supabase.auth.getSession()` para renovar token expirado
- Chama `loadOrders()` para garantir dados frescos
- Reconecta canais realtime

```typescript
useEffect(() => {
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible' && user) {
      console.log('👁️ Tab voltou ao foco, reconectando...');
      setRealtimeStatus('updating');
      
      // Renovar token (pode ter expirado em background)
      await supabase.auth.getSession();
      
      // Recarregar dados
      loadOrders();
      
      setTimeout(() => setRealtimeStatus('synced'), 2000);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [user]);
```

#### 3. `src/components/Dashboard.tsx` — Retry automático em CHANNEL_ERROR

No subscribe callback do canal `orders-realtime`, ao detectar `CHANNEL_ERROR` ou `TIMED_OUT`, aguardar 3s e tentar resubscribe:

```typescript
.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    setRealtimeStatus('synced');
  } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    setRealtimeStatus('disconnected');
    // Auto-retry após 3s
    setTimeout(() => {
      console.log('🔄 Tentando reconectar canal realtime...');
      channel.subscribe();
    }, 3000);
  }
});
```

### Resumo

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | `retry: 3` com backoff exponencial |
| `src/components/Dashboard.tsx` | Listener `visibilitychange` + retry automático em CHANNEL_ERROR |

### Resultado Esperado

- Ao voltar para a aba após inatividade, o sistema renova o token e recarrega dados automaticamente
- Erros de canal são recuperados em ~3s sem intervenção do usuário
- Queries HTTP retentam 3x com backoff, absorvendo micro-drops de rede

