import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Flag, MessageSquare, Eye } from "lucide-react";
import { toast } from "sonner";
import { DateChangeActionDialog } from "./DateChangeActionDialog";

interface EnhancedDateChange {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  old_date: string;
  new_date: string;
  changed_at: string;
  change_source: string;
  reason?: string;
  change_category?: 'justified' | 'factory_delay' | 'logistics_issue' | 'client_request' | 'internal_error' | 'other';
  factory_followup_required: boolean;
  factory_contacted_at?: string;
  factory_response?: string;
  marked_as_stalling: boolean;
  notes?: string;
  days_delayed: number;
}

interface EnhancedDateChangeHistoryProps {
  limit?: number;
  orders: any[];
}

export function EnhancedDateChangeHistory({ limit = 20, orders }: EnhancedDateChangeHistoryProps) {
  const [dateChanges, setDateChanges] = useState<EnhancedDateChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stallingFilter, setStallingFilter] = useState(false);
  const [followupFilter, setFollowupFilter] = useState(false);
  const [selectedChange, setSelectedChange] = useState<EnhancedDateChange | null>(null);
  const [actionType, setActionType] = useState<'followup' | 'stalling' | 'note' | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const loadDateChanges = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("delivery_date_changes")
        .select(`
          *,
          orders!inner(
            order_number,
            customer_name,
            status
          )
        `)
        .order("changed_at", { ascending: false });

      // NOVO: Filtrar apenas por pedidos ativos se showOnlyActive estiver ativo
      if (showOnlyActive) {
        const activeOrderIds = orders.map(o => o.id);
        query = query.in('order_id', activeOrderIds);
      }

      if (limit && showOnlyActive) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      const enhancedData = data?.map((change: any) => ({
        id: change.id,
        order_id: change.order_id,
        order_number: change.orders.order_number,
        customer_name: change.orders.customer_name,
        old_date: change.old_date,
        new_date: change.new_date,
        changed_at: change.changed_at,
        change_source: change.change_source,
        reason: change.reason,
        change_category: change.change_category,
        factory_followup_required: change.factory_followup_required || false,
        factory_contacted_at: change.factory_contacted_at,
        factory_response: change.factory_response,
        marked_as_stalling: change.marked_as_stalling || false,
        notes: change.notes,
        days_delayed: differenceInDays(new Date(change.new_date), new Date(change.old_date))
      })) || [];

      setDateChanges(enhancedData);
    } catch (error) {
      console.error("Error loading date changes:", error);
      toast.error("Erro ao carregar histórico de mudanças");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDateChanges();
  }, [orders, limit, showOnlyActive]);

  const filteredChanges = dateChanges.filter(change => {
    if (categoryFilter !== "all" && change.change_category !== categoryFilter) return false;
    if (stallingFilter && !change.marked_as_stalling) return false;
    if (followupFilter && !change.factory_followup_required) return false;
    return true;
  });

  const stats = {
    total: dateChanges.length,
    stalling: dateChanges.filter(c => c.marked_as_stalling).length,
    followup: dateChanges.filter(c => c.factory_followup_required && !c.factory_contacted_at).length,
    resolved: dateChanges.filter(c => c.factory_response).length
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'factory_delay': return '🏭';
      case 'justified': return '✅';
      case 'client_request': return '👤';
      case 'logistics_issue': return '🚚';
      case 'internal_error': return '⚠️';
      default: return '📋';
    }
  };

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case 'factory_delay': return 'Atraso Fábrica';
      case 'justified': return 'Justificado';
      case 'client_request': return 'Pedido Cliente';
      case 'logistics_issue': return 'Logística';
      case 'internal_error': return 'Erro Interno';
      default: return 'Outro';
    }
  };

  const getDelayBadgeVariant = (days: number): "default" | "secondary" | "destructive" => {
    if (days <= 3) return "default";
    if (days <= 7) return "secondary";
    return "destructive";
  };

  const handleActionComplete = () => {
    loadDateChanges();
    setSelectedChange(null);
    setActionType(null);
  };

  // NOVO: Métricas avançadas
  const advancedMetrics = useMemo(() => {
    // Atrasos por fornecedor/cliente
    const byCustomer: Record<string, { count: number, totalDelay: number }> = {};
    
    filteredChanges.forEach(change => {
      if (!byCustomer[change.customer_name]) {
        byCustomer[change.customer_name] = { count: 0, totalDelay: 0 };
      }
      byCustomer[change.customer_name].count++;
      byCustomer[change.customer_name].totalDelay += change.days_delayed;
    });
    
    const topProblemCustomers = Object.entries(byCustomer)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgDelay: Math.round(data.totalDelay / data.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    // Padrões por dia da semana
    const byWeekday = [0, 0, 0, 0, 0, 0, 0];
    filteredChanges.forEach(change => {
      const day = new Date(change.changed_at).getDay();
      byWeekday[day]++;
    });
    const peakDay = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][byWeekday.indexOf(Math.max(...byWeekday))];
    
    // Atraso médio por categoria
    const avgDelayByCategory: Record<string, number> = {};
    const countByCategory: Record<string, number> = {};
    
    filteredChanges.forEach(change => {
      const cat = change.change_category || 'other';
      if (!avgDelayByCategory[cat]) {
        avgDelayByCategory[cat] = 0;
        countByCategory[cat] = 0;
      }
      avgDelayByCategory[cat] += change.days_delayed;
      countByCategory[cat]++;
    });
    
    Object.keys(avgDelayByCategory).forEach(cat => {
      avgDelayByCategory[cat] = Math.round(avgDelayByCategory[cat] / countByCategory[cat]);
    });
    
    return {
      topProblemCustomers,
      peakDay,
      avgDelayByCategory
    };
  }, [filteredChanges]);

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Carregando histórico de mudanças...</p>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h3 className="text-lg font-semibold mb-2">📅 Histórico de Mudanças de Prazos</h3>
            <p className="text-sm text-muted-foreground">
              Acompanhe e controle todas as alterações de prazos de entrega
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Mudanças</div>
            </div>
            <div className="bg-destructive/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-destructive">{stats.stalling}</div>
              <div className="text-xs text-muted-foreground">Enrolações</div>
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{stats.followup}</div>
              <div className="text-xs text-muted-foreground">Aguardando Cobrança</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-500">{stats.resolved}</div>
              <div className="text-xs text-muted-foreground">Resolvidas</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2 px-3 py-1 border rounded-md bg-background">
              <Switch 
                checked={showOnlyActive} 
                onCheckedChange={setShowOnlyActive}
                id="active-only"
              />
              <Label htmlFor="active-only" className="text-sm cursor-pointer">
                Apenas Ativos
              </Label>
            </div>

            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1 rounded-md border bg-background text-sm"
            >
              <option value="all">Todas as Categorias</option>
              <option value="factory_delay">🏭 Atrasos de Fábrica</option>
              <option value="justified">✅ Justificadas</option>
              <option value="client_request">👤 Pedido do Cliente</option>
              <option value="logistics_issue">🚚 Problema Logístico</option>
              <option value="internal_error">⚠️ Erro Interno</option>
            </select>
            
            <Badge 
              variant={stallingFilter ? "destructive" : "outline"}
              className="cursor-pointer"
              onClick={() => setStallingFilter(!stallingFilter)}
            >
              🚩 Apenas Enrolações ({stats.stalling})
            </Badge>
            
            <Badge 
              variant={followupFilter ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFollowupFilter(!followupFilter)}
            >
              📞 Aguardando Cobrança ({stats.followup})
            </Badge>
          </div>

          {/* NOVO: Métricas Avançadas */}
          {advancedMetrics.topProblemCustomers.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm">📊 Insights de Mudanças</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Clientes com Mais Atrasos:</div>
                  {advancedMetrics.topProblemCustomers.map((customer, i) => (
                    <div key={i} className="text-xs">
                      {i + 1}. {customer.name} ({customer.count}x, média {customer.avgDelay}d)
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Dia com Mais Mudanças:</div>
                  <div className="font-semibold">{advancedMetrics.peakDay}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Atraso Médio por Categoria:</div>
                  {Object.entries(advancedMetrics.avgDelayByCategory).slice(0, 2).map(([cat, avg]) => (
                    <div key={cat} className="text-xs">
                      {getCategoryLabel(cat)}: {avg} dias
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 text-sm font-medium">Pedido</th>
                  <th className="text-left py-2 px-2 text-sm font-medium">Cliente</th>
                  <th className="text-left py-2 px-2 text-sm font-medium">Data Antiga</th>
                  <th className="text-left py-2 px-2 text-sm font-medium">Data Nova</th>
                  <th className="text-left py-2 px-2 text-sm font-medium">Atraso</th>
                  <th className="text-left py-2 px-2 text-sm font-medium">Categoria</th>
                  <th className="text-left py-2 px-2 text-sm font-medium">Status</th>
                  <th className="text-right py-2 px-2 text-sm font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredChanges.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma mudança de prazo encontrada
                    </td>
                  </tr>
                ) : (
                  filteredChanges.map((change) => (
                    <tr key={change.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2 text-sm font-medium">{change.order_number}</td>
                      <td className="py-3 px-2 text-sm">{change.customer_name}</td>
                      <td className="py-3 px-2 text-sm">
                        {format(new Date(change.old_date), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className="py-3 px-2 text-sm">
                        {format(new Date(change.new_date), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={getDelayBadgeVariant(change.days_delayed)}>
                          +{change.days_delayed}d
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-sm">
                        {getCategoryIcon(change.change_category)} {getCategoryLabel(change.change_category)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          {change.marked_as_stalling && (
                            <Badge variant="destructive" className="text-xs">🚩</Badge>
                          )}
                          {change.factory_followup_required && !change.factory_contacted_at && (
                            <Badge variant="secondary" className="text-xs">📞</Badge>
                          )}
                          {change.factory_response && (
                            <Badge variant="default" className="text-xs">✅</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1 justify-end">
                          {!change.factory_contacted_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedChange(change);
                                setActionType('followup');
                              }}
                            >
                              <Phone className="h-3 w-3" />
                            </Button>
                          )}
                          {!change.marked_as_stalling && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedChange(change);
                                setActionType('stalling');
                              }}
                            >
                              <Flag className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedChange(change);
                              setActionType('note');
                            }}
                          >
                            <MessageSquare className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {selectedChange && actionType && (
        <DateChangeActionDialog
          change={selectedChange}
          actionType={actionType}
          open={!!selectedChange}
          onClose={() => {
            setSelectedChange(null);
            setActionType(null);
          }}
          onSuccess={handleActionComplete}
        />
      )}
    </>
  );
}
