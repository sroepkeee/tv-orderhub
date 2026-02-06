
## Plano: Análise e Correção de Edge Functions Expostas

### Diagnóstico de Segurança

Analisei todas as **45 Edge Functions** do projeto e identifiquei as que estão configuradas como públicas (`verify_jwt = false`) no `supabase/config.toml`:

---

### 📊 Resumo de Funções Públicas (14 no total)

| Função | Status de Proteção | Risco |
|--------|-------------------|-------|
| `receive-carrier-response` | ✅ **Protegida** - Valida `x-api-key` contra `N8N_API_KEY` | Baixo |
| `receive-lab-update` | ✅ **Protegida** - Valida assinatura HMAC com `LAB_WEBHOOK_SECRET` | Baixo |
| `notify-lab` | ⚠️ **Parcial** - Usa secrets mas não valida chamador | Médio |
| `update-message-status` | ❌ **EXPOSTA** - Nenhuma validação de origem | **Alto** |
| `mega-api-webhook` | ✅ **Protegida** - Valida `instance_key` no banco/env | Baixo |
| `daily-management-report` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `ai-agent-manager-query` | ❌ **EXPOSTA** - Nenhuma validação de origem | **Alto** |
| `process-message-queue` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `queue-alert` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `send-scheduled-reports` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `manager-metrics` | ❌ **EXPOSTA** - Nenhuma validação de origem | **Alto** |
| `manager-smart-alerts` | ❌ **EXPOSTA** - Nenhuma validação de origem | **Alto** |
| `check-stalled-orders` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `check-delivery-confirmations` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `process-delivery-response` | ⚠️ **Webhook interno** - Chamado pelo mega-api-webhook | Médio |
| `discord-send-digest` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `discord-slash-command` | ⚠️ **Discord Webhook** - Sem verificação de assinatura Discord | Médio |

---

### 🚨 Funções Críticas para Corrigir

#### 1. `update-message-status` - **RISCO ALTO**
**Problema:** Aceita qualquer requisição sem validação
**Impacto:** Qualquer pessoa pode atualizar status de mensagens, manipulando dados de conversas

**Correção:**
```typescript
// Adicionar validação de API Key (igual receive-carrier-response)
function validateApiKey(req: Request): boolean {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key');
  const expectedKey = Deno.env.get('N8N_API_KEY');
  return !!expectedKey && apiKey === expectedKey;
}
```

---

#### 2. `ai-agent-manager-query` - **RISCO ALTO**
**Problema:** Aceita qualquer requisição e responde com dados sensíveis de pedidos
**Impacto:** Qualquer pessoa pode consultar dados de pedidos, clientes, valores

**Correção:**
```typescript
// Adicionar validação de API Key ou origem WhatsApp
function validateRequest(req: Request, payload: any): boolean {
  // Opção 1: API Key
  const apiKey = req.headers.get('x-api-key');
  if (apiKey === Deno.env.get('N8N_API_KEY')) return true;
  
  // Opção 2: Validar que veio do mega-api-webhook (origem interna)
  const isInternalCall = req.headers.get('x-internal-source') === 'mega-api-webhook';
  return isInternalCall;
}
```

---

#### 3. `manager-metrics` e `manager-smart-alerts` - **RISCO ALTO**
**Problema:** Retornam métricas e alertas sem validação
**Impacto:** Exposição de dados de negócio (pedidos, volumes, SLA)

**Correção:** Adicionar validação de API Key

---

#### 4. `discord-slash-command` - **RISCO MÉDIO**
**Problema:** Não valida assinatura do Discord
**Impacto:** Qualquer pessoa pode enviar comandos falsos

**Correção:**
```typescript
// Adicionar verificação de assinatura Discord (já tem DISCORD_PUBLIC_KEY no env)
const isValid = await verifyDiscordSignature(
  req.headers.get('X-Signature-Ed25519'),
  req.headers.get('X-Signature-Timestamp'),
  bodyText,
  Deno.env.get('DISCORD_PUBLIC_KEY')
);
```

---

### 📋 Alterações Propostas

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/update-message-status/index.ts` | Adicionar validação de API Key `N8N_API_KEY` |
| `supabase/functions/ai-agent-manager-query/index.ts` | Adicionar validação de API Key ou origem interna |
| `supabase/functions/manager-metrics/index.ts` | Adicionar validação de API Key |
| `supabase/functions/manager-smart-alerts/index.ts` | Adicionar validação de API Key |
| `supabase/functions/discord-slash-command/index.ts` | Implementar verificação de assinatura Discord |

---

### 🔒 Funções que Podem Permanecer Públicas

As seguintes funções são **Cron Jobs** que devem ser chamadas internamente (pelo Supabase scheduler via cron.schedule):

- `daily-management-report`
- `process-message-queue`
- `queue-alert`
- `send-scheduled-reports`
- `check-stalled-orders`
- `check-delivery-confirmations`
- `discord-send-digest`

**Recomendação:** Adicionar validação de origem (verificar header `Authorization` com anon key) ou criar um secret `CRON_SECRET` para validar chamadas.

---

### 🛡️ Funções Já Protegidas (Boas Práticas)

| Função | Método de Proteção |
|--------|-------------------|
| `receive-carrier-response` | API Key (`x-api-key` → `N8N_API_KEY`) |
| `receive-lab-update` | Assinatura HMAC (`X-Webhook-Signature` → `LAB_WEBHOOK_SECRET`) |
| `mega-api-webhook` | Validação de `instance_key` (env + banco de dados) |

---

### ⚡ Ordem de Prioridade

1. **Alta** - `update-message-status`, `ai-agent-manager-query`, `manager-metrics`, `manager-smart-alerts`
2. **Média** - `discord-slash-command`, `process-delivery-response`, `notify-lab`
3. **Baixa** - Cron Jobs (adicionar validação é boa prática)

---

### Resultado Esperado

1. APIs sensíveis protegidas contra acessos não autorizados
2. Dados de pedidos, clientes e métricas não ficam expostos publicamente
3. Webhooks externos validam origem antes de processar
4. Logs de tentativas não autorizadas para auditoria
