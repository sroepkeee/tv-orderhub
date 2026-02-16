

## Plano: Corrigir Fluxo de Aprovacao e Convite de Usuarios

### Diagnostico

Foram encontrados **2 problemas distintos** que afetam usuarios novos:

---

### Problema 1: Usuarios aprovados ficam presos na tela "Aguardando Convite"

**Usuarios afetados:**
| Nome | Email | Status | Org Membership |
|------|-------|--------|----------------|
| Julia Farsen | jfarsen@imply.com | approved, is_active=true | **NENHUMA** |
| Carlos Ricardo Bencke | cbencke@imply.com | approved, is_active=true | **NENHUMA** |
| Bryan Lemes | blemes@imply.com | approved, is_active=true | **NENHUMA** |

**Causa raiz:** O `OrganizationGuard` tem um fallback que tenta auto-vincular usuarios aprovados a organizacao unica. Porem, a RLS da tabela `organizations` exige `user_belongs_to_org(id)` para SELECT. Como o usuario **nao tem org**, ele nao consegue ler a tabela `organizations`, o query retorna vazio, e o fallback falha silenciosamente.

```text
Fluxo atual (com falha):

1. Usuario aprovado sem org -> OrganizationGuard
2. Guard checa organization_members -> vazio (correto)
3. Guard checa user_approval_status -> "approved" (correto)
4. Guard tenta SELECT organizations -> VAZIO (RLS bloqueia!)
5. orgs.length !== 1 -> fallback NAO executa
6. Guard mostra tela "Aguardando Convite" -> ERRO
```

**Tambem no UserApprovalDialog:** O INSERT em `organization_members` (linha 147-154) usa o cliente autenticado do admin. Esse insert funciona (admin tem permissao). Porem, possivelmente esta falhando por alguma condicao de `organization` nao carregado no momento da aprovacao.

---

### Problema 2: Erro ao gerar convite

A edge function `send-organization-invite` depende de `RESEND_API_KEY` para envio de email. O secret existe, mas pode haver erro de dominio (usa `noreply@resend.dev` que e restrito). Este e um problema secundario.

---

### Solucao

#### Correcao 1: OrganizationGuard - Usar service role key para auto-link

**Arquivo:** `src/components/onboarding/OrganizationGuard.tsx`

O problema e que o guard usa o cliente Supabase do usuario (com RLS). Para o fallback funcionar, precisamos usar uma abordagem diferente: em vez de tentar ler `organizations` (bloqueada por RLS), chamar uma **edge function** que faz o auto-link com service role.

**Alternativa mais simples:** Criar uma RLS policy que permita usuarios autenticados lerem a tabela `organizations` (apenas id e name). Isso e seguro pois so existe 1 org.

```sql
CREATE POLICY "Authenticated users can view organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (true);
```

Depois, remover a policy restritiva antiga (`Users can view their organization`).

---

#### Correcao 2: Correcao imediata dos 3 usuarios

Executar via SQL (admin) para vincular os 3 usuarios a organizacao Imply:

```sql
INSERT INTO organization_members (organization_id, user_id, role, is_active)
VALUES 
  ('69aed6aa-5300-4e40-b66a-e71f3706db16', '75f07913-9f53-408f-b884-1cf57bffd724', 'member', true),
  ('69aed6aa-5300-4e40-b66a-e71f3706db16', 'a87891a2-e16b-425c-a728-ac9e519f66b5', 'member', true),
  ('69aed6aa-5300-4e40-b66a-e71f3706db16', 'f0a07056-c670-4929-924d-55a911f9d030', 'member', true)
ON CONFLICT DO NOTHING;
```

---

#### Correcao 3: Tornar o UserApprovalDialog mais resiliente

**Arquivo:** `src/components/admin/UserApprovalDialog.tsx`

Adicionar fallback: se `organization.id` nao estiver carregado, buscar diretamente do banco antes de inserir.

```typescript
// Linha 124-135: Melhorar fallback
let orgId = organization?.id;
if (!orgId) {
  // Fallback: buscar org do admin diretamente
  const { data: adminMembership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', currentUser?.id)
    .eq('is_active', true)
    .single();
  orgId = adminMembership?.organization_id;
}

if (!orgId) {
  // Erro real - nao tem como continuar
  toast({ title: "Erro", description: "Organizacao nao encontrada", variant: "destructive" });
  return;
}
```

---

#### Correcao 4: Invite URL incorreta

**Arquivo:** `supabase/functions/send-organization-invite/index.ts` (linha 151)

A URL hardcoded esta errada (`vivo.lovable.app`). Deve usar a URL correta do projeto:

```typescript
// Antes
const inviteUrl = `${req.headers.get('origin') || 'https://vivo.lovable.app'}/auth?...`;

// Depois  
const inviteUrl = `${req.headers.get('origin') || 'https://tv-orderhub.lovable.app'}/auth?...`;
```

---

### Resumo das Alteracoes

| Prioridade | Arquivo/Acao | Descricao |
|------------|-------------|-----------|
| **URGENTE** | Migration SQL | Adicionar RLS policy para `organizations` SELECT |
| **URGENTE** | Migration SQL | Vincular 3 usuarios orfaos a organizacao Imply |
| Alta | `OrganizationGuard.tsx` | Nenhuma mudanca necessaria (RLS fix resolve) |
| Alta | `UserApprovalDialog.tsx` | Adicionar fallback para buscar org do admin diretamente |
| Media | `send-organization-invite/index.ts` | Corrigir URL fallback do convite |

### Resultado Esperado

1. Julia Farsen, Carlos e Bryan acessarao o sistema imediatamente
2. Futuros usuarios aprovados serao auto-vinculados corretamente pelo OrganizationGuard
3. O UserApprovalDialog nao falhara mais se o contexto de organizacao nao estiver carregado
4. Links de convite apontarao para a URL correta

