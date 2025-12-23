import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Brain, TrendingUp, AlertTriangle, CheckCircle, XCircle, 
  Lightbulb, BarChart3, Target, Zap, Clock, MessageSquare,
  ThumbsUp, ThumbsDown, Eye, Plus, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import AgentErrorsPanel from './AgentErrorsPanel';

interface KnowledgeSuggestion {
  id: string;
  agent_instance_id: string;
  suggestion_type: string;
  suggested_title: string;
  suggested_content: string;
  suggested_keywords: string[];
  suggested_category: string;
  source_question: string;
  detection_reason: string;
  confidence_score: number;
  status: string;
  created_at: string;
}

interface LearningFeedback {
  id: string;
  agent_instance_id: string;
  message_content: string;
  response_content: string;
  confidence_score: number;
  resolution_status: string;
  response_time_ms: number;
  knowledge_gaps_detected: string[];
  customer_sentiment: string;
  created_at: string;
}

interface AgentMetrics {
  id: string;
  agent_instance_id: string;
  metric_date: string;
  total_conversations: number;
  total_messages: number;
  avg_confidence_score: number;
  resolution_rate: number;
  escalation_rate: number;
  avg_response_time_ms: number;
  knowledge_gaps_count: number;
  suggestions_generated: number;
  suggestions_approved: number;
  positive_sentiment_rate: number;
  negative_sentiment_rate: number;
}

interface AgentInstance {
  id: string;
  instance_name: string;
  agent_type: string;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];

