import React, { useMemo } from "react";
import { Order } from "./Dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  PackageSearch,
  FileEdit,
  ShoppingCart,
  Warehouse,
  Factory,
  Package,
  Receipt,
  FlaskConical,
  Box,
  Calculator,
  ClipboardCheck,
  FileText,
  Truck,
  Navigation,
  CheckCircle2,
} from "lucide-react";
import { useVisualMode } from "@/hooks/useVisualMode";

interface MatrixViewProps {
  orders: Order[];
  onOrderClick: (order: Order) => void;
}

interface PhaseConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

// Definir fases na ordem correta do workflow
const phases: PhaseConfig[] = [
  { key: "almox_ssm", label: "Almox SSM", icon: PackageSearch, color: "hsl(var(--phase-almox-ssm))" },
  { key: "order_generation", label: "Gerar Ordem", icon: FileEdit, color: "hsl(var(--phase-order-generation))" },
  { key: "purchases", label: "Compras", icon: ShoppingCart, color: "hsl(var(--phase-purchases))" },
  { key: "almox_general", label: "Almox Geral", icon: Warehouse, color: "hsl(var(--phase-almox-general))" },
  { key: "production_client", label: "Prod. Clientes", icon: Factory, color: "hsl(var(--phase-production-client))" },
  { key: "production_stock", label: "Prod. Estoque", icon: Package, color: "hsl(var(--phase-production-stock))" },
  { key: "balance_generation", label: "Gerar Saldo", icon: Receipt, color: "hsl(var(--phase-balance-generation))" },
  { key: "laboratory", label: "Laboratório", icon: FlaskConical, color: "hsl(var(--phase-laboratory))" },
  { key: "packaging", label: "Embalagem", icon: Box, color: "hsl(var(--phase-packaging))" },
  { key: "freight_quote", label: "Cotação Frete", icon: Calculator, color: "hsl(var(--phase-freight-quote))" },
  { key: "ready_to_invoice", label: "À Faturar", icon: ClipboardCheck, color: "hsl(var(--phase-ready-to-invoice))" },
  { key: "invoicing", label: "Faturamento", icon: FileText, color: "hsl(var(--phase-invoicing))" },
  { key: "logistics", label: "Expedição", icon: Truck, color: "hsl(var(--phase-logistics))" },
  { key: "in_transit", label: "Em Trânsito", icon: Navigation, color: "hsl(var(--phase-in-transit))" },
  { key: "completion", label: "Conclusão", icon: CheckCircle2, color: "hsl(var(--phase-completion))" },
];

// Mapeamento de status para fase
const getPhaseFromStatus = (status: string, orderCategory?: string): string => {
  // Almox SSM
  if (["almox_ssm_pending", "almox_ssm_received", "almox_ssm_in_review", "almox_ssm_approved", "pending"].includes(status)) {
    return "almox_ssm";
  }
  // Gerar Ordem
  if (["order_generation_pending", "order_in_creation", "order_generated"].includes(status)) {
    return "order_generation";
  }
  // Compras
  if (["purchase_pending", "purchase_quoted", "purchase_ordered", "purchase_received"].includes(status)) {
    return "purchases";
  }
  // Almox Geral
  if (["almox_general_received", "almox_general_separating", "almox_general_ready"].includes(status)) {
    return "almox_general";
  }
  // Produção (splitado por category)
  if (["separation_started", "in_production", "awaiting_material", "separation_completed", "production_completed"].includes(status)) {
    return orderCategory === "vendas" ? "production_client" : "production_stock";
  }
  // Gerar Saldo
  if (["balance_calculation", "balance_review", "balance_approved"].includes(status)) {
    return "balance_generation";
  }
  // Laboratório
  if (["awaiting_lab", "in_lab_analysis", "lab_completed"].includes(status)) {
    return "laboratory";
  }
  // Embalagem
  if (["in_quality_check", "in_packaging", "ready_for_shipping"].includes(status)) {
    return "packaging";
  }
  // Cotação de Frete
  if (["freight_quote_requested", "freight_quote_received", "freight_approved"].includes(status)) {
    return "freight_quote";
  }
  // À Faturar
  if (["ready_to_invoice", "pending_invoice_request"].includes(status)) {
    return "ready_to_invoice";
  }
  // Faturamento
  if (["invoice_requested", "awaiting_invoice", "invoice_issued", "invoice_sent"].includes(status)) {
    return "invoicing";
  }
  // Expedição
  if (["released_for_shipping", "in_expedition", "pickup_scheduled", "awaiting_pickup"].includes(status)) {
    return "logistics";
  }
  // Em Trânsito
  if (["in_transit", "collected"].includes(status)) {
    return "in_transit";
  }
  // Conclusão
  if (["delivered", "completed"].includes(status)) {
    return "completion";
  }
  
  return "almox_ssm"; // Default
};

