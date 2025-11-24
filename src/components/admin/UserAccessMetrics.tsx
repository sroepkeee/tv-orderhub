import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Clock, TrendingUp, Activity } from "lucide-react";
import { useUserPresence } from "@/hooks/useUserPresence";
import { startOfDay, subDays } from "date-fns";

interface AccessMetrics {
  todayLogins: number;
  weekLogins: number;
  totalUsers: number;
}

export function UserAccessMetrics() {
  const { onlineUsers } = useUserPresence();
  const [metrics, setMetrics] = useState<AccessMetrics>({
    todayLogins: 0,
    weekLogins: 0,
    totalUsers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const today = startOfDay(new Date());
      const weekAgo = subDays(today, 7);

      const [todayResult, weekResult, totalResult] = await Promise.all([
        // Logins today
        supabase
          .from('user_activity_log')
          .select('id', { count: 'exact', head: true })
          .eq('action_type', 'login')
          .gte('created_at', today.toISOString()),
        
        // Logins this week
        supabase
          .from('user_activity_log')
          .select('id', { count: 'exact', head: true })
          .eq('action_type', 'login')
          .gte('created_at', weekAgo.toISOString()),
        
        // Total users
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
      ]);

      setMetrics({
        todayLogins: todayResult.count || 0,
        weekLogins: weekResult.count || 0,
        totalUsers: totalResult.count || 0
      });
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      title: "Online Agora",
      value: onlineUsers.length,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-500/10"
    },
    {
      title: "Acessos Hoje",
      value: metrics.todayLogins,
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10"
    },
    {
      title: "Acessos (7 dias)",
      value: metrics.weekLogins,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10"
    },
    {
      title: "Total de Usuários",
      value: metrics.totalUsers,
      icon: Activity,
      color: "text-orange-600",
      bgColor: "bg-orange-500/10"
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <CardDescription className="text-xs mt-1">
                {card.title === "Online Agora" && "Usuários conectados"}
                {card.title === "Acessos Hoje" && "Logins nas últimas 24h"}
                {card.title === "Acessos (7 dias)" && "Logins na última semana"}
                {card.title === "Total de Usuários" && "Cadastrados no sistema"}
              </CardDescription>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
