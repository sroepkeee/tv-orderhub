import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "lucide-react";

interface DateChange {
  id: string;
  order_id: string;
  old_date: string;
  new_date: string;
  changed_at: string;
  change_source: string;
  reason?: string;
}

interface DateChangeHistoryProps {
  orderId?: string;
  limit?: number;
}

export const DateChangeHistory = ({ orderId, limit = 10 }: DateChangeHistoryProps) => {
  const [changes, setChanges] = useState<DateChange[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadDateChanges();
  }, [orderId]);
  
  const loadDateChanges = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('delivery_date_changes')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(limit);
      
      if (orderId) {
        query = query.eq('order_id', orderId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setChanges(data || []);
    } catch (error) {
      console.error('Error loading date changes:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Histórico de Mudanças de Prazo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (changes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Histórico de Mudanças de Prazo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            Nenhuma mudança de prazo registrada
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Histórico de Mudanças de Prazo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {changes.map(change => (
            <div 
              key={change.id} 
              className="flex justify-between items-center text-sm border-b pb-3 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="line-through text-[hsl(var(--destructive))]">
                  {format(new Date(change.old_date), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="text-[hsl(var(--progress-good))] font-medium">
                  {format(new Date(change.new_date), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
              <span className="text-muted-foreground text-xs">
                {format(new Date(change.changed_at), 'dd/MM HH:mm', { locale: ptBR })}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
