import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrderChange {
  id: string;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
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
        {changes.map((change) => (
          <div key={change.id} className="flex gap-3 pb-3 border-b last:border-0">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {change.profiles?.full_name?.[0] || change.profiles?.email?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="text-sm">
                <span className="font-medium">
                  {change.profiles?.full_name || change.profiles?.email || 'Usuário'}
                </span>
                {' alterou '}
                <span className="font-medium">{fieldLabels[change.field_name] || change.field_name}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="line-through">{change.old_value || '(vazio)'}</span>
                {' → '}
                <span className="font-medium text-foreground">{change.new_value}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(change.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
