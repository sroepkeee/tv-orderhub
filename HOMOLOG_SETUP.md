# 🧪 TV OrderHub - Guia de Configuração do Ambiente de Homologação

## 📋 Visão Geral

Este documento descreve os passos necessários para configurar o ambiente de homologação do TV OrderHub.

**URL de Homologação:** `https://tv-orderhub.homolog.lovable.app/`

---

## 🚀 Etapa 1: Criar Projeto Supabase de Homologação

### 1.1. Acessar Supabase Dashboard
1. Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Clique em **"New Project"**
3. Configure:
   - **Organization:** Selecione sua organização
   - **Name:** `tv-orderhub-homolog`
   - **Database Password:** Gere uma senha forte (guarde-a!)
   - **Region:** `South America (São Paulo)` - mesmo da produção
4. Clique em **"Create new project"**
5. Aguarde a criação (aproximadamente 2 minutos)

### 1.2. Obter Credenciais
Após criar o projeto, anote:
- **Project URL:** `https://[PROJECT_ID].supabase.co`
- **Anon Key:** Disponível em Settings → API → `anon` `public`
- **Service Role Key:** Disponível em Settings → API → `service_role` (para Edge Functions)

---

## 🗄️ Etapa 2: Aplicar Migrations (Schema do Banco)

### 2.1. Opção A: Via SQL Editor (Recomendado)
1. Acesse o projeto de homologação no Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute cada migration na ordem numérica:
   - As migrations estão em: `supabase/migrations/`
   - Total: **185 migrations**

### 2.2. Opção B: Via Supabase CLI
```bash
# Instalar Supabase CLI (se não tiver)
npm install -g supabase

# Linkar ao projeto de homologação
supabase link --project-ref [SEU_PROJECT_ID_HOMOLOG]

# Aplicar todas as migrations
supabase db push
```

---

## 📦 Etapa 3: Copiar Dados de Produção

### 3.1. Exportar Dados de Produção
1. Acesse o projeto de **PRODUÇÃO** no Supabase Dashboard
2. Vá em **Settings → Database**
3. Na seção **"Connection string"**, copie a string de conexão
4. Execute no terminal:

```bash
# Exportar dados (apenas dados, sem schema)
pg_dump -h db.wejkyyjhckdlttieuyku.supabase.co \
  -U postgres \
  -d postgres \
  --data-only \
  --no-owner \
  --no-privileges \
  -F c \
  -f producao_dados.dump
```

### 3.2. Importar em Homologação
```bash
# Importar dados no projeto de homologação
pg_restore -h db.[SEU_PROJECT_ID_HOMOLOG].supabase.co \
  -U postgres \
  -d postgres \
  --data-only \
  --no-owner \
  --no-privileges \
  producao_dados.dump
```

---

## 🔐 Etapa 4: Configurar Secrets (Edge Functions)

Os secrets são **iguais** aos de produção. Configure-os no projeto de homologação:

### Via Dashboard:
1. Acesse **Settings → Edge Functions → Secrets**
2. Adicione cada secret:

| Secret Name | Descrição | Valor |
|-------------|-----------|-------|
| `LAB_API_KEY` | Chave API do Laboratório | Copiar de produção |
| `LAB_WEBHOOK_URL` | Webhook do Laboratório | Copiar de produção |
| `MEGA_API_INSTANCE` | ID da instância Mega API | Copiar de produção |
| `MEGA_API_TOKEN` | Token Mega API | Copiar de produção |
| `MEGA_API_URL` | URL base Mega API | Copiar de produção |
| `N8N_API_KEY` | Chave API n8n | Copiar de produção |
| `N8N_WEBHOOK_URL` | Webhook n8n | Copiar de produção |
| `OPENAI_API_KEY` | Chave OpenAI | Copiar de produção |
| `RESEND_API_KEY` | Chave Resend (e-mail) | Copiar de produção |

### Via CLI:
```bash
supabase secrets set LAB_API_KEY="valor"
supabase secrets set MEGA_API_TOKEN="valor"
# ... repetir para cada secret
```

---

## ⚡ Etapa 5: Deploy das Edge Functions

### 5.1. Lista das 28 Edge Functions

