import React from "react";
import { Badge } from "@/components/ui/badge";

interface OrderTypeBadgeProps {
  orderType: string;
  category?: string;
  icon?: string;
  displayName?: string;
  size?: "sm" | "md" | "lg";
}

const categoryColors: Record<string, string> = {
  reposicao: "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100",
  vendas: "bg-green-50 text-green-700 border-green-300 hover:bg-green-100",
  operacoes_especiais: "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
};

const typeIcons: Record<string, string> = {
  reposicao_estoque: "📦",
  reposicao_ecommerce: "🛒",
  vendas_balcao: "🏪",
  vendas_ecommerce: "📱",
  transferencia_filial: "🔄",
  remessa_conserto: "🔧"
};

const typeLabels: Record<string, string> = {
  reposicao_estoque: "Reposição de Estoque",
  reposicao_ecommerce: "Reposição E-commerce",
  vendas_balcao: "Vendas Balcão",
  vendas_ecommerce: "Vendas E-commerce",
  transferencia_filial: "Transferência de Filiais",
  remessa_conserto: "Remessa para Conserto",
  // Mapeamento legado
  reposicao: "Reposição de Estoque",
  vendas: "Vendas Balcão",
  transferencia: "Transferência de Filiais",
  ecommerce: "Vendas E-commerce"
};

const getCategoryFromType = (orderType: string): string => {
  if (orderType.startsWith('reposicao')) return 'reposicao';
  if (orderType.startsWith('vendas')) return 'vendas';
  return 'operacoes_especiais';
};

export function OrderTypeBadge({ 
  orderType, 
  category, 
  icon, 
  displayName,
  size = "md" 
}: OrderTypeBadgeProps) {
  const finalCategory = category || getCategoryFromType(orderType);
  const finalIcon = icon || typeIcons[orderType] || "📋";
  const finalDisplayName = displayName || typeLabels[orderType] || orderType;
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };

  return (
    <Badge 
      variant="outline" 
      className={`${categoryColors[finalCategory]} ${sizeClasses[size]} font-medium whitespace-nowrap`}
    >
      <span className="mr-1">{finalIcon}</span>
      {finalDisplayName}
    </Badge>
  );
}
