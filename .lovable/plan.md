
## Plano: Sincronizar Listas de Departamentos e Corrigir Exibição

### Diagnóstico

Dois problemas identificados:

#### Problema 1: Listas de Departamentos Diferentes

| Arquivo | Lista de Departamentos |
|---------|------------------------|
| `DepartmentSelect.tsx` (tabela) | Administração, Almoxarifado Geral, Almoxarifado SSM, Comercial, Compras, Expedição, Faturamento, Financeiro, Laboratório, Logística, Planejamento, Produção, Projetos, **SSM**, Suporte, TI, Outros |
| `EditUserDialog.tsx` (modal) | Comercial, Compras, Expedição, Financeiro, Produção, Projetos, Qualidade, Administrativo, TI, RH, Diretoria |

**O departamento "SSM" do usuário Bryan existe no `DepartmentSelect` mas NÃO existe no `EditUserDialog`**, fazendo com que o Select apareça vazio ao editar.

#### Problema 2: Dados do Usuário Bryan Lemes

| Campo | Valor no Banco |
|-------|----------------|
| Departamento | SSM |
| Roles | almox_ssm (apenas 1) |

O usuário tem apenas 1 role (`almox_ssm`), então a exibição na tabela está correta. Porém, conforme a política de permissões, pode ser necessário atribuir mais roles se o usuário precisar de acesso a outras fases.

---

### Solução

**Arquivo:** `src/components/admin/EditUserDialog.tsx`

Sincronizar a lista de departamentos com a mesma lista do `DepartmentSelect.tsx`:

| Antes (linha 35-47) | Depois |
|---------------------|--------|
| Lista incompleta com 11 departamentos | Lista completa com 17 departamentos |

```typescript
const DEPARTMENTS = [
  'Administração',
  'Almoxarifado Geral',
  'Almoxarifado SSM',
  'Comercial',
  'Compras',
  'Expedição',
  'Faturamento',
  'Financeiro',
  'Laboratório',
  'Logística',
  'Planejamento',
  'Produção',
  'Projetos',
  'SSM',
  'Suporte',
  'TI',
  'Outros'
];
```

---

### Melhoria Adicional: Centralizar Lista de Departamentos

Para evitar inconsistências futuras, criar um arquivo centralizado:

**Novo arquivo:** `src/lib/departments.ts`

```typescript
export const DEPARTMENTS = [
  'Administração',
  'Almoxarifado Geral',
  'Almoxarifado SSM',
  'Comercial',
  'Compras',
  'Expedição',
  'Faturamento',
  'Financeiro',
  'Laboratório',
  'Logística',
  'Planejamento',
  'Produção',
  'Projetos',
  'SSM',
  'Suporte',
  'TI',
  'Outros'
] as const;

export type Department = typeof DEPARTMENTS[number];
```

Depois, importar nos dois componentes:
- `EditUserDialog.tsx`: `import { DEPARTMENTS } from "@/lib/departments"`
- `DepartmentSelect.tsx`: `import { DEPARTMENTS } from "@/lib/departments"`

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/departments.ts` | **Criar** arquivo centralizado com lista de departamentos |
| `src/components/admin/EditUserDialog.tsx` | Remover DEPARTMENTS local e importar de `@/lib/departments` |
| `src/components/admin/DepartmentSelect.tsx` | Remover DEPARTMENTS local e importar de `@/lib/departments` |

---

### Resultado Esperado

1. Ao editar Bryan Lemes, o campo Departamento mostrará "SSM" corretamente
2. Ambos os componentes terão a mesma lista de departamentos
3. Futuras alterações na lista serão feitas em um único lugar
