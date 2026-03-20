

## Plano: Corrigir Usuários Invisíveis (organization_id NULL no profiles)

### Diagnóstico

A usuária **Julia Farsen (jfarsen@imply.com)** existe no sistema, está aprovada e ativa, mas **não aparece** na lista de usuários do Admin nem nas menções (@).

**Causa raiz:** O campo `profiles.organization_id` está **NULL** para 7 usuários, apesar de todos terem vínculo ativo na tabela `organization_members`. A RLS recentemente adicionada (`Org members can view org profiles`) filtra por `organization_id = get_user_organization_id()`, excluindo esses usuários de todas as queries.

| Usuário | Email | organization_id | member_org_id |
|---------|-------|-----------------|---------------|
| Julia Farsen | jfarsen@imply.com | NULL | 69aed6aa... |
| Marcelo Silveira | msilveira@imply.com | NULL | 69aed6aa... |
| compras | compras@imply.com | NULL | 69aed6aa... |
| Luis Sehnem | lsehnem@imply.com | NULL | 69aed6aa... |
| Carlos Bencke | cbencke@imply.com | NULL | 69aed6aa... |
| Lucas Weigel | lweigel@imply.com | NULL | 69aed6aa... |
| Bryan Lemes | blemes@imply.com | NULL | 69aed6aa... |

### Correções

#### 1. Corrigir dados: preencher organization_id dos 7 usuários

Usar o insert tool para atualizar os profiles com o organization_id correto da `organization_members`:

```sql
UPDATE profiles p
SET organization_id = om.organization_id
FROM organization_members om
WHERE om.user_id = p.id
  AND om.is_active = true
  AND p.organization_id IS NULL;
```

#### 2. Prevenir recorrência: adicionar trigger de sincronização

Criar uma migration com trigger que, ao inserir/atualizar `organization_members`, sincroniza automaticamente o `profiles.organization_id`. Isso impede que novos usuários aprovados fiquem com organization_id NULL.

```sql
CREATE OR REPLACE FUNCTION sync_profile_organization_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE profiles SET organization_id = NEW.organization_id
    WHERE id = NEW.user_id AND organization_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_profile_org
AFTER INSERT OR UPDATE ON organization_members
FOR EACH ROW EXECUTE FUNCTION sync_profile_organization_id();
```

### Resumo

| Tipo | Alteração |
|------|-----------|
| **UPDATE dados** | Preencher `profiles.organization_id` para os 7 usuários afetados |
| **Migration** | Trigger para sincronizar automaticamente `profiles.organization_id` ao vincular membro |

### Resultado

- Julia Farsen e os outros 6 usuários aparecerão imediatamente na lista de Admin e nas menções (@)
- Novos usuários nunca mais terão esse problema graças ao trigger de sincronização

