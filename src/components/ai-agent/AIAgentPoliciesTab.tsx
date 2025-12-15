import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  Search,
  Filter,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  AlertCircle,
} from "lucide-react";

interface AIRule {
  id: string;
  rule_description: string;
  policy: string;
  rule: string;
  rule_risk: "low" | "moderate" | "high" | "critical";
  action: "log" | "warn" | "block" | "escalate";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CSVRow {
  policy: string;
  rule_description: string;
  rule: string;
  rule_risk: string;
  action: string;
  is_active: string;
  errors: string[];
  isValid: boolean;
}

const RISK_LEVELS = [
  { value: "low", label: "Baixo", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  { value: "moderate", label: "Moderado", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  { value: "high", label: "Alto", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "critical", label: "Crítico", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
];

const ACTIONS = [
  { value: "log", label: "Registrar", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300", icon: "📝" },
  { value: "warn", label: "Alertar", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: "⚠️" },
  { value: "block", label: "Bloquear", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: "🚫" },
  { value: "escalate", label: "Escalar", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: "🚨" },
];

const emptyRule: Partial<AIRule> = {
  policy: "",
  rule_description: "",
  rule: "",
  rule_risk: "moderate",
  action: "warn",
  is_active: true,
};

export function AIAgentPoliciesTab() {
  const [rules, setRules] = useState<AIRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [filterPolicy, setFilterPolicy] = useState<string>("all");

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<Partial<AIRule>>(emptyRule);
  const [ruleToDelete, setRuleToDelete] = useState<AIRule | null>(null);

  // CSV Import states
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [skipErrors, setSkipErrors] = useState(true);

  const loadRules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_rules")
      .select("*")
      .order("policy", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar regras");
      console.error(error);
    } else {
      setRules((data as AIRule[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // Get unique policies for filter
  const uniquePolicies = [...new Set(rules.map((r) => r.policy))].sort();

  // Filter rules
  const filteredRules = rules.filter((rule) => {
    const matchesSearch =
      searchTerm === "" ||
      rule.policy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.rule_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.rule.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = filterRisk === "all" || rule.rule_risk === filterRisk;
    const matchesPolicy = filterPolicy === "all" || rule.policy === filterPolicy;
    return matchesSearch && matchesRisk && matchesPolicy;
  });

  // CRUD Operations
  const handleSave = async () => {
    if (!currentRule.policy || !currentRule.rule_description || !currentRule.rule) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (currentRule.id) {
      // Update
      const { error } = await supabase
        .from("ai_rules")
        .update({
          policy: currentRule.policy,
          rule_description: currentRule.rule_description,
          rule: currentRule.rule,
          rule_risk: currentRule.rule_risk,
          action: currentRule.action,
          is_active: currentRule.is_active,
        })
        .eq("id", currentRule.id);

      if (error) {
        toast.error("Erro ao atualizar regra");
      } else {
        toast.success("Regra atualizada");
        setEditDialogOpen(false);
        loadRules();
      }
    } else {
      // Insert
      const { error } = await supabase.from("ai_rules").insert({
        policy: currentRule.policy,
        rule_description: currentRule.rule_description,
        rule: currentRule.rule,
        rule_risk: currentRule.rule_risk || "moderate",
        action: currentRule.action || "warn",
        is_active: currentRule.is_active ?? true,
      });

      if (error) {
        toast.error("Erro ao criar regra");
      } else {
        toast.success("Regra criada");
        setEditDialogOpen(false);
        loadRules();
      }
    }
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;

    const { error } = await supabase.from("ai_rules").delete().eq("id", ruleToDelete.id);

    if (error) {
      toast.error("Erro ao excluir regra");
    } else {
      toast.success("Regra excluída");
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
      loadRules();
    }
  };

  const handleToggleActive = async (rule: AIRule) => {
    const { error } = await supabase
      .from("ai_rules")
      .update({ is_active: !rule.is_active })
      .eq("id", rule.id);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      loadRules();
    }
  };

  // CSV Export
  const handleExport = () => {
    const headers = ["policy", "rule_description", "rule", "rule_risk", "action", "is_active"];
    const csvContent = [
      headers.join(","),
      ...filteredRules.map((r) =>
        [
          `"${r.policy.replace(/"/g, '""')}"`,
          `"${r.rule_description.replace(/"/g, '""')}"`,
          `"${r.rule.replace(/"/g, '""')}"`,
          r.rule_risk,
          r.action,
          r.is_active,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai_rules_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const handleDownloadTemplate = () => {
    const template = `policy,rule_description,rule,rule_risk,action,is_active
"Privacidade de Dados","Não expor CPF completo","Mascarar CPF em respostas ao cliente","high","block","true"
"Comunicação","Evitar promessas de prazo","Não prometer datas específicas sem confirmação do sistema","moderate","warn","true"
"Financeiro","Não discutir valores","Não mencionar preços ou descontos sem autorização","critical","escalate","true"`;

    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ai_rules_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // CSV Import
  const validateRow = (row: Record<string, string>, index: number): CSVRow => {
    const errors: string[] = [];
    const validRisks = ["low", "moderate", "high", "critical"];
    const validActions = ["log", "warn", "block", "escalate"];

    const policy = row.policy || row.politica || row["política"] || "";
    const ruleDescription = row.rule_description || row.descricao || row["descrição"] || row.description || "";
    const rule = row.rule || row.regra || "";
    const ruleRisk = (row.rule_risk || row.risco || row.nivel_risco || row.risk || "moderate").toLowerCase();
    const action = (row.action || row.acao || row["ação"] || "warn").toLowerCase();
    const isActiveRaw = row.is_active || row.ativo || row.active || "true";

    if (!policy.trim()) errors.push("Campo 'policy' é obrigatório");
    if (!ruleDescription.trim()) errors.push("Campo 'rule_description' é obrigatório");
    if (!rule.trim()) errors.push("Campo 'rule' é obrigatório");
    if (!validRisks.includes(ruleRisk)) errors.push(`Valor '${ruleRisk}' inválido para rule_risk`);
    if (!validActions.includes(action)) errors.push(`Valor '${action}' inválido para action`);

    return {
      policy: policy.trim(),
      rule_description: ruleDescription.trim(),
      rule: rule.trim(),
      rule_risk: validRisks.includes(ruleRisk) ? ruleRisk : "moderate",
      action: validActions.includes(action) ? action : "warn",
      is_active: ["true", "1", "sim", "yes"].includes(isActiveRaw.toLowerCase()) ? "true" : "false",
      errors,
      isValid: errors.length === 0,
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/[""]/g, ""),
      complete: (results) => {
        console.log("CSV parsed:", results);
        
        if (!results.data || results.data.length === 0) {
          toast.error("Arquivo CSV vazio ou inválido");
          return;
        }

        const parsedRows: CSVRow[] = results.data.map((row: any, idx: number) => 
          validateRow(row, idx)
        );

        console.log("Validated rows:", parsedRows);
        setCsvData(parsedRows);
        setImportDialogOpen(true);
      },
      error: (error) => {
        console.error("CSV parse error:", error);
        toast.error("Erro ao processar CSV: " + error.message);
      }
    });

    event.target.value = "";
  };

  const handleImport = async () => {
    const rowsToImport = skipErrors ? csvData.filter((r) => r.isValid) : csvData;
    
    if (rowsToImport.length === 0) {
      toast.error("Nenhum registro válido para importar");
      return;
    }

    const insertData = rowsToImport.map((r) => ({
      policy: r.policy,
      rule_description: r.rule_description,
      rule: r.rule,
      rule_risk: r.rule_risk as AIRule["rule_risk"],
      action: r.action as AIRule["action"],
      is_active: r.is_active === "true",
    }));

    const { error } = await supabase.from("ai_rules").insert(insertData);

    if (error) {
      toast.error("Erro ao importar regras");
      console.error(error);
    } else {
      toast.success(`${insertData.length} regras importadas`);
      setImportDialogOpen(false);
      setCsvData([]);
      loadRules();
    }
  };

  const getRiskBadge = (risk: string) => {
    const level = RISK_LEVELS.find((r) => r.value === risk);
    return <Badge className={level?.color || ""}>{level?.label || risk}</Badge>;
  };

  const getActionBadge = (action: string) => {
    const act = ACTIONS.find((a) => a.value === action);
    return (
      <Badge className={act?.color || ""}>
        {act?.icon} {act?.label || action}
      </Badge>
    );
  };

  const validCount = csvData.filter((r) => r.isValid).length;
  const invalidCount = csvData.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar regras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Risco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Riscos</SelectItem>
              {RISK_LEVELS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPolicy} onValueChange={setFilterPolicy}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Política" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Políticas</SelectItem>
              {uniquePolicies.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>

          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
          </div>

          <Button
            onClick={() => {
              setCurrentRule(emptyRule);
              setEditDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Regra
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{rules.length}</p>
                <p className="text-xs text-muted-foreground">Total de Regras</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{rules.filter((r) => r.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {rules.filter((r) => r.rule_risk === "critical" || r.rule_risk === "high").length}
                </p>
                <p className="text-xs text-muted-foreground">Alto/Crítico</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{uniquePolicies.length}</p>
                <p className="text-xs text-muted-foreground">Políticas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Regras de Políticas ({filteredRules.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Política</TableHead>
                  <TableHead className="w-[200px]">Descrição</TableHead>
                  <TableHead>Regra</TableHead>
                  <TableHead className="w-[100px]">Risco</TableHead>
                  <TableHead className="w-[100px]">Ação</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma regra encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRules.map((rule) => (
                    <TableRow key={rule.id} className={!rule.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{rule.policy}</TableCell>
                      <TableCell>{rule.rule_description}</TableCell>
                      <TableCell className="max-w-[300px] truncate" title={rule.rule}>
                        {rule.rule}
                      </TableCell>
                      <TableCell>{getRiskBadge(rule.rule_risk)}</TableCell>
                      <TableCell>{getActionBadge(rule.action)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => handleToggleActive(rule)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCurrentRule(rule);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setRuleToDelete(rule);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{currentRule.id ? "Editar Regra" : "Nova Regra"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Política *</Label>
                <Input
                  value={currentRule.policy || ""}
                  onChange={(e) => setCurrentRule({ ...currentRule, policy: e.target.value })}
                  placeholder="Ex: Privacidade de Dados"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input
                  value={currentRule.rule_description || ""}
                  onChange={(e) => setCurrentRule({ ...currentRule, rule_description: e.target.value })}
                  placeholder="Ex: Não expor CPF completo"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Regra/Instrução *</Label>
              <Textarea
                value={currentRule.rule || ""}
                onChange={(e) => setCurrentRule({ ...currentRule, rule: e.target.value })}
                placeholder="Descreva a regra em detalhes..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nível de Risco</Label>
                <Select
                  value={currentRule.rule_risk || "moderate"}
                  onValueChange={(v) => setCurrentRule({ ...currentRule, rule_risk: v as AIRule["rule_risk"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ação</Label>
                <Select
                  value={currentRule.action || "warn"}
                  onValueChange={(v) => setCurrentRule({ ...currentRule, action: v as AIRule["action"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.icon} {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={currentRule.is_active ?? true}
                    onCheckedChange={(v) => setCurrentRule({ ...currentRule, is_active: v })}
                  />
                  <span className="text-sm">{currentRule.is_active ? "Ativa" : "Inativa"}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Regra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a regra "{ruleToDelete?.rule_description}"? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar Regras de Políticas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template CSV
            </Button>

            {csvData.length > 0 && (
              <>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {validCount} registros válidos
                  </div>
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-4 w-4" />
                      {invalidCount} com problemas
                    </div>
                  )}
                </div>

                <ScrollArea className="h-[300px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Política</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Risco</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead className="w-[150px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.map((row, idx) => (
                        <TableRow key={idx} className={!row.isValid ? "bg-red-50 dark:bg-red-950/20" : ""}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{row.policy || "-"}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{row.rule_description || "-"}</TableCell>
                          <TableCell>{row.rule_risk}</TableCell>
                          <TableCell>{row.action}</TableCell>
                          <TableCell>
                            {row.isValid ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" /> OK
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Badge className="bg-red-100 text-red-800">
                                  <AlertCircle className="h-3 w-3 mr-1" /> Erro
                                </Badge>
                                <span className="text-xs text-red-600 max-w-[100px] truncate" title={row.errors.join(", ")}>
                                  {row.errors[0]}
                                </span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {invalidCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="skip-errors"
                      checked={skipErrors}
                      onCheckedChange={(v) => setSkipErrors(!!v)}
                    />
                    <Label htmlFor="skip-errors" className="text-sm">
                      Ignorar linhas com erro e importar apenas as válidas
                    </Label>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={validCount === 0}>
              Importar {skipErrors ? validCount : csvData.length} Regras
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
