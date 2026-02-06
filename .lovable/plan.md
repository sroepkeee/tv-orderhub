
## Plano: Análise e Correção de Edge Functions Expostas

### ✅ Status: IMPLEMENTADO

---

### 📊 Resumo de Funções Públicas (14 no total)

| Função | Status de Proteção | Risco |
|--------|-------------------|-------|
| `receive-carrier-response` | ✅ **Protegida** - Valida `x-api-key` contra `N8N_API_KEY` | Baixo |
| `receive-lab-update` | ✅ **Protegida** - Valida assinatura HMAC com `LAB_WEBHOOK_SECRET` | Baixo |
| `notify-lab` | ⚠️ **Parcial** - Usa secrets mas não valida chamador | Médio |
| `update-message-status` | ✅ **CORRIGIDO** - Valida `x-api-key` contra `N8N_API_KEY` | Baixo |
| `mega-api-webhook` | ✅ **Protegida** - Valida `instance_key` no banco/env | Baixo |
| `daily-management-report` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `ai-agent-manager-query` | ✅ **CORRIGIDO** - Valida API Key ou origem interna | Baixo |
| `process-message-queue` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `queue-alert` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `send-scheduled-reports` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `manager-metrics` | ✅ **CORRIGIDO** - Valida `x-api-key` contra `N8N_API_KEY` | Baixo |
| `manager-smart-alerts` | ✅ **CORRIGIDO** - Valida `x-api-key` contra `N8N_API_KEY` | Baixo |
| `check-stalled-orders` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `check-delivery-confirmations` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `process-delivery-response` | ⚠️ **Webhook interno** - Chamado pelo mega-api-webhook | Médio |
| `discord-send-digest` | ⚠️ **Cron Job** - Sem validação (interno) | Médio |
| `discord-slash-command` | ✅ **CORRIGIDO** - Verifica assinatura Ed25519 do Discord | Baixo |

---

### ✅ Correções Implementadas

#### 1. `update-message-status`
**Correção:** Adicionada validação de API Key (`x-api-key` → `N8N_API_KEY`)
- Retorna `401 Unauthorized` para requisições sem chave válida
- Logs de tentativas não autorizadas

#### 2. `ai-agent-manager-query`
**Correção:** Validação dupla
- Aceita `x-api-key` válido contra `N8N_API_KEY`
- Aceita header `x-internal-source: mega-api-webhook` para chamadas internas
- Retorna `401 Unauthorized` para outras requisições

#### 3. `manager-metrics`
**Correção:** Adicionada validação de API Key
- Retorna `401 Unauthorized` para requisições sem chave válida

#### 4. `manager-smart-alerts`
**Correção:** Adicionada validação de API Key
- Retorna `401 Unauthorized` para requisições sem chave válida

#### 5. `discord-slash-command`
**Correção:** Implementada verificação de assinatura Ed25519 do Discord
- Usa `DISCORD_PUBLIC_KEY` do ambiente
- Verifica headers `x-signature-ed25519` e `x-signature-timestamp`
- Se a chave não estiver configurada, loga warning mas permite (para facilitar setup inicial)

---

### 🔒 Funções que Podem Permanecer Públicas

As seguintes funções são **Cron Jobs** chamados internamente pelo Supabase scheduler:

- `daily-management-report`
- `process-message-queue`
- `queue-alert`
- `send-scheduled-reports`
- `check-stalled-orders`
- `check-delivery-confirmations`
- `discord-send-digest`

**Recomendação futura:** Adicionar validação de origem ou `CRON_SECRET` para maior segurança.

---

### 📋 Resultado

1. ✅ APIs sensíveis protegidas contra acessos não autorizados
2. ✅ Dados de pedidos, clientes e métricas não ficam expostos publicamente
3. ✅ Webhooks externos validam origem antes de processar
4. ✅ Logs de tentativas não autorizadas para auditoria