// Componente para a lista de pedidos no tooltip
const PhaseOrdersList = ({ 
  phase, 
  orders, 
  onOrderClick 
}: { 
  phase: PhaseConfig; 
  orders: Order[]; 
  onOrderClick: (order: Order) => void;
}) => {
  if (orders.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4 text-sm">
        Nenhum pedido nesta fase
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="font-semibold border-b pb-2 mb-2 flex items-center gap-2">
        <phase.icon className="h-4 w-4" />
        {phase.label} ({orders.length})
      </div>
      
      <ScrollArea className="max-h-72">
        <div className="space-y-1 pr-2">
          {orders.map(order => {
            // Calcular valor total dos itens
            const totalValue = order.items?.reduce((sum, item) => {
              const qty = item.requestedQuantity || 0;
              // Não temos unit_price no OrderItem, então mostramos apenas quantidade
              return sum;
            }, 0) || 0;
            const itemsCount = order.items?.length || 0;
            
            return (
              <div 
                key={order.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onOrderClick(order);
                }}
                className="p-2 hover:bg-muted rounded-md cursor-pointer transition-colors border border-transparent hover:border-border"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">#{order.orderNumber}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {itemsCount} itens
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {order.client}
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-muted-foreground">
                    Qtd: {order.quantity}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(order.deliveryDeadline).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

// Componente para cada célula de fase
const PhaseCell = ({ 
  phase, 
  orders, 
  onOrderClick,
  isMinimal
}: { 
  phase: PhaseConfig; 
  orders: Order[]; 
  onOrderClick: (order: Order) => void;
  isMinimal: boolean;
}) => {
  const count = orders.length;
  const Icon = phase.icon;
  
  // Determinar cor de fundo baseada na contagem
  const getBgClass = () => {
    if (count === 0) return "bg-muted/30";
    if (isMinimal) return "bg-muted hover:bg-muted/80";
    return "bg-primary/10 hover:bg-primary/20";
  };

  return (
    <div className="flex flex-col items-center">
      {/* Header da fase */}
      <div className="text-[10px] text-muted-foreground text-center mb-1.5 h-10 flex flex-col items-center justify-end">
        <Icon className={`h-4 w-4 mb-0.5 ${count > 0 ? 'text-primary' : 'text-muted-foreground/50'}`} />
        <span className="leading-tight whitespace-nowrap">{phase.label}</span>
      </div>
      
      {/* Número com HoverCard */}
      <HoverCard openDelay={150} closeDelay={100}>
        <HoverCardTrigger asChild>
          <Button 
            variant="ghost" 
            className={`h-12 w-12 rounded-full text-lg font-bold transition-all ${getBgClass()} ${
              count > 0 
                ? 'text-foreground hover:scale-105' 
                : 'text-muted-foreground/40'
            }`}
          >
            {count}
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-72 p-3" side="bottom" align="center">
          <PhaseOrdersList 
            phase={phase} 
            orders={orders} 
            onOrderClick={onOrderClick}
          />
        </HoverCardContent>
      </HoverCard>
    </div>
  );
};

export const MatrixView = ({ orders, onOrderClick }: MatrixViewProps) => {
  const { isMinimal } = useVisualMode();

  // Agrupar pedidos por fase
  const ordersByPhase = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    phases.forEach(p => groups[p.key] = []);
    
    orders.forEach(order => {
      const phase = getPhaseFromStatus(order.status, order.order_category);
      if (groups[phase]) {
        groups[phase].push(order);
      }
    });
    
    return groups;
  }, [orders]);

  // Calcular totais
  const totalOrders = orders.length;
  const activeOrders = orders.filter(o => !["delivered", "completed"].includes(o.status)).length;

  return (
    <div className="space-y-4">
      {/* Header com resumo */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">Visão por Fase</h3>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{activeOrders}</span> ativos de <span className="font-semibold text-foreground">{totalOrders}</span> total
          </span>
        </div>
      </div>

      {/* Grid de fases */}
      <div className={`
        grid gap-2 p-4 rounded-lg border 
        ${isMinimal ? 'bg-background' : 'bg-muted/20'}
      `}
        style={{ 
          gridTemplateColumns: `repeat(${phases.length}, minmax(60px, 1fr))` 
        }}
      >
        {phases.map(phase => (
          <PhaseCell 
            key={phase.key}
            phase={phase}
            orders={ordersByPhase[phase.key]}
            onOrderClick={onOrderClick}
            isMinimal={isMinimal}
          />
        ))}
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-primary/20" />
          <span>Com pedidos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-muted/50" />
          <span>Sem pedidos</span>
        </div>
        <Separator orientation="vertical" className="h-3" />
        <span className="italic">Passe o mouse sobre os números para ver os pedidos</span>
      </div>
    </div>
  );
};
