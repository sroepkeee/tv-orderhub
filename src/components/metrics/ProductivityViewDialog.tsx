import { useState, useMemo } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download, FileSpreadsheet, BarChart3, Users, TrendingUp, X, Filter, Package, Clock, Target, Cpu } from "lucide-react";
import { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  useProductivityMetrics,
  type ProductivityView,
  type ProductivityRow,
} from "@/hooks/useProductivityMetrics";
import { useProductivityByType } from "@/hooks/useProductivityByType";
import { useProductivitySLA } from "@/hooks/useProductivitySLA";
import { useProductivityCycleTime } from "@/hooks/useProductivityCycleTime";
import { useProductivityComplexity } from "@/hooks/useProductivityComplexity";
import { ProductivityOrdersSheet } from "./ProductivityOrdersSheet";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface ProductivityViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabKey = ProductivityView | "by_type" | "sla" | "complexity";

const VIEW_LABELS: Record<ProductivityView, string> = {
  imported: "Importados",
  invoice_requested: "Solicitados Faturamento",
  completed: "Concluídos",
};

const VIEW_FILE_NAMES: Record<ProductivityView, string> = {
  imported: "Importados",
  invoice_requested: "Faturamento",
  completed: "Concluidos",
};

const TYPE_LABELS: Record<string, string> = {
  reposicao_estoque: "Reposição Estoque",
  reposicao_ecommerce: "Reposição E-commerce",
  vendas_balcao: "Vendas Balcão",
  vendas_ecommerce: "Vendas E-commerce",
  transferencia_filial: "Transferência",
  remessa_conserto: "Remessa Conserto",
  reposicao: "Reposição",
  vendas: "Vendas",
  ecommerce: "E-commerce",
  transferencia: "Transferência",
  unknown: "Sem tipo",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "hsl(var(--destructive))",
  high: "hsl(25 95% 53%)",
  normal: "hsl(var(--primary))",
  low: "hsl(var(--muted-foreground))",
};

const labelType = (t: string) => TYPE_LABELS[t] || t;
const labelPriority = (p: string) => PRIORITY_LABELS[p] || p;

