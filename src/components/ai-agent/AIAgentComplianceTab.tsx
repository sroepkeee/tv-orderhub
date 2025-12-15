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
import { Search, Plus, Upload, Download, Shield, AlertTriangle, AlertCircle, Info, Edit, Trash2, Check, X, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ComplianceRule {
  id: string;
  name: string;
  description: string | null;
  rule_pattern: string;
  risk_level: 'low' | 'medium' | 'high';
  policy_id: string | null;
  is_active: boolean;
  action_type: string;
  created_at: string;
}

interface CompliancePolicy {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export function AIAgentComplianceTab() {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Partial<ComplianceRule> | null>(null);
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesRes, policiesRes] = await Promise.all([
        supabase.from('ai_compliance_rules').select('*').order('created_at', { ascending: false }),
        supabase.from('ai_compliance_policies').select('*').order('name')
      ]);
      if (rulesRes.error) throw rulesRes.error;
      if (policiesRes.error) throw policiesRes.error;
      setRules(rulesRes.data || []);
      setPolicies(policiesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high': return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Alto</Badge>;
      case 'medium': return <Badge className="gap-1 bg-amber-500"><AlertTriangle className="h-3 w-3" /> Médio</Badge>;
      case 'low': return <Badge variant="secondary" className="gap-1"><Info className="h-3 w-3" /> Baixo</Badge>;
      default: return <Badge variant="outline">{level}</Badge>;
    }
  };

  const filteredRules = rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' && rule.is_active) || (filterStatus === 'inactive' && !rule.is_active);
    return matchesSearch && matchesStatus;
  });

  const handleSaveRule = async () => {
    if (!selectedRule?.name || !selectedRule?.rule_pattern) { toast.error('Nome e padrão são obrigatórios'); return; }
    try {
      if (selectedRule.id) {
        const { error } = await supabase.from('ai_compliance_rules').update({ name: selectedRule.name, description: selectedRule.description, rule_pattern: selectedRule.rule_pattern, risk_level: selectedRule.risk_level || 'medium', is_active: selectedRule.is_active ?? true, action_type: selectedRule.action_type || 'alert' }).eq('id', selectedRule.id);
        if (error) throw error;
        toast.success('Regra atualizada');
      } else {
        const { error } = await supabase.from('ai_compliance_rules').insert({ name: selectedRule.name, description: selectedRule.description, rule_pattern: selectedRule.rule_pattern, risk_level: selectedRule.risk_level || 'medium', is_active: selectedRule.is_active ?? true, action_type: selectedRule.action_type || 'alert' });
        if (error) throw error;
        toast.success('Regra criada');
      }
      setEditDialogOpen(false); setSelectedRule(null); loadData();
    } catch (error) { console.error('Error saving rule:', error); toast.error('Erro ao salvar regra'); }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta regra?')) return;
    try { const { error } = await supabase.from('ai_compliance_rules').delete().eq('id', id); if (error) throw error; toast.success('Regra excluída'); loadData(); } catch (error) { toast.error('Erro ao excluir regra'); }
  };

  const handleToggleActive = async (rule: ComplianceRule) => {
    try { const { error } = await supabase.from('ai_compliance_rules').update({ is_active: !rule.is_active }).eq('id', rule.id); if (error) throw error; loadData(); } catch (error) { toast.error('Erro ao atualizar regra'); }
  };

  const testPattern = () => {
    if (!selectedRule?.rule_pattern || !testText) { setTestResult(null); return; }
    try { const regex = new RegExp(selectedRule.rule_pattern, 'gi'); setTestResult(regex.test(testText)); } catch { toast.error('Padrão REGEX inválido'); setTestResult(null); }
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
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
            if (header === 'nome' || header === 'name') rule.name = value;
            if (header === 'descricao' || header === 'description') rule.description = value;
            if (header === 'padrao' || header === 'pattern' || header === 'rule_pattern') rule.rule_pattern = value;
            if (header === 'nivel_risco' || header === 'risk_level') rule.risk_level = value || 'medium';
            if (header === 'ativo' || header === 'is_active') rule.is_active = value === 'true' || value === '1';
          });
          if (rule.name && rule.rule_pattern) newRules.push({ name: rule.name, description: rule.description || null, rule_pattern: rule.rule_pattern, risk_level: rule.risk_level || 'medium', is_active: rule.is_active ?? true, action_type: 'alert' });
        }
        if (newRules.length > 0) { const { error } = await supabase.from('ai_compliance_rules').insert(newRules); if (error) throw error; toast.success(`${newRules.length} regras importadas`); loadData(); } else { toast.error('Nenhuma regra válida encontrada no CSV'); }
      } catch (error) { toast.error('Erro ao importar CSV'); }
    };
    reader.readAsText(file); event.target.value = '';
  };

  const handleExportCSV = () => {
    const headers = ['nome,descricao,padrao,nivel_risco,ativo'];
    const rows = rules.map(rule => `"${rule.name}","${rule.description || ''}","${rule.rule_pattern}","${rule.risk_level}","${rule.is_active}"`);
    const csv = [...headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'regras_compliance.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" />Regras de Compliance</CardTitle><CardDescription>Gerencie regras de detecção e políticas</CardDescription></div>
            <div className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Importar CSV</Button>
              <Button variant="outline" onClick={handleExportCSV}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
              <Button onClick={() => { setSelectedRule({ name: '', description: '', rule_pattern: '', risk_level: 'medium', is_active: true, action_type: 'alert' }); setEditDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nova Regra</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar regras..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" /></div>
            <Tabs value={filterStatus} onValueChange={setFilterStatus} className="w-auto"><TabsList><TabsTrigger value="all">Todas</TabsTrigger><TabsTrigger value="active">Ativas</TabsTrigger><TabsTrigger value="inactive">Inativas</TabsTrigger></TabsList></Tabs>
          </div>
        </CardContent>
      </Card>

      <ScrollArea className="h-[calc(100vh-350px)]">
        {loading ? <div className="text-center py-8 text-muted-foreground">Carregando...</div> : filteredRules.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground"><Shield className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Nenhuma regra encontrada</p></CardContent></Card> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRules.map(rule => (
              <Card key={rule.id} className={`relative ${!rule.is_active ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Switch checked={rule.is_active} onCheckedChange={() => handleToggleActive(rule)} /><CardTitle className="text-sm">{rule.name}</CardTitle></div>{getRiskBadge(rule.risk_level)}</div>{rule.description && <CardDescription className="text-xs mt-1">{rule.description}</CardDescription>}</CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted rounded p-2"><code className="text-xs break-all">{rule.rule_pattern}</code></div>
                  <div className="flex items-center justify-between"><Badge variant="outline" className="text-xs">{rule.action_type === 'alert' ? 'Alertar' : rule.action_type === 'block' ? 'Bloquear' : 'Registrar'}</Badge><div className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => { setSelectedRule(rule); setEditDialogOpen(true); setTestText(''); setTestResult(null); }}><Edit className="h-4 w-4" /></Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteRule(rule.id)}><Trash2 className="h-4 w-4" /></Button></div></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedRule?.id ? 'Editar Regra' : 'Nova Regra'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Nome *</Label><Input value={selectedRule?.name || ''} onChange={(e) => setSelectedRule(prev => ({ ...prev, name: e.target.value }))} placeholder="Nome da regra" /></div><div className="space-y-2"><Label>Nível de Risco</Label><Select value={selectedRule?.risk_level || 'medium'} onValueChange={(value) => setSelectedRule(prev => ({ ...prev, risk_level: value as any }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Baixo</SelectItem><SelectItem value="medium">Médio</SelectItem><SelectItem value="high">Alto</SelectItem></SelectContent></Select></div></div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={selectedRule?.description || ''} onChange={(e) => setSelectedRule(prev => ({ ...prev, description: e.target.value }))} placeholder="Descrição opcional" /></div>
            <div className="space-y-2"><Label>Padrão REGEX *</Label><Textarea value={selectedRule?.rule_pattern || ''} onChange={(e) => setSelectedRule(prev => ({ ...prev, rule_pattern: e.target.value }))} placeholder="(?i)\b(palavra|termo)\b" className="font-mono text-sm" /></div>
            <Card className="bg-muted/50"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Play className="h-4 w-4" />Testar Regra</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea value={testText} onChange={(e) => { setTestText(e.target.value); setTestResult(null); }} placeholder="Digite um texto para testar..." rows={2} /><div className="flex items-center justify-between"><Button size="sm" variant="secondary" onClick={testPattern}><Play className="h-4 w-4 mr-2" />Testar</Button>{testResult !== null && <div className={`flex items-center gap-2 ${testResult ? 'text-green-600' : 'text-red-600'}`}>{testResult ? <><Check className="h-4 w-4" /><span className="text-sm">Detectado!</span></> : <><X className="h-4 w-4" /><span className="text-sm">Não detectado</span></>}</div>}</div></CardContent></Card>
            <div className="flex items-center gap-2"><Switch checked={selectedRule?.is_active ?? true} onCheckedChange={(checked) => setSelectedRule(prev => ({ ...prev, is_active: checked }))} /><Label>Regra ativa</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button><Button onClick={handleSaveRule}>{selectedRule?.id ? 'Salvar' : 'Criar'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