| Função | Descrição |
|--------|-----------|
| `ai-agent-analyze-image` | Análise de imagens via IA |
| `ai-agent-auto-reply` | Resposta automática WhatsApp |
| `ai-agent-conversation-summary` | Resumo de conversas |
| `ai-agent-generate-message` | Geração de mensagens IA |
| `ai-agent-logistics-reply` | Resposta para logística |
| `ai-agent-manager-query` | Consultas do gestor |
| `ai-agent-notify` | Notificações IA |
| `ai-agent-rag-search` | Busca RAG |
| `check-stalled-orders` | Verificar pedidos parados |
| `daily-management-report` | Relatório diário |
| `generate-chart` | Geração de gráficos |
| `manager-metrics` | Métricas do gestor |
| `manager-smart-alerts` | Alertas inteligentes |
| `mega-api-logout` | Logout Mega API |
| `mega-api-qrcode` | QR Code WhatsApp |
| `mega-api-restart-instance` | Reiniciar instância |
| `mega-api-send-media` | Enviar mídia WhatsApp |
| `mega-api-send` | Enviar mensagem WhatsApp |
| `mega-api-status` | Status da conexão |
| `mega-api-test-webhook` | Testar webhook |
| `mega-api-update-instance` | Atualizar instância |
| `mega-api-webhook` | Receber webhooks |
| `notify-lab` | Notificar laboratório |
| `notify-phase-manager` | Notificar gestor de fase |
| `notify-purchases` | Notificar compras |
| `process-change-request` | Processar alterações |
| `process-message-queue` | Processar fila de mensagens |
| `process-pending-replies` | Processar respostas pendentes |
| `queue-alert` | Alertas de fila |
| `receive-carrier-response` | Receber resposta transportadora |
| `receive-lab-update` | Receber atualização lab |
| `send-carrier-message` | Enviar msg transportadora |
| `send-freight-quote` | Enviar cotação frete |
| `send-scheduled-reports` | Relatórios agendados |
| `update-message-status` | Atualizar status mensagem |

### 5.2. Deploy via CLI
```bash
# Deploy de todas as funções
supabase functions deploy --project-ref [SEU_PROJECT_ID_HOMOLOG]

# Ou deploy individual
supabase functions deploy ai-agent-auto-reply --project-ref [SEU_PROJECT_ID_HOMOLOG]
```

---

## 🌐 Etapa 6: Configurar Front-end (Lovable)

### 6.1. Criar Deploy de Homologação no Lovable
1. No Lovable, acesse **Project Settings**
2. Crie um novo deploy/branch para homologação
3. Configure as variáveis de ambiente:

```env
VITE_ENVIRONMENT=homolog
VITE_SUPABASE_PROJECT_ID=[SEU_PROJECT_ID_HOMOLOG]
VITE_SUPABASE_PUBLISHABLE_KEY=[SUA_ANON_KEY_HOMOLOG]
VITE_SUPABASE_URL=https://[SEU_PROJECT_ID_HOMOLOG].supabase.co
```

### 6.2. URL Final
Após configuração, a homologação estará disponível em:
- **https://tv-orderhub.homolog.lovable.app/**

---

## ✅ Checklist de Validação

Após completar a configuração, valide:

- [ ] Login funciona (autenticação)
- [ ] Dashboard carrega pedidos
- [ ] Kanban exibe corretamente
- [ ] Conexão WhatsApp funciona
- [ ] Edge Functions respondem
- [ ] Badge "🧪 HOMOLOGAÇÃO" aparece no canto superior direito

---

## 🔄 Sincronização de Dados (Futuro)

Para manter homologação atualizada com produção:

### Script de Sincronização
```bash
#!/bin/bash
# sync_homolog.sh

# 1. Exportar de produção
pg_dump -h db.wejkyyjhckdlttieuyku.supabase.co \
  -U postgres -d postgres --data-only -F c -f /tmp/prod_data.dump

# 2. Limpar homolog (cuidado!)
psql -h db.[HOMOLOG_ID].supabase.co -U postgres -d postgres \
  -c "TRUNCATE TABLE orders, order_items, carrier_conversations CASCADE;"

# 3. Importar em homolog
pg_restore -h db.[HOMOLOG_ID].supabase.co -U postgres -d postgres \
  --data-only /tmp/prod_data.dump

# 4. Limpar arquivo temporário
rm /tmp/prod_data.dump
```

---

## 📞 Suporte

Em caso de dúvidas:
- Documentação Supabase: https://supabase.com/docs
- Lovable Docs: https://docs.lovable.dev

---

**Última atualização:** Dezembro 2024