export function ProductivityViewDialog({ open, onOpenChange }: ProductivityViewDialogProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("imported");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Filtros globais (aplicados em todas as abas)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);

  // Drill-down sheet (lista de pedidos individuais)
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillContext, setDrillContext] = useState<{
    title: string;
    subtitle?: string;
    userIds?: string[];
    orderTypes?: string[];
    priorities?: string[];
  }>({ title: "" });

  const openDrill = (ctx: typeof drillContext) => {
    setDrillContext(ctx);
    setDrillOpen(true);
  };

  const importedQuery = useProductivityMetrics({
    view: "imported",
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    enabled: open,
  });
  const invoiceQuery = useProductivityMetrics({
    view: "invoice_requested",
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    enabled: open,
  });
  const completedQuery = useProductivityMetrics({
    view: "completed",
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    enabled: open,
  });
  const byTypeQuery = useProductivityByType({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    enabled: open,
  });
  const slaQuery = useProductivitySLA({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    enabled: open && (activeTab === "sla"),
  });
  const cycleQuery = useProductivityCycleTime({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    enabled: open && (activeTab === "sla" || activeTab === "complexity"),
  });
  const complexityQuery = useProductivityComplexity({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    enabled: open && activeTab === "complexity",
  });

  // ===== Chave normalizada por usuário (resolve user_id null vs preenchido entre views) =====
  const userKey = (userId: string | null | undefined, email?: string | null, name?: string | null): string => {
    if (userId) return `id:${userId}`;
    if (email) return `email:${email.trim().toLowerCase()}`;
    if (name) return `name:${name.trim().toLowerCase()}`;
    return "name:desconhecido";
  };

  // ===== Listas únicas — consolidadas de TODAS as queries carregadas =====
  const allUsers = useMemo(() => {
    const map = new Map<string, string>();
    const collect = (rows: Array<{ user_id: string | null; user_name: string; user_email: string | null }> | undefined) => {
      (rows || []).forEach((r) => {
        const key = userKey(r.user_id, r.user_email, r.user_name);
        if (!map.has(key)) map.set(key, r.user_name || "Desconhecido");
      });
    };
    collect(byTypeQuery.data);
    collect(importedQuery.data);
    collect(invoiceQuery.data);
    collect(completedQuery.data);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [byTypeQuery.data, importedQuery.data, invoiceQuery.data, completedQuery.data]);

  const allTypes = useMemo(() => {
    const set = new Set<string>();
    (byTypeQuery.data || []).forEach((r) => set.add(r.order_type));
    return Array.from(set).sort();
  }, [byTypeQuery.data]);

  const allPriorities = useMemo(() => {
    const set = new Set<string>();
    (byTypeQuery.data || []).forEach((r) => set.add(r.priority));
    return Array.from(set).sort();
  }, [byTypeQuery.data]);

  // ===== Aplicação dos filtros =====
  const matchesFilters = (
    userId: string | null,
    userName: string,
    type?: string,
    priority?: string,
    email?: string | null,
  ) => {
    if (selectedUsers.length > 0) {
      const key = userKey(userId, email, userName);
      if (!selectedUsers.includes(key)) return false;
    }
    if (type !== undefined && selectedTypes.length > 0 && !selectedTypes.includes(type)) return false;
    if (priority !== undefined && selectedPriorities.length > 0 && !selectedPriorities.includes(priority)) return false;
    return true;
  };

  // Para abas simples (imported/invoice_requested/completed) aplicamos APENAS o filtro de usuário
  // (o dataset não tem tipo/prioridade). Tipo/prioridade só afetam a aba "Por Tipo".
  const filterSimple = (rows: ProductivityRow[]) =>
    rows.filter((r) => matchesFilters(r.user_id, r.user_name, undefined, undefined, r.user_email));

  const filteredImported = useMemo(() => filterSimple(importedQuery.data || []), [importedQuery.data, selectedUsers]);
  const filteredInvoice = useMemo(() => filterSimple(invoiceQuery.data || []), [invoiceQuery.data, selectedUsers]);
  const filteredCompleted = useMemo(() => filterSimple(completedQuery.data || []), [completedQuery.data, selectedUsers]);

  const filteredByType = useMemo(() => {
    return (byTypeQuery.data || []).filter((r) =>
      matchesFilters(r.user_id, r.user_name, r.order_type, r.priority, r.user_email)
    );
  }, [byTypeQuery.data, selectedUsers, selectedTypes, selectedPriorities]);

  const queries = {
    imported: { data: filteredImported, isLoading: importedQuery.isLoading },
    invoice_requested: { data: filteredInvoice, isLoading: invoiceQuery.isLoading },
    completed: { data: filteredCompleted, isLoading: completedQuery.isLoading },
  };

  const isSimpleTab = activeTab === "imported" || activeTab === "invoice_requested" || activeTab === "completed";
  const simpleView = (isSimpleTab ? activeTab : "imported") as ProductivityView;
  const currentData = queries[simpleView]?.data ?? [];
  const isLoading = isSimpleTab
    ? (queries[simpleView]?.isLoading ?? false)
    : activeTab === "by_type"
      ? byTypeQuery.isLoading
      : false;

  // ===== Agregações para abas simples =====
  const byUser = useMemo(() => {
    const map = new Map<string, { user_name: string; user_email: string | null; total: number }>();
    currentData.forEach((row) => {
      const key = userKey(row.user_id, row.user_email, row.user_name);
      const existing = map.get(key);
      if (existing) {
        existing.total += row.count;
      } else {
        map.set(key, { user_name: row.user_name, user_email: row.user_email, total: row.count });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [currentData]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    currentData.forEach((row) => {
      map.set(row.date, (map.get(row.date) || 0) + row.count);
    });
    return Array.from(map.entries())
      .map(([date, total]) => ({
        date: format(new Date(date), "dd/MM", { locale: ptBR }),
        rawDate: date,
        total,
      }))
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [currentData]);

  const totalCount = useMemo(() => currentData.reduce((s, r) => s + r.count, 0), [currentData]);
  const dailyAvg = byDay.length > 0 ? Math.round(totalCount / byDay.length) : 0;
  const topUser = byUser[0];

  // ===== Agregações para "Por Tipo" =====
  const byTypeAgg = useMemo(() => {
    const map = new Map<string, { type: string; imported: number; invoiced: number; completed: number }>();
    filteredByType.forEach((r) => {
      const existing = map.get(r.order_type);
      if (existing) {
        existing.imported += r.orders_imported;
        existing.invoiced += r.orders_invoice_requested;
        existing.completed += r.orders_completed;
      } else {
        map.set(r.order_type, {
          type: r.order_type,
          imported: r.orders_imported,
          invoiced: r.orders_invoice_requested,
          completed: r.orders_completed,
        });
      }
    });
    return Array.from(map.values())
      .map((v) => ({ ...v, label: labelType(v.type) }))
      .sort((a, b) => b.imported - a.imported);
  }, [filteredByType]);

  const byPriorityAgg = useMemo(() => {
    const map = new Map<string, number>();
    filteredByType.forEach((r) => {
      map.set(r.priority, (map.get(r.priority) || 0) + r.orders_imported);
    });
    return Array.from(map.entries())
      .map(([priority, total]) => ({ priority, label: labelPriority(priority), total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredByType]);

  const byUserTypeAgg = useMemo(() => {
    // matriz usuário x tipo
    const userMap = new Map<string, { user_name: string; user_email: string | null; total: number; types: Map<string, number> }>();
    filteredByType.forEach((r) => {
      const key = userKey(r.user_id, r.user_email, r.user_name);
      let entry = userMap.get(key);
      if (!entry) {
        entry = { user_name: r.user_name, user_email: r.user_email, total: 0, types: new Map() };
        userMap.set(key, entry);
      }
      entry.total += r.orders_imported;
      entry.types.set(r.order_type, (entry.types.get(r.order_type) || 0) + r.orders_imported);
    });
    return Array.from(userMap.values()).sort((a, b) => b.total - a.total);
  }, [filteredByType]);

  const byTypeTotalImported = useMemo(
    () => filteredByType.reduce((s, r) => s + r.orders_imported, 0),
    [filteredByType]
  );

  // ===== Agregações SLA =====
  const filteredSLA = useMemo(() => {
    return (slaQuery.data || []).filter((r) =>
      matchesFilters(r.user_id, r.user_name, r.order_type, r.priority, r.user_email)
    );
  }, [slaQuery.data, selectedUsers, selectedTypes, selectedPriorities]);

  const slaTotals = useMemo(() => {
    let totalCompleted = 0,
      onTime = 0,
      late = 0,
      atRisk = 0;
    filteredSLA.forEach((r) => {
      totalCompleted += r.total_completed;
      onTime += r.on_time_count;
      late += r.late_count;
      atRisk += r.sla_at_risk;
    });
    const onTimePct = totalCompleted > 0 ? (onTime / totalCompleted) * 100 : 0;
    return { totalCompleted, onTime, late, atRisk, onTimePct };
  }, [filteredSLA]);

  const slaByUser = useMemo(() => {
    const map = new Map<string, { user_name: string; total: number; onTime: number; late: number }>();
    filteredSLA.forEach((r) => {
      const key = userKey(r.user_id, r.user_email, r.user_name);
      let entry = map.get(key);
      if (!entry) {
        entry = { user_name: r.user_name, total: 0, onTime: 0, late: 0 };
        map.set(key, entry);
      }
      entry.total += r.total_completed;
      entry.onTime += r.on_time_count;
      entry.late += r.late_count;
    });
    return Array.from(map.values())
      .map((u) => ({ ...u, pct: u.total > 0 ? (u.onTime / u.total) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [filteredSLA]);

  // Cycle time
  const filteredCycle = useMemo(() => {
    return (cycleQuery.data || []).filter((r) =>
      matchesFilters(r.user_id, r.user_name, r.order_type, r.priority, r.user_email)
    );
  }, [cycleQuery.data, selectedUsers, selectedTypes, selectedPriorities]);

  const cycleAvg = useMemo(() => {
    const valid = filteredCycle.filter((r) => r.avg_cycle_days !== null);
    if (valid.length === 0) return null;
    const totalOrders = valid.reduce((s, r) => s + r.orders_count, 0);
    const weighted = valid.reduce(
      (s, r) => s + (r.avg_cycle_days || 0) * r.orders_count,
      0
    );
    return totalOrders > 0 ? weighted / totalOrders : null;
  }, [filteredCycle]);

  // ===== Agregações Complexidade =====
  const filteredComplexity = useMemo(() => {
    return (complexityQuery.data || []).filter((r) =>
      matchesFilters(r.user_id, r.user_name, r.order_type, undefined, r.user_email)
    );
  }, [complexityQuery.data, selectedUsers, selectedTypes]);

  const complexityTotals = useMemo(() => {
    let totalOrders = 0,
      firmware = 0,
      image = 0,
      complex = 0,
      lab = 0;
    filteredComplexity.forEach((r) => {
      totalOrders += r.total_orders;
      firmware += r.requires_firmware_count;
      image += r.requires_image_count;
      complex += r.technical_complex_count;
      lab += r.lab_processed_count;
    });
    const complexPct = totalOrders > 0 ? (complex / totalOrders) * 100 : 0;
    return { totalOrders, firmware, image, complex, lab, complexPct };
  }, [filteredComplexity]);

  const complexityByUser = useMemo(() => {
    const map = new Map<string, { user_name: string; total: number; firmware: number; image: number; lab: number }>();
    filteredComplexity.forEach((r) => {
      const key = userKey(r.user_id, r.user_email, r.user_name);
      let entry = map.get(key);
      if (!entry) {
        entry = { user_name: r.user_name, total: 0, firmware: 0, image: 0, lab: 0 };
        map.set(key, entry);
      }
      entry.total += r.total_orders;
      entry.firmware += r.requires_firmware_count;
      entry.image += r.requires_image_count;
      entry.lab += r.lab_processed_count;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredComplexity]);

  // ===== Toggles de filtros (para chips clicáveis) =====
  const toggleArr = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const clearAllFilters = () => {
    setSelectedUsers([]);
    setSelectedTypes([]);
    setSelectedPriorities([]);
  };

  const activeFilterCount = selectedUsers.length + selectedTypes.length + selectedPriorities.length;

  // ===== Exports =====
  const exportSingleCSV = () => {
    if (isSimpleTab) {
      if (!currentData.length) {
        toast({ title: "Nenhum dado para exportar", variant: "destructive" });
        return;
      }
      const headers = ["Data", "Usuário", "Email", "Quantidade"];
      if (simpleView === "imported") headers.push("Clientes Únicos");
      const rows = currentData.map((r) => {
        const base = [r.date, r.user_name, r.user_email || "", r.count.toString()];
        if (simpleView === "imported") base.push((r.unique_customers ?? 0).toString());
        return base;
      });
      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `produtividade_${VIEW_FILE_NAMES[simpleView]}_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV exportado com sucesso" });
    } else {
      // Por Tipo
      if (!filteredByType.length) {
        toast({ title: "Nenhum dado para exportar", variant: "destructive" });
        return;
      }
      const headers = ["Data", "Usuário", "Email", "Tipo", "Categoria", "Prioridade", "Importados", "Faturamento", "Concluídos"];
      const rows = filteredByType.map((r) => [
        r.activity_date,
        r.user_name,
        r.user_email || "",
        labelType(r.order_type),
        r.order_category,
        labelPriority(r.priority),
        r.orders_imported.toString(),
        r.orders_invoice_requested.toString(),
        r.orders_completed.toString(),
      ]);
      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `produtividade_PorTipo_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV exportado com sucesso" });
    }
  };

  const exportAllExcel = () => {
    const datasets: Array<{ name: string; rows: ProductivityRow[]; view: ProductivityView }> = [
      { name: "Importados", rows: filteredImported, view: "imported" },
      { name: "Faturamento", rows: filteredInvoice, view: "invoice_requested" },
      { name: "Concluidos", rows: filteredCompleted, view: "completed" },
    ];

    const wb = XLSX.utils.book_new();
    datasets.forEach(({ name, rows, view }) => {
      const data = rows.map((r) => {
        const obj: Record<string, any> = {
          Data: r.date,
          Usuário: r.user_name,
          Email: r.user_email || "",
          Quantidade: r.count,
        };
        if (view === "imported") obj["Clientes Únicos"] = r.unique_customers ?? 0;
        return obj;
      });
      const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Info: "Sem dados no período" }]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });

    // Aba Por Tipo
    const byTypeData = filteredByType.map((r) => ({
      Data: r.activity_date,
      Usuário: r.user_name,
      Email: r.user_email || "",
      Tipo: labelType(r.order_type),
      Categoria: r.order_category,
      Prioridade: labelPriority(r.priority),
      Importados: r.orders_imported,
      Faturamento: r.orders_invoice_requested,
      Concluídos: r.orders_completed,
    }));
    const wsType = XLSX.utils.json_to_sheet(byTypeData.length ? byTypeData : [{ Info: "Sem dados no período" }]);
    XLSX.utils.book_append_sheet(wb, wsType, "Por Tipo");

    XLSX.writeFile(wb, `produtividade_completo_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Excel exportado com sucesso" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Visão Produtividade — Pós-Venda
          </DialogTitle>
          <DialogDescription>
            Acompanhe a produtividade do time por período, com filtros dinâmicos por usuário, tipo e prioridade.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros + Exportar */}
        <div className="space-y-3 border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} —{" "}
                          {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                      )
                    ) : (
                      <span>Selecione o período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              {/* Filtro Usuários */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Users className="mr-2 h-4 w-4" />
                    Usuários
                    {selectedUsers.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{selectedUsers.length}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <ScrollArea className="h-64">
                    <div className="p-2 space-y-1">
                      {allUsers.length === 0 ? (
                        <div className="text-xs text-muted-foreground px-2 py-4 text-center">
                          Sem usuários no período
                        </div>
                      ) : (
                        allUsers.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                            onClick={() => toggleArr(selectedUsers, u.id, setSelectedUsers)}
                          >
                            <Checkbox checked={selectedUsers.includes(u.id)} />
                            <span className="text-sm truncate">{u.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* Filtro Tipos */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Package className="mr-2 h-4 w-4" />
                    Tipos
                    {selectedTypes.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{selectedTypes.length}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <ScrollArea className="h-64">
                    <div className="p-2 space-y-1">
                      {allTypes.length === 0 ? (
                        <div className="text-xs text-muted-foreground px-2 py-4 text-center">
                          Sem tipos no período
                        </div>
                      ) : (
                        allTypes.map((t) => (
                          <div
                            key={t}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                            onClick={() => toggleArr(selectedTypes, t, setSelectedTypes)}
                          >
                            <Checkbox checked={selectedTypes.includes(t)} />
                            <span className="text-sm truncate">{labelType(t)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* Filtro Prioridades */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Prioridade
                    {selectedPriorities.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{selectedPriorities.length}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    {allPriorities.length === 0 ? (
                      <div className="text-xs text-muted-foreground px-2 py-4 text-center">
                        Sem dados
                      </div>
                    ) : (
                      allPriorities.map((p) => (
                        <div
                          key={p}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          onClick={() => toggleArr(selectedPriorities, p, setSelectedPriorities)}
                        >
                          <Checkbox checked={selectedPriorities.includes(p)} />
                          <span className="text-sm">{labelPriority(p)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  openDrill({
                    title: "Pedidos do recorte atual",
                    subtitle: `Filtros: ${activeFilterCount > 0 ? `${activeFilterCount} ativos` : "todos"}`,
                    userIds: selectedUsers.length > 0 ? selectedUsers.filter((u) => u.length === 36) : undefined,
                    orderTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
                    priorities: selectedPriorities.length > 0 ? selectedPriorities : undefined,
                  })
                }
              >
                <Package className="mr-2 h-4 w-4" />
                Ver pedidos
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportSingleCSV}>
                    <Download className="mr-2 h-4 w-4" />
                    CSV (visão atual)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAllExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel (todas as visões)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Chips de filtros ativos */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtros ativos:</span>
              {selectedUsers.map((uid) => {
                const u = allUsers.find((x) => x.id === uid);
                return (
                  <Badge key={`u-${uid}`} variant="secondary" className="gap-1 pl-2 pr-1">
                    👤 {u?.name || uid}
                    <button
                      onClick={() => toggleArr(selectedUsers, uid, setSelectedUsers)}
                      className="ml-1 hover:bg-muted rounded p-0.5"
                      aria-label="Remover filtro"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              {selectedTypes.map((t) => (
                <Badge key={`t-${t}`} variant="secondary" className="gap-1 pl-2 pr-1">
                  📦 {labelType(t)}
                  <button
                    onClick={() => toggleArr(selectedTypes, t, setSelectedTypes)}
                    className="ml-1 hover:bg-muted rounded p-0.5"
                    aria-label="Remover filtro"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedPriorities.map((p) => (
                <Badge key={`p-${p}`} variant="secondary" className="gap-1 pl-2 pr-1">
                  ⚡ {labelPriority(p)}
                  <button
                    onClick={() => toggleArr(selectedPriorities, p, setSelectedPriorities)}
                    className="ml-1 hover:bg-muted rounded p-0.5"
                    aria-label="Remover filtro"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-6 text-xs">
                Limpar todos
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="imported">📥 Importados</TabsTrigger>
            <TabsTrigger value="invoice_requested">💰 Faturamento</TabsTrigger>
            <TabsTrigger value="completed">✅ Concluídos</TabsTrigger>
            <TabsTrigger value="by_type">📊 Por Tipo</TabsTrigger>
            <TabsTrigger value="sla">🎯 SLA</TabsTrigger>
            <TabsTrigger value="complexity">🧩 Complexidade</TabsTrigger>
          </TabsList>

          {/* Abas simples (3 primeiras) */}
          {(["imported", "invoice_requested", "completed"] as ProductivityView[]).map((tabKey) => (
            <TabsContent key={tabKey} value={tabKey} className="space-y-4 mt-4">
              {activeTab === tabKey && (
                <>
                  {/* KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" /> Total no Período
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{totalCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {VIEW_LABELS[tabKey].toLowerCase()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" /> Média Diária
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{dailyAvg}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          em {byDay.length} {byDay.length === 1 ? "dia" : "dias"} com atividade
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Users className="h-4 w-4" /> Top Usuário
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold truncate">{topUser?.user_name || "—"}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {topUser ? `${topUser.total} ${VIEW_LABELS[tabKey].toLowerCase()}` : "Sem dados"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Gráfico */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Evolução Diária</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>
                      ) : byDay.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-muted-foreground">Sem dados no período selecionado</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={byDay}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "0.5rem",
                              }}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="total"
                              name={VIEW_LABELS[tabKey]}
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Ranking — clique para filtrar */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Ranking por Usuário</CardTitle>
                      <p className="text-xs text-muted-foreground">Clique em uma linha para filtrar por aquele usuário</p>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">% do Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {byUser.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                Sem dados no período
                              </TableCell>
                            </TableRow>
                          ) : (
                            byUser.map((user, idx) => {
                              // Tenta achar o id correspondente em allUsers para usar como filtro
                              const rowUserKey = allUsers.find((u) => u.name === user.user_name)?.id || userKey(null, user.user_email, user.user_name);
                              const isActive = selectedUsers.includes(rowUserKey);
                              return (
                                <TableRow
                                  key={user.user_email || user.user_name + idx}
                                  className={cn("cursor-pointer hover:bg-accent", isActive && "bg-accent/50")}
                                  onClick={() => toggleArr(selectedUsers, rowUserKey, setSelectedUsers)}
                                >
                                  <TableCell className="font-medium">{idx + 1}</TableCell>
                                  <TableCell className="font-medium">{user.user_name}</TableCell>
                                  <TableCell className="text-muted-foreground text-xs">
                                    {user.user_email || "—"}
                                  </TableCell>
                                  <TableCell className="text-right font-bold">{user.total}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {totalCount > 0 ? ((user.total / totalCount) * 100).toFixed(1) : "0"}%
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          ))}

          {/* Aba: Por Tipo */}
          <TabsContent value="by_type" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Package className="h-4 w-4" /> Tipos Distintos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{byTypeAgg.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">no período filtrado</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Total Importados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{byTypeTotalImported}</div>
                  <p className="text-xs text-muted-foreground mt-1">somando todos os tipos</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Filter className="h-4 w-4" /> Tipo Líder
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold truncate">{byTypeAgg[0]?.label || "—"}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {byTypeAgg[0] ? `${byTypeAgg[0].imported} pedidos` : "Sem dados"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de barras por tipo — clicável */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pedidos por Tipo</CardTitle>
                <p className="text-xs text-muted-foreground">Clique em uma barra para filtrar</p>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>
                ) : byTypeAgg.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">Sem dados no período selecionado</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={byTypeAgg} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="label" type="category" className="text-xs" width={140} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="imported" name="Importados" fill="hsl(var(--primary))" cursor="pointer">
                        {byTypeAgg.map((entry) => (
                          <Cell
                            key={entry.type}
                            opacity={selectedTypes.length === 0 || selectedTypes.includes(entry.type) ? 1 : 0.3}
                            onClick={() => toggleArr(selectedTypes, entry.type, setSelectedTypes)}
                          />
                        ))}
                      </Bar>
                      <Bar dataKey="invoiced" name="Faturamento" fill="hsl(38 92% 50%)" />
                      <Bar dataKey="completed" name="Concluídos" fill="hsl(142 71% 45%)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Distribuição por Prioridade */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição por Prioridade</CardTitle>
                <p className="text-xs text-muted-foreground">Clique em uma barra para filtrar</p>
              </CardHeader>
              <CardContent>
                {byPriorityAgg.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground">Sem dados</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={byPriorityAgg}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                        }}
                      />
                      <Bar dataKey="total" name="Pedidos" cursor="pointer">
                        {byPriorityAgg.map((entry) => (
                          <Cell
                            key={entry.priority}
                            fill={PRIORITY_COLORS[entry.priority] || "hsl(var(--primary))"}
                            opacity={selectedPriorities.length === 0 || selectedPriorities.includes(entry.priority) ? 1 : 0.3}
                            onClick={() => toggleArr(selectedPriorities, entry.priority, setSelectedPriorities)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Matriz Usuário x Tipo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Matriz Usuário × Tipo</CardTitle>
                <p className="text-xs text-muted-foreground">Pedidos importados por usuário e tipo</p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      {byTypeAgg.map((t) => (
                        <TableHead key={t.type} className="text-right whitespace-nowrap">
                          {t.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-right font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byUserTypeAgg.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={byTypeAgg.length + 2} className="text-center text-muted-foreground py-8">
                          Sem dados no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      byUserTypeAgg.map((u, idx) => (
                        <TableRow key={u.user_email || u.user_name + idx}>
                          <TableCell className="font-medium whitespace-nowrap">{u.user_name}</TableCell>
                          {byTypeAgg.map((t) => (
                            <TableCell key={t.type} className="text-right">
                              {u.types.get(t.type) || 0}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-bold">{u.total}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba: SLA */}
          <TabsContent value="sla" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Target className="h-4 w-4" /> No Prazo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[hsl(142_71%_45%)]">
                    {slaTotals.onTimePct.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {slaTotals.onTime} de {slaTotals.totalCompleted} concluídos
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <X className="h-4 w-4" /> Em Atraso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-destructive">{slaTotals.late}</div>
                  <p className="text-xs text-muted-foreground mt-1">pedidos fora do prazo</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Filter className="h-4 w-4" /> Em Risco
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[hsl(38_92%_50%)]">{slaTotals.atRisk}</div>
                  <p className="text-xs text-muted-foreground mt-1">próximos do limite</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Tempo de Ciclo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {cycleAvg !== null ? `${cycleAvg.toFixed(1)}d` : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">média ponderada</p>
                </CardContent>
              </Card>
            </div>

            {/* Ranking SLA por Usuário */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance SLA por Usuário</CardTitle>
                <p className="text-xs text-muted-foreground">Clique em uma linha para filtrar</p>
              </CardHeader>
              <CardContent>
                {slaQuery.isLoading ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground">
                    Carregando...
                  </div>
                ) : slaByUser.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground">
                    Sem dados de SLA no período
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="text-right">Concluídos</TableHead>
                        <TableHead className="text-right">No Prazo</TableHead>
                        <TableHead className="text-right">Atrasados</TableHead>
                        <TableHead className="text-right">% No Prazo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slaByUser.map((u, idx) => {
                        const rowUserKey = allUsers.find((x) => x.name === u.user_name)?.id || userKey(null, null, u.user_name);
                        const isActive = selectedUsers.includes(rowUserKey);
                        return (
                          <TableRow
                            key={u.user_name + idx}
                            className={cn("cursor-pointer hover:bg-accent", isActive && "bg-accent/50")}
                            onClick={() => toggleArr(selectedUsers, rowUserKey, setSelectedUsers)}
                          >
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{u.user_name}</TableCell>
                            <TableCell className="text-right">{u.total}</TableCell>
                            <TableCell className="text-right text-[hsl(142_71%_45%)]">{u.onTime}</TableCell>
                            <TableCell className="text-right text-destructive">{u.late}</TableCell>
                            <TableCell className="text-right font-bold">
                              <Badge
                                variant={u.pct >= 90 ? "default" : u.pct >= 70 ? "secondary" : "destructive"}
                              >
                                {u.pct.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Tempo de ciclo por tipo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tempo de Ciclo por Tipo de Pedido</CardTitle>
                <p className="text-xs text-muted-foreground">Dias médios entre criação e conclusão</p>
              </CardHeader>
              <CardContent>
                {cycleQuery.isLoading ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground">
                    Carregando...
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead className="text-right">Média (dias)</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                        <TableHead className="text-right">Máximo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const map = new Map<string, { type: string; orders: number; sumAvg: number; min: number; max: number }>();
                        filteredCycle.forEach((r) => {
                          const e = map.get(r.order_type) || {
                            type: r.order_type,
                            orders: 0,
                            sumAvg: 0,
                            min: Infinity,
                            max: 0,
                          };
                          e.orders += r.orders_count;
                          e.sumAvg += (r.avg_cycle_days || 0) * r.orders_count;
                          if (r.min_cycle_days !== null) e.min = Math.min(e.min, r.min_cycle_days);
                          if (r.max_cycle_days !== null) e.max = Math.max(e.max, r.max_cycle_days);
                          map.set(r.order_type, e);
                        });
                        const rows = Array.from(map.values())
                          .map((e) => ({ ...e, avg: e.orders > 0 ? e.sumAvg / e.orders : 0 }))
                          .sort((a, b) => b.orders - a.orders);
                        if (rows.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                Sem dados no período
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return rows.map((e) => (
                          <TableRow
                            key={e.type}
                            className="cursor-pointer hover:bg-accent"
                            onClick={() => toggleArr(selectedTypes, e.type, setSelectedTypes)}
                          >
                            <TableCell className="font-medium">{labelType(e.type)}</TableCell>
                            <TableCell className="text-right">{e.orders}</TableCell>
                            <TableCell className="text-right font-bold">{e.avg.toFixed(1)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {e.min === Infinity ? "—" : e.min.toFixed(0)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {e.max === 0 ? "—" : e.max.toFixed(0)}
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba: Complexidade */}
          <TabsContent value="complexity" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Cpu className="h-4 w-4" /> Total Pedidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{complexityTotals.totalOrders}</div>
                  <p className="text-xs text-muted-foreground mt-1">no período filtrado</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    🔧 Requer Firmware
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{complexityTotals.firmware}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {complexityTotals.totalOrders > 0
                      ? `${((complexityTotals.firmware / complexityTotals.totalOrders) * 100).toFixed(1)}% do total`
                      : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    🖼️ Requer Imagem
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{complexityTotals.image}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {complexityTotals.totalOrders > 0
                      ? `${((complexityTotals.image / complexityTotals.totalOrders) * 100).toFixed(1)}% do total`
                      : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    🧪 Processados Lab
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{complexityTotals.lab}</div>
                  <p className="text-xs text-muted-foreground mt-1">passaram pelo laboratório</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabela Complexidade por Usuário */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Complexidade Técnica por Usuário</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Distribuição de pedidos com requisitos técnicos (firmware, imagem, lab)
                </p>
              </CardHeader>
              <CardContent>
                {complexityQuery.isLoading ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground">
                    Carregando...
                  </div>
                ) : complexityByUser.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground">
                    Sem dados de complexidade no período
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Firmware</TableHead>
                        <TableHead className="text-right">Imagem</TableHead>
                        <TableHead className="text-right">Lab</TableHead>
                        <TableHead className="text-right">% Complexos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {complexityByUser.map((u, idx) => {
                        const rowUserKey = allUsers.find((x) => x.name === u.user_name)?.id || userKey(null, null, u.user_name);
                        const isActive = selectedUsers.includes(rowUserKey);
                        const complex = u.firmware + u.image + u.lab;
                        const pct = u.total > 0 ? (complex / u.total) * 100 : 0;
                        return (
                          <TableRow
                            key={u.user_name + idx}
                            className={cn("cursor-pointer hover:bg-accent", isActive && "bg-accent/50")}
                            onClick={() => toggleArr(selectedUsers, rowUserKey, setSelectedUsers)}
                          >
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{u.user_name}</TableCell>
                            <TableCell className="text-right">{u.total}</TableCell>
                            <TableCell className="text-right">{u.firmware}</TableCell>
                            <TableCell className="text-right">{u.image}</TableCell>
                            <TableCell className="text-right">{u.lab}</TableCell>
                            <TableCell className="text-right font-bold">
                              <Badge variant={pct >= 50 ? "default" : "secondary"}>
                                {pct.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Tempo de ciclo médio para complexos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Insight: Tempo de Ciclo Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {cycleAvg !== null ? `${cycleAvg.toFixed(1)} dias` : "—"}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Pedidos com requisitos técnicos (firmware/imagem/lab) tendem a ter ciclos
                  significativamente maiores. Use esse indicador para refinar previsões de SLA por
                  tipo de complexidade.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <ProductivityOrdersSheet
        open={drillOpen}
        onOpenChange={setDrillOpen}
        title={drillContext.title}
        subtitle={drillContext.subtitle}
        startDate={dateRange?.from}
        endDate={dateRange?.to}
        userIds={drillContext.userIds}
        orderTypes={drillContext.orderTypes}
        priorities={drillContext.priorities}
        includePending={activeTab === "imported"}
      />
    </Dialog>
  );
}
