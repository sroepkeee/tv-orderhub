import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserPresence } from "@/hooks/useUserPresence";

interface UserSession {
  id: string;
  full_name: string;
  email: string;
  department: string;
  last_login: string | null;
  is_active: boolean;
  activity_count: number;
}

export function UserSessionsTable() {
  const { onlineUsers } = useUserPresence();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<UserSession[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    const filtered = sessions.filter(session =>
      session.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSessions(filtered);
  }, [searchTerm, sessions]);

  const loadSessions = async () => {
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, last_login, is_active')
        .order('last_login', { ascending: false, nullsFirst: false });

      if (profileError) throw profileError;

      // Get activity counts for each user
      const sessionsWithActivity = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { count } = await supabase
            .from('user_activity_log')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          return {
            ...profile,
            activity_count: count || 0
          };
        })
      );

      setSessions(sessionsWithActivity as UserSession[]);
      setFilteredSessions(sessionsWithActivity as UserSession[]);
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    } finally {
      setLoading(false);
    }
  };

  const isUserOnline = (userId: string) => {
    return onlineUsers.some(user => user.user_id === userId);
  };

  const exportToCSV = () => {
    const headers = ['Nome', 'Email', 'Departamento', 'Status', 'Último Acesso', 'Ações'];
    const rows = filteredSessions.map(session => [
      session.full_name || 'N/A',
      session.email || 'N/A',
      session.department || 'N/A',
      isUserOnline(session.id) ? 'Online' : 'Offline',
      session.last_login ? new Date(session.last_login).toLocaleString('pt-BR') : 'Nunca',
      session.activity_count
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessoes-usuarios-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sessões de Usuários</CardTitle>
            <CardDescription>
              Histórico detalhado de acessos e atividades
            </CardDescription>
          </div>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou departamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse h-12 bg-muted rounded"></div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma sessão encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSessions.map((session) => {
                    const online = isUserOnline(session.id);
                    return (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{session.full_name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">{session.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{session.department || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={online ? "default" : "secondary"} className="gap-1">
                            <span className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            {online ? 'Online' : 'Offline'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {session.last_login ? (
                            <span className="text-sm">
                              {formatDistanceToNow(new Date(session.last_login), {
                                locale: ptBR,
                                addSuffix: true
                              })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Nunca</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{session.activity_count}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
