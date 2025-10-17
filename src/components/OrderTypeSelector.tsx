import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface OrderTypeConfig {
  order_type: string;
  display_name: string;
  category: string;
  icon: string;
  description: string;
  default_sla_days: number;
  approval_required: boolean;
  responsible_department: string;
}

interface OrderTypeSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

const categoryLabels: Record<string, string> = {
  reposicao: "Reposição",
  vendas: "Vendas",
  operacoes_especiais: "Operações Especiais"
};

const categoryColors: Record<string, string> = {
  reposicao: "bg-blue-50 text-blue-700 border-blue-300",
  vendas: "bg-green-50 text-green-700 border-green-300",
  operacoes_especiais: "bg-purple-50 text-purple-700 border-purple-300"
};

export function OrderTypeSelector({ value, onValueChange, disabled }: OrderTypeSelectorProps) {
  const [orderTypes, setOrderTypes] = useState<OrderTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<OrderTypeConfig | null>(null);

  useEffect(() => {
    loadOrderTypes();
  }, []);

  useEffect(() => {
    if (value && orderTypes.length > 0) {
      const type = orderTypes.find(t => t.order_type === value);
      setSelectedType(type || null);
    }
  }, [value, orderTypes]);

  const loadOrderTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('order_type_config')
        .select('*')
        .order('category', { ascending: true })
        .order('display_name', { ascending: true });

      if (error) throw error;
      setOrderTypes(data || []);
    } catch (error) {
      console.error('Erro ao carregar tipos de pedido:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedTypes = orderTypes.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, OrderTypeConfig[]>);

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onValueChange} disabled={disabled || loading}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione o tipo de pedido" />
        </SelectTrigger>
        <SelectContent className="max-h-[400px]">
          {Object.entries(groupedTypes).map(([category, types]) => (
            <SelectGroup key={category}>
              <SelectLabel className="flex items-center gap-2 px-2 py-1.5">
                <Badge variant="outline" className={categoryColors[category]}>
                  {categoryLabels[category]}
                </Badge>
              </SelectLabel>
              {types.map((type) => (
                <SelectItem key={type.order_type} value={type.order_type}>
                  <div className="flex items-center gap-2">
                    <span>{type.icon}</span>
                    <div className="flex flex-col">
                      <span className="font-medium">{type.display_name}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {/* Informações do tipo selecionado */}
      {selectedType && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">SLA Padrão:</span>
            <Badge variant="outline">{selectedType.default_sla_days} dias úteis</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Responsável:</span>
            <span className="font-medium">{selectedType.responsible_department}</span>
          </div>
          {selectedType.approval_required && (
            <div className="flex items-center gap-2 text-amber-600">
              <span className="text-lg">⚠️</span>
              <span className="text-xs">Requer aprovação antes do envio</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