export default function AIAgentLearningTab() {
  const [instances, setInstances] = useState<AgentInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('all');
  const [suggestions, setSuggestions] = useState<KnowledgeSuggestion[]>([]);
  const [feedback, setFeedback] = useState<LearningFeedback[]>([]);
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, [selectedInstance]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load instances
      const { data: instancesData } = await supabase
        .from('ai_agent_instances')
        .select('id, instance_name, agent_type')
        .eq('is_active', true);
      setInstances(instancesData || []);

      // Load suggestions
      let suggestionsQuery = supabase
        .from('ai_knowledge_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (selectedInstance !== 'all') {
        suggestionsQuery = suggestionsQuery.eq('agent_instance_id', selectedInstance);
      }
      const { data: suggestionsData } = await suggestionsQuery;
      setSuggestions(suggestionsData || []);

      // Load feedback
      let feedbackQuery = supabase
        .from('ai_learning_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (selectedInstance !== 'all') {
        feedbackQuery = feedbackQuery.eq('agent_instance_id', selectedInstance);
      }
      const { data: feedbackData } = await feedbackQuery;
      setFeedback(feedbackData || []);

      // Load metrics
      let metricsQuery = supabase
        .from('ai_agent_metrics')
        .select('*')
        .order('metric_date', { ascending: true })
        .limit(30);
      
      if (selectedInstance !== 'all') {
        metricsQuery = metricsQuery.eq('agent_instance_id', selectedInstance);
      }
      const { data: metricsData } = await metricsQuery;
      setMetrics(metricsData || []);
    } catch (error) {
      console.error('Error loading learning data:', error);
      toast.error('Erro ao carregar dados de aprendizado');
    } finally {
      setLoading(false);
    }
  };

  const approveSuggestion = async (suggestion: KnowledgeSuggestion) => {
    try {
      // Create knowledge base entry
      const { data: knowledge, error: knowledgeError } = await supabase
        .from('ai_knowledge_base')
        .insert({
          title: suggestion.suggested_title,
          content: suggestion.suggested_content,
          keywords: suggestion.suggested_keywords,
          category: suggestion.suggested_category,
          agent_type: instances.find(i => i.id === suggestion.agent_instance_id)?.agent_type || 'general',
          is_active: true,
        })
        .select()
        .single();

      if (knowledgeError) throw knowledgeError;

      // Update suggestion status
      const { error: updateError } = await supabase
        .from('ai_knowledge_suggestions')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          created_knowledge_id: knowledge.id,
        })
        .eq('id', suggestion.id);

      if (updateError) throw updateError;

      toast.success('Sugestão aprovada e adicionada à base de conhecimento!');
      loadData();
    } catch (error) {
      console.error('Error approving suggestion:', error);
      toast.error('Erro ao aprovar sugestão');
    }
  };

  const rejectSuggestion = async (id: string, reason: string = 'Não relevante') => {
    try {
      const { error } = await supabase
        .from('ai_knowledge_suggestions')
        .update({
          status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Sugestão rejeitada');
      loadData();
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      toast.error('Erro ao rejeitar sugestão');
    }
  };

  // Calculate summary stats
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending').length;
  const approvedSuggestions = suggestions.filter(s => s.status === 'approved').length;
  const avgConfidence = feedback.length > 0 
    ? (feedback.reduce((acc, f) => acc + (f.confidence_score || 0), 0) / feedback.length * 100).toFixed(1)
    : '0';
  const resolutionRate = feedback.length > 0
    ? ((feedback.filter(f => f.resolution_status === 'resolved').length / feedback.length) * 100).toFixed(1)
    : '0';
  const knowledgeGaps = [...new Set(feedback.flatMap(f => f.knowledge_gaps_detected || []))];

  // Chart data
  const sentimentData = [
    { name: 'Positivo', value: feedback.filter(f => f.customer_sentiment === 'positive').length, color: '#10b981' },
    { name: 'Neutro', value: feedback.filter(f => f.customer_sentiment === 'neutral').length, color: '#6b7280' },
    { name: 'Negativo', value: feedback.filter(f => f.customer_sentiment === 'negative').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const metricsChartData = metrics.map(m => ({
    date: format(new Date(m.metric_date), 'dd/MM', { locale: ptBR }),
    confiança: (m.avg_confidence_score * 100),
    resolução: m.resolution_rate,
    escalação: m.escalation_rate,
  }));

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Evolução & Aprendizado
          </h2>
          <p className="text-muted-foreground">
            Acompanhe o desempenho e a evolução contínua dos agentes de IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedInstance} onValueChange={setSelectedInstance}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por agente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Agentes</SelectItem>
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Lightbulb className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingSuggestions}</p>
                <p className="text-xs text-muted-foreground">Sugestões Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Target className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgConfidence}%</p>
                <p className="text-xs text-muted-foreground">Confiança Média</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resolutionRate}%</p>
                <p className="text-xs text-muted-foreground">Taxa de Resolução</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{knowledgeGaps.length}</p>
                <p className="text-xs text-muted-foreground">Gaps de Conhecimento</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="errors">
            <XCircle className="h-4 w-4 mr-2 text-red-500" />
            Erros ({feedback.filter(f => (f.knowledge_gaps_detected?.length || 0) > 0 || f.customer_sentiment === 'negative' || f.resolution_status === 'escalated').length})
          </TabsTrigger>
          <TabsTrigger value="suggestions">
            <Lightbulb className="h-4 w-4 mr-2" />
            Sugestões ({pendingSuggestions})
          </TabsTrigger>
          <TabsTrigger value="gaps">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Gaps ({knowledgeGaps.length})
          </TabsTrigger>
          <TabsTrigger value="feedback">
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Evolution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Evolução ao Longo do Tempo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metricsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={metricsChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Area type="monotone" dataKey="confiança" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Confiança %" />
                      <Area type="monotone" dataKey="resolução" stackId="2" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} name="Resolução %" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Dados insuficientes para o gráfico
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sentiment Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Distribuição de Sentimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sentimentData.length > 0 ? (
                  <div className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {sentimentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Sem dados de sentimento
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Knowledge Gaps Quick View */}
          {knowledgeGaps.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Gaps de Conhecimento Detectados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {knowledgeGaps.slice(0, 10).map((gap, i) => (
                    <Badge key={i} variant="outline" className="border-amber-500/50">
                      {gap}
                    </Badge>
                  ))}
                  {knowledgeGaps.length > 10 && (
                    <Badge variant="secondary">+{knowledgeGaps.length - 10} mais</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <AgentErrorsPanel 
            feedback={feedback} 
            instances={instances}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {suggestions.filter(s => s.status === 'pending').map((suggestion) => (
                <Card key={suggestion.id} className="border-l-4 border-l-amber-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{suggestion.suggested_category}</Badge>
                          <Badge variant="outline">
                            Confiança: {(suggestion.confidence_score * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <h4 className="font-medium">{suggestion.suggested_title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {suggestion.suggested_content}
                        </p>
                        {suggestion.source_question && (
                          <p className="text-xs text-muted-foreground italic">
                            Pergunta original: "{suggestion.source_question}"
                          </p>
                        )}
                        {suggestion.suggested_keywords?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {suggestion.suggested_keywords.map((kw, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(suggestion.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveSuggestion(suggestion)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Implementar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectSuggestion(suggestion.id)}
                        >
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          Ignorar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {suggestions.filter(s => s.status === 'pending').length === 0 && (
                <Card className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">Nenhuma sugestão pendente de aprovação</p>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Gaps de Conhecimento por Frequência</CardTitle>
              <CardDescription>
                Tópicos que o agente não conseguiu responder adequadamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {knowledgeGaps.length > 0 ? (
                  knowledgeGaps.map((gap, i) => {
                    const count = feedback.filter(f => f.knowledge_gaps_detected?.includes(gap)).length;
                    const percentage = (count / feedback.length) * 100;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{gap}</span>
                          <span className="text-muted-foreground">{count}x ({percentage.toFixed(0)}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p>Nenhum gap de conhecimento detectado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {feedback.slice(0, 20).map((fb) => (
                <Card key={fb.id}>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={fb.resolution_status === 'resolved' ? 'default' : 'secondary'}
                          className={fb.resolution_status === 'resolved' ? 'bg-green-500' : ''}
                        >
                          {fb.resolution_status === 'resolved' ? 'Resolvido' : 
                           fb.resolution_status === 'escalated' ? 'Escalado' : 'Pendente'}
                        </Badge>
                        <Badge variant="outline">
                          Confiança: {((fb.confidence_score || 0) * 100).toFixed(0)}%
                        </Badge>
                        {fb.customer_sentiment && (
                          <Badge 
                            variant="outline"
                            className={
                              fb.customer_sentiment === 'positive' ? 'border-green-500 text-green-500' :
                              fb.customer_sentiment === 'negative' ? 'border-red-500 text-red-500' : ''
                            }
                          >
                            {fb.customer_sentiment === 'positive' ? '😊' : 
                             fb.customer_sentiment === 'negative' ? '😟' : '😐'}
                          </Badge>
                        )}
                        {fb.response_time_ms && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {fb.response_time_ms}ms
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-2 bg-muted rounded">
                          <p className="text-xs text-muted-foreground mb-1">Pergunta:</p>
                          <p className="line-clamp-2">{fb.message_content}</p>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <p className="text-xs text-muted-foreground mb-1">Resposta:</p>
                          <p className="line-clamp-2">{fb.response_content}</p>
                        </div>
                      </div>
                      {fb.knowledge_gaps_detected?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground">Gaps:</span>
                          {fb.knowledge_gaps_detected.map((gap, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-amber-500/50">
                              {gap}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(fb.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {feedback.length === 0 && (
                <Card className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum feedback registrado ainda</p>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
