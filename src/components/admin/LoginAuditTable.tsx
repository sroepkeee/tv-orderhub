import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Download, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LoginAudit {
  id: string;
  user_id: string;
  description: string;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: {
    login_method?: string;
    browser?: { name: string; version: string };
    os?: { name: string; version: string };
  };
  profiles: {
    full_name: string;
    email: string;
  };
}

export function LoginAuditTable() {
  const [logins, setLogins] = useState<LoginAudit[]>([]);
  const [filteredLogins, setFilteredLogins] = useState<LoginAudit[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogins();
  }, []);

  useEffect(() => {
    const filtered = logins.filter(login =>
      login.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      login.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      login.metadata?.login_method?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredLogins(filtered);
  }, [searchTerm, logins]);

  const loadLogins = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activity_log')
        .select(`
          id,
          user_id,
          description,
          created_at,
          ip_address,
          user_agent,
          metadata,
          profiles!user_activity_log_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq('action_type', 'login')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogins(data as any || []);
      setFilteredLogins(data as any || []);
    } catch (error) {
      console.error('Erro ao carregar logins:', error);
    } finally {
      setLoading(false);
    }
  };

  const maskIP = (ip: string | null) => {
    if (!ip) return 'N/A';
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return ip;
  };

  const exportToCSV = () => {
    const headers = ['Nome', 'Email', 'Método', 'IP', 'Navegador', 'SO', 'Data/Hora'];
    const rows = filteredLogins.map(login => [
      login.profiles?.full_name || 'N/A',
      login.profiles?.email || 'N/A',
      login.metadata?.login_method === 'azure' ? 'Microsoft' : 'Email',
      login.ip_address || 'N/A',
      `${login.metadata?.browser?.name || 'N/A'} ${login.metadata?.browser?.version || ''}`,
      `${login.metadata?.os?.name || 'N/A'} ${login.metadata?.os?.version || ''}`,
      new Date(login.created_at).toLocaleString('pt-BR')
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-logins-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Auditoria de Logins</CardTitle>
            <CardDescription>
              Histórico completo de acessos ao sistema com IP e dispositivo
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
              placeholder="Buscar por nome, email ou método..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse h-16 bg-muted rounded"></div>
            ))}
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Navegador/SO</TableHead>
                    <TableHead>Data/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum login encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogins.map((login) => (
                      <TableRow key={login.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{login.profiles?.full_name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">{login.profiles?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {login.metadata?.login_method === 'azure' ? (
                            <Badge className="gap-1 bg-blue-500/10 text-blue-700 border-blue-500/20 hover:bg-blue-500/20">
                              <Shield className="h-3 w-3" />
                              Microsoft
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Mail className="h-3 w-3" />
                              Email
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {maskIP(login.ip_address)}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">
                              {login.metadata?.browser?.name || 'N/A'} {login.metadata?.browser?.version}
                            </p>
                            <p className="text-muted-foreground">
                              {login.metadata?.os?.name || 'N/A'} {login.metadata?.os?.version}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {formatDistanceToNow(new Date(login.created_at), {
                              locale: ptBR,
                              addSuffix: true
                            })}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {new Date(login.created_at).toLocaleString('pt-BR')}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
