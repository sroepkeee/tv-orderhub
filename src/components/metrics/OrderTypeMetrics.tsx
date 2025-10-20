import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import type { Order } from "@/components/Dashboard";

interface OrderTypeMetricsProps {
  orders: Order[];
}

const categoryLabels: Record<string, string> = {
  reposicao: "Reposição",
  vendas: "Vendas",
  operacoes_especiais: "Operações Especiais"
};

const categoryColors: Record<string, string> = {
  reposicao: "#3b82f6",
  vendas: "#10b981",
  operacoes_especiais: "#8b5cf6"
};

const typeLabels: Record<string, string> = {
  reposicao_estoque: "📦 Reposição Estoque",
  reposicao_ecommerce: "🛒 Reposição E-commerce",
  vendas_balcao: "🏪 Vendas Balcão",
  vendas_ecommerce: "📱 Vendas E-commerce",
  transferencia_filial: "🔄 Transferência",
  remessa_conserto: "🔧 Conserto"
};

export function OrderTypeMetrics({ orders }: OrderTypeMetricsProps) {
  // Agrupar por categoria
  const byCategory = orders.reduce((acc, order) => {
    const category = order.order_category || 'outros';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.entries(byCategory).map(([category, count]) => ({
    name: categoryLabels[category] || category,
    value: count,
    color: categoryColors[category] || "#94a3b8"
  }));

  // Agrupar por tipo
  const byType = orders.reduce((acc, order) => {
    const type = order.type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeData = Object.entries(byType)
    .map(([type, count]) => ({
      name: typeLabels[type] || type,
      count
    }))
    .sort((a, b) => b.count - a.count);

  // Calcular tempo médio por categoria
  const avgTimeByCategory = orders.reduce((acc, order) => {
    const category = order.order_category || 'outros';
    if (!acc[category]) {
      acc[category] = { total: 0, count: 0 };
    }
    
    const daysOpen = order.daysOpen || 0;
    acc[category].total += daysOpen;
    acc[category].count += 1;
    
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const avgTimeData = Object.entries(avgTimeByCategory).map(([category, data]) => ({
    name: categoryLabels[category] || category,
    avg: Math.round(data.total / data.count),
    color: categoryColors[category] || "#94a3b8"
  }));

  // SLA por categoria (de acordo com os requisitos)
  const categorySLA: Record<string, number> = {
    operacoes_especiais: 7,
    reposicao: 7,
    vendas: 2,
    outros: 7
  };

  const slaData = Object.entries(categorySLA).map(([category, sla]) => ({
    name: categoryLabels[category] || category,
    sla,
    color: categoryColors[category] || "#94a3b8"
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Volume por Categoria - Gráfico de Pizza */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Volume por Categoria</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-2">
          {categoryData.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: cat.color }}
                />
                <span>{cat.name}</span>
              </div>
              <Badge variant="outline">{cat.value} pedidos</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Volume por Tipo - Gráfico de Barras */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Volume por Tipo</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={typeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              height={100}
              tick={{ fontSize: 11 }}
            />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Tempo Médio por Categoria */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Tempo Médio por Categoria</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={avgTimeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis label={{ value: 'Dias', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Bar dataKey="avg" fill="#10b981">
              {avgTimeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* SLA Padrão por Categoria */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">SLA Padrão por Categoria</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={slaData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis label={{ value: 'Dias Úteis', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Bar dataKey="sla" fill="#8b5cf6">
              {slaData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-2">
          <div className="text-xs text-muted-foreground">
            <strong>SLA Configurado:</strong>
          </div>
          {slaData.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: cat.color }}
                />
                <span>{cat.name}</span>
              </div>
              <Badge variant="outline">{cat.sla} dias úteis</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Resumo Estatístico */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Resumo Estatístico</h3>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground mb-2">Total de Pedidos</div>
            <div className="text-3xl font-bold">{orders.length}</div>
          </div>
          
          <div className="border-t pt-4">
            <div className="text-sm font-medium mb-3">Por Categoria</div>
            <div className="space-y-2">
              {categoryData.map((cat) => {
                const percentage = ((cat.value / orders.length) * 100).toFixed(1);
                return (
                  <div key={cat.name} className="flex items-center justify-between">
                    <span className="text-sm">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cat.value}</span>
                      <span className="text-xs text-muted-foreground">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="text-sm font-medium mb-3">Tipos Mais Comuns</div>
            <div className="space-y-2">
              {typeData.slice(0, 3).map((type, index) => (
                <div key={type.name} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                  <span className="text-sm flex-1 truncate">{type.name}</span>
                  <span className="text-sm font-medium">{type.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
