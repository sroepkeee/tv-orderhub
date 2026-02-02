
## Plano: Corrigir Role do Usuário Luis Antonio Sehnem

### Situação Atual

| Campo | Valor |
|-------|-------|
| **Usuário** | Luis Antonio Sehnem |
| **Departamento** | Projetos |
| **is_active** | ❌ false (precisa corrigir) |
| **Roles atuais** | 16 roles (incluindo `admin` indevidamente) |

### O Que Aconteceu

A migration anterior (`20260202183548`) executou:
```sql
DELETE FROM user_roles WHERE user_id = '...';
INSERT INTO user_roles (user_id, role) VALUES ('...', 'admin');
```

Porém as roles antigas (15 operacionais) já tinham sido restauradas de alguma forma, e agora ele tem **16 roles** incluindo `admin`.

### Correção Necessária

**Apenas remover a role `admin`** - manter todas as outras 15 roles operacionais que o usuário precisa:

```sql
-- Remover APENAS a role admin
DELETE FROM user_roles 
WHERE user_id = 'ea43e80b-cad3-48b3-b2eb-e40649a2d16b'
AND role = 'admin';

-- Reativar o perfil (is_active = false)
UPDATE profiles 
SET is_active = true 
WHERE id = 'ea43e80b-cad3-48b3-b2eb-e40649a2d16b';
```

### Roles que Permanecerão

| Role | Área |
|------|------|
| almox_ssm | Almoxarifado |
| order_generation | Planejamento |
| almox_general | Almoxarifado |
| production_client | Produção |
| production_stock | Produção |
| purchases | Suprimentos |
| balance_generation | Financeiro |
| laboratory | Laboratório |
| packaging | Expedição |
| freight_quote | Comercial |
| ready_to_invoice | Financeiro |
| invoicing | Financeiro |
| logistics | Expedição |
| in_transit | Expedição |
| completion | Finalização |

---

### Resumo da Alteração

| Tipo | Ação |
|------|------|
| **SQL** | Remover role `admin` e reativar perfil |

### Resultado Esperado

- Luis Sehnem terá acesso às 15 fases conforme suas roles operacionais
- Não terá mais privilégios de administrador
- Perfil estará ativo novamente
