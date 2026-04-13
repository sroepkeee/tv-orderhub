

## Plano: Melhorar Visibilidade de Pedidos E-commerce e Prioritarios no Modo TV

### Problema

1. **E-commerce pulse quase invisivel**: A animacao `ecommerce-pulse` tem ciclo de 12 segundos e opacidade muito baixa (0.12 a 0.26), tornando-a imperceptivel em telas TV.
2. **Prioridade alta sem piscar**: No modo micro/TV, pedidos de alta prioridade mostram apenas um ponto colorido estatico — sem animacao chamativa.

### Correcoes

#### 1. Tornar o pulse do E-commerce mais agressivo (`tailwind.config.ts`)

- Reduzir ciclo de 12s para **2s** (pisca rapido e visivel)
- Aumentar opacidade do border de 0.12/0.26 para **0.3/0.7**
- Aumentar intensidade do box-shadow de 4px para **8px**
- Adicionar leve mudanca de background-color para reforcar o efeito visual

#### 2. Adicionar animacao pulsante para prioridade alta no modo micro (`KanbanCard.tsx`)

- Quando `priority === 'high'` e `viewMode === 'micro'`, aplicar uma classe `animate-priority-blink` no card
- O ponto de prioridade tambem ganha animacao de scale pulsante

#### 3. Criar keyframe `priority-blink` (`tailwind.config.ts`)

```
"priority-blink": {
  "0%, 100%": { borderColor: "transparent", boxShadow: "none" },
  "50%": { borderColor: "hsl(var(--priority-high))", boxShadow: "0 0 6px 1px hsl(var(--priority-high) / 0.4)" }
}
```
Ciclo de **1.5s** para ser bem visivel em TV.

#### 4. Ajustar cor do E-commerce pulse no CSS (`src/index.css`)

Usar roxo (purple) em vez de vermelho/verde para manter consistencia com a identidade visual do E-commerce no sistema.

### Arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `tailwind.config.ts` | Ajustar keyframe ecommerce-pulse (mais intenso, 2s); adicionar keyframe priority-blink |
| `src/components/KanbanCard.tsx` | Aplicar animate-priority-blink em cards micro com prioridade alta |
| `src/index.css` | Ajustar cor --ecommerce-pulse para roxo consistente |

### Resultado

- Pedidos E-commerce piscarao visivelmente a cada 2s com borda roxa forte
- Pedidos de alta prioridade piscarao com borda vermelha a cada 1.5s
- Ambos os efeitos serao nitidamente visiveis em telas TV a distancia

