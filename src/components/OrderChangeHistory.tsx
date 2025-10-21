import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, Truck, Package, Edit, ArrowRight, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getStatusLabel } from "@/lib/statusLabels";

interface OrderChange {
  id: string;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  change_category?: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export function OrderChangeHistory({ orderId }: { orderId: string }) {
  const [changes, setChanges] = useState<OrderChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChanges();
  }, [orderId]);

  const loadChanges = async () => {
    const { data, error } = await supabase
      .from('order_changes')
      .select(`
        id,
        changed_at,
        field_name,
        old_value,
        new_value,
        changed_by,
        change_category,
        profiles:changed_by (
          full_name,
          email
        )
      `)
      .eq('order_id', orderId)
      .order('changed_at', { ascending: false });

    if (!error && data) {
      setChanges(data as any);
    }
    setLoading(false);
  };

  const fieldLabels: Record<string, string> = {
    customer_name: 'Cliente',
    delivery_date: 'Prazo de Entrega',
    status: 'Status',
    priority: 'Prioridade',
    order_type: 'Tipo de Pedido',
    notes: 'Observações',
    freight_type: 'Tipo de Frete',
    carrier_name: 'Transportadora',
    tracking_code: 'Código de Rastreio',
    package_volumes: 'Volumes',
    package_weight_kg: 'Peso (Kg)',
    package_height_m: 'Altura (m)',
    package_width_m: 'Largura (m)',
    package_length_m: 'Comprimento (m)',
    created: 'Pedido Criado',
  };
  
  // Helper: Obter ícone baseado na categoria
  const getChangeIcon = (category?: string) => {
    switch (category) {
      case 'order_creation': return <Plus className="h-4 w-4 text-emerald-600" />;
      case 'status_change': return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'shipping_info': return <Truck className="h-4 w-4 text-green-600" />;
      case 'dimensions': return <Package className="h-4 w-4 text-purple-600" />;
      default: return <Edit className="h-4 w-4 text-gray-600" />;
    }
  };
  
  // Helper: Obter badge de categoria
  const getCategoryBadge = (category?: string) => {
    const colors = {
      'order_creation': { bg: 'bg-emerald-100 text-emerald-700 border-emerald-300', label: '🎉 Criação' },
      'status_change': { bg: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Status' },
      'shipping_info': { bg: 'bg-green-100 text-green-700 border-green-200', label: 'Frete' },
      'dimensions': { bg: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Dimensões' },
      'field_update': { bg: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Campo' },
    };
    
    const config = colors[category as keyof typeof colors] || colors.field_update;
    
    return (
      <Badge variant="outline" className={`${config.bg} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando histórico...</div>;
  if (changes.length === 0) return <div className="text-muted-foreground text-sm">Nenhuma alteração registrada</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Histórico de Alterações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {changes.map((change) => {
          const isCreationEvent = change.field_name === 'created';
          
          return (
            <div key={change.id} className="flex gap-3 pb-4 border-b last:border-0">
              <div className="flex-shrink-0 mt-1">
                {getChangeIcon(change.change_category)}
              </div>
              
              <div className="flex-1 space-y-2">
                {/* Usuário e categoria */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {change.profiles?.full_name?.[0] || change.profiles?.email?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">
                    {change.profiles?.full_name || change.profiles?.email || 'Usuário'}
                  </span>
                  {getCategoryBadge(change.change_category)}
                </div>
                
                {/* Mensagem customizada para criação */}
                {isCreationEvent ? (
                  <div className="text-sm">
                    <span className="font-medium">
                      {change.new_value === 'imported' ? 
                        '📥 Importou este pedido do TOTVS' : 
                        '✨ Criou este pedido manualmente'
                      }
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Campo alterado */}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Alterou </span>
                      <span className="font-medium">{fieldLabels[change.field_name] || change.field_name}</span>
                    </div>
                    
                    {/* Valores (antes → depois) */}
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="line-through text-muted-foreground bg-red-50 dark:bg-red-950 px-2 py-1 rounded border border-red-200">
                        {change.field_name === 'status' 
                          ? getStatusLabel(change.old_value) 
                          : (change.old_value || '(vazio)')}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium bg-green-50 dark:bg-green-950 px-2 py-1 rounded border border-green-200">
                        {change.field_name === 'status' 
                          ? getStatusLabel(change.new_value) 
                          : change.new_value}
                      </span>
                    </div>
                  </>
                )}
                
                {/* Data/hora */}
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(change.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
