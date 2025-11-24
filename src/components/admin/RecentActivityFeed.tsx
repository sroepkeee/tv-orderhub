import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, UserPlus, Trash2, Edit, LogIn, FileText } from "lucide-react";

interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  description: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

const getActivityIcon = (actionType: string) => {
  switch (actionType) {
    case 'login':
      return <LogIn className="h-4 w-4" />;
    case 'user_approved':
    case 'user_rejected':
      return <UserPlus className="h-4 w-4" />;
    case 'delete':
      return <Trash2 className="h-4 w-4" />;
    case 'update':
      return <Edit className="h-4 w-4" />;
    case 'create':
      return <FileText className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

const getActivityColor = (actionType: string) => {
  switch (actionType) {
    case 'login':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'user_approved':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'user_rejected':
    case 'delete':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'update':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'create':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export function RecentActivityFeed() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();

    // Real-time subscription
    const channel = supabase
      .channel('activity-feed')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_activity_log'
      }, async (payload) => {
        console.log('📊 Nova atividade:', payload);
        
        // Fetch user profile for the new activity
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', payload.new.user_id)
          .single();

        if (profile) {
          setActivities(prev => [{
            ...payload.new,
            profiles: profile
          } as ActivityLog, ...prev].slice(0, 50));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activity_log')
        .select(`
          id,
          user_id,
          action_type,
          description,
          created_at,
          profiles!user_activity_log_user_id_fkey (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setActivities(data as any || []);
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle>Atividades Recentes</CardTitle>
        </div>
        <CardDescription>
          Feed de ações realizadas no sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse h-20 bg-muted rounded-lg"></div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma atividade recente
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className={`p-2 rounded-full ${getActivityColor(activity.action_type)}`}>
                    {getActivityIcon(activity.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">
                        {activity.profiles?.full_name || 'Usuário'}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {activity.action_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), {
                        locale: ptBR,
                        addSuffix: true
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
