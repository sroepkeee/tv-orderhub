import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Book, 
  FileText, 
  TrendingUp, 
  Search, 
  Plus,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Users,
  Globe,
  Filter,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KnowledgeBase, AgentType } from "@/hooks/useAIAgentAdmin";
import { cn } from "@/lib/utils";

interface RAGStats {
  total: number;
  active: number;
  inactive: number;
  byCategory: Record<string, number>;
  byAgentType: Record<string, number>;
  recentlyUpdated: number;
  usageStats: { title: string; uses: number }[];
}

interface Props {
  items: KnowledgeBase[];
  selectedAgentType: AgentType;
  onAddClick: () => void;
}

export function AIAgentRAGPanel({ items, selectedAgentType, onAddClick }: Props) {
  const [stats, setStats] = useState<RAGStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, [items]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Calculate stats from items
      const total = items.length;
      const active = items.filter(i => i.is_active).length;
      const inactive = total - active;
      
      // Group by category
      const byCategory: Record<string, number> = {};
      items.forEach(item => {
        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      });

      // Group by agent type
      const byAgentType: Record<string, number> = {
        carrier: items.filter(i => i.agent_type === 'carrier').length,
        customer: items.filter(i => i.agent_type === 'customer').length,
        general: items.filter(i => i.agent_type === 'general').length,
      };

      // Recently updated (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentlyUpdated = items.filter(i => {
        const itemAny = i as any;
        return itemAny.updated_at && new Date(itemAny.updated_at) > weekAgo;
      }).length;

      // Fetch usage from logs
      const { data: logs } = await supabase
        .from('ai_notification_log')
        .select('metadata')
        .not('metadata', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      // Count knowledge usage from logs
      const usageCount: Record<string, number> = {};
      (logs || []).forEach(log => {
        const knowledgeUsed = (log.metadata as any)?.knowledge_used || [];
        knowledgeUsed.forEach((title: string) => {
          usageCount[title] = (usageCount[title] || 0) + 1;
        });
      });

      const usageStats = Object.entries(usageCount)
        .map(([title, uses]) => ({ title, uses }))
        .sort((a, b) => b.uses - a.uses)
        .slice(0, 5);

      setStats({
        total,
        active,
        inactive,
        byCategory,
        byAgentType,
        recentlyUpdated,
        usageStats,
      });

      setUsageLogs(logs || []);
    } catch (error) {
      console.error('Error loading RAG stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const categoryLabels: Record<string, string> = {
    geral: 'Geral',
    empresa: 'Empresa',
    produtos: 'Produtos',
    atendimento: 'Atendimento',
    logistica: 'Logística',
    garantia: 'Garantia',
    tecnico: 'Técnico',
    frete: 'Frete',
    cotacao: 'Cotação',
    status_tracking: 'Status/Rastreio',
    atraso: 'Atrasos',
    extravio: 'Extravio',
    avaria: 'Avaria',
    reentrega: 'Reentrega',
    devolucao: 'Devolução',
    sla: 'SLA',
    excecao: 'Exceções',
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Documentos</p>
                <p className="text-3xl font-bold">{stats?.total || 0}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Book className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
                <p className="text-3xl font-bold text-green-600">{stats?.active || 0}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <Progress 
              value={stats?.total ? (stats.active / stats.total) * 100 : 0} 
              className="mt-2 h-1.5"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Atualizados (7 dias)</p>
                <p className="text-3xl font-bold text-blue-600">{stats?.recentlyUpdated || 0}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inativos</p>
                <p className="text-3xl font-bold text-orange-600">{stats?.inactive || 0}</p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                <XCircle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By Agent Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Por Tipo de Agente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">Transportadoras</span>
                </div>
                <Badge variant="secondary">{stats?.byAgentType?.carrier || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Clientes</span>
                </div>
                <Badge variant="secondary">{stats?.byAgentType?.customer || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Geral (Ambos)</span>
                </div>
                <Badge variant="secondary">{stats?.byAgentType?.general || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Most Used */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Mais Utilizados (RAG)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.usageStats && stats.usageStats.length > 0 ? (
              <div className="space-y-2">
                {stats.usageStats.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm truncate flex-1 mr-2">{item.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.uses}x
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum uso registrado ainda
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By Category */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Distribuição por Categoria
            </CardTitle>
            <Button size="sm" onClick={onAddClick}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Documento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats?.byCategory || {})
              .sort((a, b) => b[1] - a[1])
              .map(([category, count]) => (
                <Badge 
                  key={category} 
                  variant="secondary"
                  className="text-xs"
                >
                  {categoryLabels[category] || category}: {count}
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
            💡 Dicas para uma Base de Conhecimento Eficiente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>• Use <strong>keywords</strong> específicas para melhor matching no RAG</li>
            <li>• Separe documentos por <strong>tipo de agente</strong> (Transportadora vs Cliente)</li>
            <li>• Mantenha documentos de <strong>procedimentos</strong> atualizados</li>
            <li>• Use <strong>prioridade alta</strong> para documentos importantes que devem aparecer primeiro</li>
            <li>• Revise documentos <strong>inativos</strong> periodicamente</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}