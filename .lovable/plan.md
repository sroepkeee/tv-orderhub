

## Plano: Corrigir Usuários Pendentes Invisíveis na Tabela de Admin

### Diagnóstico

A usuária pendente é **Letícia Rodrigues Vieira (leticiavieira@imply.com)**, criada em 31/03/2026.

**Causa raiz**: A RLS policy `"Org members can view org profiles"` na tabela `profiles` exige `organization_id = get_user_organization_id()`. Como Letícia tem `organization_id = NULL` e nenhum registro em `organization_members`, seu perfil é **invisível** para o admin via RLS. O badge mostra "1 pendente" porque `user_approval_status` tem policy própria que permite admins verem tudo, mas o JOIN com `profiles` no frontend retorna vazio.

### Correções

#### 1. Adicionar RLS policy para admins verem todos os profiles

Criar nova policy na tabela `profiles`:

```sql
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
```

Isso permite que admins vejam TODOS os perfis, incluindo os com `organization_id = NULL`.

#### 2. Corrigir dados da Letícia (imediato)

Buscar o `organization_id` da organização existente e:
- Inserir registro em `organization_members`
- Atualizar `profiles.organization_id`

Isso será feito via INSERT/UPDATE direto.

#### 3. Robustecer o fluxo de aprovação (`UserApprovalDialog.tsx`)

Adicionar lógica no `handleApprove` para garantir que, ao aprovar um usuário com `organization_id = NULL`:
- Buscar a organização do admin logado
- Criar o registro em `organization_members`
- Atualizar `profiles.organization_id`

Isso já existe parcialmente mas pode falhar silenciosamente. Adicionar tratamento explícito.

### Resumo

| Tipo | Alteração |
|------|-----------|
| **Migration** | Nova RLS policy: admins podem ver todos os profiles |
| **UPDATE dados** | Corrigir Letícia: preencher organization_id e organization_members |
| **Código** | Robustecer UserApprovalDialog para sempre vincular org ao aprovar |

### Resultado

- Usuários pendentes (sem org) serão visíveis na tabela de admin
- A aprovação sempre vinculará o usuário à organização automaticamente
- Novos registros nunca mais ficarão "invisíveis"

