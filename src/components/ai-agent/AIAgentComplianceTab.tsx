import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, Upload, Download, Shield, AlertTriangle, AlertCircle, Info, Edit, Trash2, Check, X, Play, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ComplianceRule {
  id: string;
  rule_description: string; // name
  policy: string; // category
  rule: string; // pattern
  rule_risk: 'low' | 'moderate' | 'high';
  action: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function AIAgentComplianceTab() {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Partial<ComplianceRule> | null>(null);
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_rules')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Cast to typed rules
      const typedRules = (data || []).map(rule => ({
        ...rule,
        rule_risk: (rule.rule_risk || 'moderate') as 'low' | 'moderate' | 'high'
      }));
      setRules(typedRules);
    } catch (error) {
      console.error('Error loading rules:', error);
      toast.error('Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high': return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Alto</Badge>;
      case 'moderate': return <Badge className="gap-1 bg-amber-500 hover:bg-amber-600"><AlertTriangle className="h-3 w-3" /> Médio</Badge>;
      case 'low': return <Badge variant="secondary" className="gap-1"><Info className="h-3 w-3" /> Baixo</Badge>;
      default: return <Badge variant="outline">{level}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'block': return <Badge variant="destructive" className="text-xs">Bloquear</Badge>;
      case 'warn': return <Badge className="text-xs bg-amber-500 hover:bg-amber-600">Alertar</Badge>;
      case 'log': return <Badge variant="outline" className="text-xs">Registrar</Badge>;
      default: return <Badge variant="outline" className="text-xs">{action}</Badge>;
    }
  };

  const getPolicyColor = (policy: string) => {
    const colors: Record<string, string> = {
      'Desvio de conduta': 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
      'VIOLÊNCIA': 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
      'LGPD': 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
      'Atendimento': 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
      'Comunicação': 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
    };
    return colors[policy] || 'bg-muted text-muted-foreground';
  };

  const filteredRules = rules.filter(rule => {
    const matchesSearch = 
      rule.rule_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.policy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.rule.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && rule.is_active) || 
      (filterStatus === 'inactive' && !rule.is_active);
    const matchesRisk = filterRisk === 'all' || rule.rule_risk === filterRisk;
    return matchesSearch && matchesStatus && matchesRisk;
  });

  const handleSaveRule = async () => {
    if (!selectedRule?.rule_description || !selectedRule?.rule) {
      toast.error('Descrição e palavras-chave são obrigatórios');
      return;
    }
    try {
      const ruleData = {
        rule_description: selectedRule.rule_description,
        policy: selectedRule.policy || 'Geral',
        rule: selectedRule.rule,
        rule_risk: selectedRule.rule_risk || 'moderate',
        action: selectedRule.action || 'log',
        is_active: selectedRule.is_active ?? true
      };

      if (selectedRule.id) {
        const { error } = await supabase
          .from('ai_rules')
          .update(ruleData)
          .eq('id', selectedRule.id);
        if (error) throw error;
        toast.success('Regra atualizada');
      } else {
        const { error } = await supabase
          .from('ai_rules')
          .insert(ruleData);
        if (error) throw error;
        toast.success('Regra criada');
      }
      setEditDialogOpen(false);
      setSelectedRule(null);
      loadData();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Erro ao salvar regra');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta regra?')) return;
    try {
      const { error } = await supabase.from('ai_rules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Regra excluída');
      loadData();
    } catch (error) {
      toast.error('Erro ao excluir regra');
    }
  };

  const handleToggleActive = async (rule: ComplianceRule) => {
    try {
      const { error } = await supabase
        .from('ai_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);
      if (error) throw error;
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar regra');
    }
  };

  const testPattern = () => {
    if (!selectedRule?.rule || !testText) {
      setTestResult(null);
      return;
    }
    try {
      // Test each keyword/pattern
      const patterns = selectedRule.rule.split(',').map(p => p.trim());
      const found = patterns.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'gi');
          return regex.test(testText);
        } catch {
          // If not valid regex, do simple includes check
          return testText.toLowerCase().includes(pattern.toLowerCase());
        }
      });
      setTestResult(found);
    } catch {
      toast.error('Erro ao testar padrão');
      setTestResult(null);
    }
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const newRules: any[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const rule: Record<string, any> = {};
          
          headers.forEach((header, index) => {
            const value = values[index];
            if (header === 'descricao' || header === 'rule_description') rule.rule_description = value;
            if (header === 'politica' || header === 'policy') rule.policy = value;
            if (header === 'palavras' || header === 'rule' || header === 'pattern') rule.rule = value;
            if (header === 'risco' || header === 'rule_risk') rule.rule_risk = value || 'moderate';
            if (header === 'acao' || header === 'action') rule.action = value || 'log';
            if (header === 'ativo' || header === 'is_active') rule.is_active = value === 'true' || value === '1';
          });
          
          if (rule.rule_description && rule.rule) {
            newRules.push({
              rule_description: rule.rule_description,
              policy: rule.policy || 'Geral',
              rule: rule.rule,
              rule_risk: rule.rule_risk || 'moderate',
              action: rule.action || 'log',
              is_active: rule.is_active ?? true
            });
          }
        }
        
        if (newRules.length > 0) {
          const { error } = await supabase.from('ai_rules').insert(newRules);
          if (error) throw error;
          toast.success(`${newRules.length} regras importadas`);
          loadData();
        } else {
          toast.error('Nenhuma regra válida encontrada no CSV');
        }
      } catch (error) {
        toast.error('Erro ao importar CSV');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleExportCSV = () => {
    const headers = ['descricao,politica,palavras,risco,acao,ativo'];
    const rows = rules.map(rule => 
      `"${rule.rule_description}","${rule.policy}","${rule.rule}","${rule.rule_risk}","${rule.action}","${rule.is_active}"`
    );
    const csv = [...headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'regras_compliance.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get unique policies for stats
  const uniquePolicies = [...new Set(rules.map(r => r.policy))];
  const rulesByRisk = {
    high: rules.filter(r => r.rule_risk === 'high').length,
    moderate: rules.filter(r => r.rule_risk === 'moderate').length,
    low: rules.filter(r => r.rule_risk === 'low').length,
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{rules.length}</div>
            <p className="text-xs text-muted-foreground">Total de Regras</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{rules.filter(r => r.is_active).length}</div>
            <p className="text-xs text-muted-foreground">Regras Ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{rulesByRisk.high}</div>
            <p className="text-xs text-muted-foreground">Risco Alto</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{rulesByRisk.moderate}</div>
            <p className="text-xs text-muted-foreground">Risco Médio</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Regras de Compliance
              </CardTitle>
              <CardDescription>
                {uniquePolicies.length} políticas • {rules.length} regras de detecção
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />Importar
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />Exportar
              </Button>
              <Button size="sm" onClick={() => {
                setSelectedRule({
                  rule_description: '',
                  policy: 'Geral',
                  rule: '',
                  rule_risk: 'moderate',
                  action: 'log',
                  is_active: true
                });
                setEditDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />Nova Regra
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar regras, políticas, palavras-chave..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-9" 
              />
            </div>
            <Tabs value={filterStatus} onValueChange={setFilterStatus} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="active">Ativas</TabsTrigger>
                <TabsTrigger value="inactive">Inativas</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Riscos</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="moderate">Médio</SelectItem>
                <SelectItem value="low">Baixo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rules Grid */}
      <ScrollArea className="h-[calc(100vh-450px)]">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredRules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma regra encontrada</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRules.map(rule => (
              <Card key={rule.id} className={`relative transition-all ${!rule.is_active ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Switch 
                        checked={rule.is_active} 
                        onCheckedChange={() => handleToggleActive(rule)} 
                      />
                      <CardTitle className="text-sm truncate" title={rule.rule_description}>
                        {rule.rule_description}
                      </CardTitle>
                    </div>
                    {getRiskBadge(rule.rule_risk)}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={`text-xs ${getPolicyColor(rule.policy)}`}>
                      <Tag className="h-3 w-3 mr-1" />
                      {rule.policy}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted rounded p-2">
                    <code className="text-xs break-all text-muted-foreground">
                      {rule.rule}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    {getActionBadge(rule.action)}
                    <div className="flex items-center gap-1">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          setSelectedRule(rule);
                          setEditDialogOpen(true);
                          setTestText('');
                          setTestResult(null);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-destructive" 
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRule?.id ? 'Editar Regra' : 'Nova Regra'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Descrição da Regra *</Label>
                <Input 
                  value={selectedRule?.rule_description || ''} 
                  onChange={(e) => setSelectedRule(prev => ({ ...prev, rule_description: e.target.value }))} 
                  placeholder="Ex: Linguagem imprópria" 
                />
              </div>
              <div className="space-y-2">
                <Label>Política/Categoria</Label>
                <Select 
                  value={selectedRule?.policy || 'Geral'} 
                  onValueChange={(value) => setSelectedRule(prev => ({ ...prev, policy: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Geral">Geral</SelectItem>
                    <SelectItem value="Desvio de conduta">Desvio de conduta</SelectItem>
                    <SelectItem value="VIOLÊNCIA">Violência</SelectItem>
                    <SelectItem value="LGPD">LGPD</SelectItem>
                    <SelectItem value="Atendimento">Atendimento</SelectItem>
                    <SelectItem value="Comunicação">Comunicação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nível de Risco</Label>
                <Select 
                  value={selectedRule?.rule_risk || 'moderate'} 
                  onValueChange={(value) => setSelectedRule(prev => ({ ...prev, rule_risk: value as any }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="moderate">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ação</Label>
                <Select 
                  value={selectedRule?.action || 'log'} 
                  onValueChange={(value) => setSelectedRule(prev => ({ ...prev, action: value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="log">Registrar</SelectItem>
                    <SelectItem value="warn">Alertar</SelectItem>
                    <SelectItem value="block">Bloquear</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Palavras-chave / Padrões (separados por vírgula) *</Label>
              <Textarea 
                value={selectedRule?.rule || ''} 
                onChange={(e) => setSelectedRule(prev => ({ ...prev, rule: e.target.value }))} 
                placeholder="palavra1, palavra2, (?i)padrão\s+regex" 
                className="font-mono text-sm"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Pode usar palavras simples ou expressões regulares (REGEX)
              </p>
            </div>

            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Testar Regra
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea 
                  value={testText} 
                  onChange={(e) => { setTestText(e.target.value); setTestResult(null); }} 
                  placeholder="Digite um texto para testar se as palavras-chave são detectadas..." 
                  rows={2} 
                />
                <div className="flex items-center justify-between">
                  <Button size="sm" variant="secondary" onClick={testPattern}>
                    <Play className="h-4 w-4 mr-2" />Testar
                  </Button>
                  {testResult !== null && (
                    <div className={`flex items-center gap-2 ${testResult ? 'text-green-600' : 'text-red-600'}`}>
                      {testResult ? (
                        <><Check className="h-4 w-4" /><span className="text-sm">Detectado!</span></>
                      ) : (
                        <><X className="h-4 w-4" /><span className="text-sm">Não detectado</span></>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <Switch 
                checked={selectedRule?.is_active ?? true} 
                onCheckedChange={(checked) => setSelectedRule(prev => ({ ...prev, is_active: checked }))} 
              />
              <Label>Regra ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveRule}>{selectedRule?.id ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
