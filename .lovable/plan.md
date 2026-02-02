
## Plano: Corrigir Acesso de Usuários Sem Vínculo com Organização

### Diagnóstico do Problema

O usuário **Luis Sehnem** foi aprovado no sistema em 29/01/2026, mas o vínculo com a organização falhou:

| Verificação | Status |
|-------------|--------|
| Perfil existe e está ativo | ✅ is_active = true |
| Aprovação concluída | ✅ status = approved |
| Roles atribuídas | ✅ 14 roles (muitas!) |
| Vínculo com organização | ❌ organization_members VAZIO |

O **OrganizationGuard** bloqueia o acesso porque:
1. Usuário não está em `organization_members`
2. Usuário não é admin (então não pode criar organização)
3. Resultado: mostra tela "Aguardando Convite"

---

### Causa Raiz

O código de aprovação (`UserApprovalDialog`) insere no `organization_members`, mas depende de:
```typescript
if (!existingMembership && organization?.id) {
  // insert...
}
```

Se o `organization` do admin estivesse `undefined` no momento da aprovação (race condition de loading), o insert não aconteceu silenciosamente.

---

### Solução em 3 Partes

#### Parte 1: Correção Imediata (SQL no Supabase)

Adicionar Luis Sehnem à organização Imply manualmente:

```sql
INSERT INTO organization_members (organization_id, user_id, role, is_active)
VALUES (
  '69aed6aa-5300-4e40-b66a-e71f3706db16', -- Imply org
  'ea43e80b-cad3-48b3-b2eb-e40649a2d16b', -- Luis Sehnem
  'member',
  true
);
```

#### Parte 2: Proteção no Código (Fallback)

**Arquivo:** `src/components/onboarding/OrganizationGuard.tsx`

Adicionar um fallback para usuários legados/aprovados que não têm `organization_members`:

```typescript
// MUDANÇA: Se usuário está aprovado e ativo, mas sem organização,
// vincular automaticamente à organização padrão (se existir apenas uma)

// Após verificar que não tem organization_members:
if (!membership?.organization_id) {
  // Verificar se é usuário aprovado
  const { data: approval } = await supabase
    .from('user_approval_status')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();
  
  // Se está aprovado, tentar vincular à única organização existente
  if (approval?.status === 'approved') {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .limit(2);
    
    // Se existe apenas 1 organização, vincular automaticamente
    if (orgs?.length === 1) {
      await supabase.from('organization_members').insert({
        organization_id: orgs[0].id,
        user_id: user.id,
        role: 'member',
        is_active: true
      });
      
      setHasOrg(true);
      setChecking(false);
      return;
    }
  }
}
```

#### Parte 3: Melhorar Tratamento de Erros na Aprovação

**Arquivo:** `src/components/admin/UserApprovalDialog.tsx`

Tornar o erro de `organization_members` mais visível:

```typescript
// MUDANÇA: Mostrar erro toast se falhar ao vincular organização
if (!existingMembership && organization?.id) {
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({...});

  if (memberError) {
    console.error('Error adding to organization:', memberError);
    toast({
      title: "⚠️ Atenção",
      description: "Usuário aprovado, mas FALHOU ao vincular à organização. Execute o SQL de correção.",
      variant: "destructive",
      duration: 10000, // Manter na tela por mais tempo
    });
  }
} else if (!organization?.id) {
  // NOVO: Alertar se organization não está carregado
  console.error('⚠️ Organization not loaded during approval!');
  toast({
    title: "⚠️ Erro de Organização",
    description: "Não foi possível determinar a organização. Recarregue a página.",
    variant: "destructive",
  });
}
```

---

### Simplificação das Roles do Usuário

O usuário Luis Sehnem tem **14 roles** - isso é excessivo e causa confusão. Conforme a política:

> *"Supervisores devem usar role 'admin' para acesso total ao Kanban"*

**Recomendação:** Remover todas as 14 roles e atribuir apenas `admin`:

```sql
-- Limpar roles antigas
DELETE FROM user_roles 
WHERE user_id = 'ea43e80b-cad3-48b3-b2eb-e40649a2d16b';

-- Atribuir admin
INSERT INTO user_roles (user_id, role)
VALUES ('ea43e80b-cad3-48b3-b2eb-e40649a2d16b', 'admin');
```

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| **SQL Imediato** | INSERT organization_members para Luis Sehnem |
| `src/components/onboarding/OrganizationGuard.tsx` | Adicionar fallback auto-vinculação para usuários aprovados |
| `src/components/admin/UserApprovalDialog.tsx` | Melhorar tratamento de erros e alertas |
| **SQL Opcional** | Simplificar roles do usuário para `admin` |

---

### Benefícios

1. **Correção imediata** - Luis Sehnem volta a acessar o sistema
2. **Prevenção futura** - Fallback garante que usuários aprovados não fiquem bloqueados
3. **Visibilidade de erros** - Admins serão alertados se algo falhar
4. **Simplificação** - Roles claras evitam confusão
