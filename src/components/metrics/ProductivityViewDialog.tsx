import { useState, useMemo } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download, FileSpreadsheet, BarChart3, Users, TrendingUp } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  useProductivityMetrics,
  type ProductivityView,
  type ProductivityRow,
} from "@/hooks/useProductivityMetrics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ProductivityViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function ProductivityViewDialog({ open, onOpenChange }: ProductivityViewDialogProps) {
  const [activeView, setActiveView] = useState<ProductivityView>("imported");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

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

  const queries = {
    imported: importedQuery,
    invoice_requested: invoiceQuery,
    completed: completedQuery,
  };

  const currentData = queries[activeView].data || [];
  const isLoading = queries[activeView].isLoading;

  // Agregação por usuário
  const byUser = useMemo(() => {
    const map = new Map<string, { user_name: string; user_email: string | null; total: number }>();
    currentData.forEach((row) => {
      const key = row.user_id || row.user_name;
      const existing = map.get(key);
      if (existing) {
        existing.total += row.count;
      } else {
        map.set(key, {
          user_name: row.user_name,
          user_email: row.user_email,
          total: row.count,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [currentData]);

  // Agregação por dia (para gráfico)
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

  const exportSingleCSV = () => {
    if (!currentData.length) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

    const headers = ["Data", "Usuário", "Email", "Quantidade"];
    if (activeView === "imported") headers.push("Clientes Únicos");

    const rows = currentData.map((r) => {
      const base = [
        r.date,
        r.user_name,
        r.user_email || "",
        r.count.toString(),
      ];
      if (activeView === "imported") {
        base.push((r.unique_customers ?? 0).toString());
      }
      return base;
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `produtividade_${VIEW_FILE_NAMES[activeView]}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "CSV exportado com sucesso" });
  };

  const exportAllExcel = () => {
    const datasets: Array<{ name: string; rows: ProductivityRow[]; view: ProductivityView }> = [
      { name: "Importados", rows: importedQuery.data || [], view: "imported" },
      { name: "Faturamento", rows: invoiceQuery.data || [], view: "invoice_requested" },
      { name: "Concluidos", rows: completedQuery.data || [], view: "completed" },
    ];

    if (datasets.every((d) => !d.rows.length)) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

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
            Acompanhe a produtividade do time por período: pedidos importados, solicitações de faturamento e conclusões.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros + Exportar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
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
                Excel (3 visões)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tabs */}
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as ProductivityView)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="imported">📥 {VIEW_LABELS.imported}</TabsTrigger>
            <TabsTrigger value="invoice_requested">💰 {VIEW_LABELS.invoice_requested}</TabsTrigger>
            <TabsTrigger value="completed">✅ {VIEW_LABELS.completed}</TabsTrigger>
          </TabsList>

          <TabsContent value={activeView} className="space-y-4 mt-4">
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
                    {VIEW_LABELS[activeView].toLowerCase()}
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
                    {topUser ? `${topUser.total} ${VIEW_LABELS[activeView].toLowerCase()}` : "Sem dados"}
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
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    Carregando...
                  </div>
                ) : byDay.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    Sem dados no período selecionado
                  </div>
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
                        name={VIEW_LABELS[activeView]}
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Ranking */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ranking por Usuário</CardTitle>
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
                      byUser.map((user, idx) => (
                        <TableRow key={user.user_email || user.user_name + idx}>
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
