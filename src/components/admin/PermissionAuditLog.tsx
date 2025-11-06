import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, XCircle, UserPlus, UserMinus, Settings } from "lucide-react";

interface AuditLogEntry {
  id: string;
  action_type: string;
  performed_by: string;
  performer_name: string;
  target_user_name: string;
  details: any;
  created_at: string;
}

export const PermissionAuditLog = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('permission_audit_log')
        .select(`
          id,
          action_type,
          performed_by,
          target_user_id,
          details,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Buscar nomes dos usuários
      const userIds = [...new Set([
        ...data.map(l => l.performed_by),
        ...data.map(l => l.target_user_id).filter(Boolean)
      ])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      const enrichedLogs: AuditLogEntry[] = data.map(log => ({
        id: log.id,
        action_type: log.action_type,
        performed_by: log.performed_by,
        performer_name: profileMap.get(log.performed_by) || 'Desconhecido',
        target_user_name: log.target_user_id ? (profileMap.get(log.target_user_id) || 'Desconhecido') : '',
        details: log.details,
        created_at: log.created_at,
      }));

      setLogs(enrichedLogs);
    } catch (error) {
      console.error('Error loading audit log:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'user_approved':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'user_rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'role_granted':
        return <UserPlus className="h-4 w-4 text-primary" />;
      case 'role_revoked':
        return <UserMinus className="h-4 w-4 text-warning" />;
      case 'permission_changed':
        return <Settings className="h-4 w-4 text-info" />;
      default:
        return null;
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'user_approved':
        return 'Usuário Aprovado';
      case 'user_rejected':
        return 'Usuário Rejeitado';
      case 'role_granted':
        return 'Role Concedida';
      case 'role_revoked':
        return 'Role Revogada';
      case 'permission_changed':
        return 'Permissão Alterada';
      default:
        return actionType;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log de Auditoria</CardTitle>
        <CardDescription>Histórico de ações de gerenciamento de usuários e permissões</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead>Realizado por</TableHead>
                <TableHead>Usuário alvo</TableHead>
                <TableHead>Detalhes</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando logs...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma atividade registrada
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action_type)}
                        <Badge variant="outline">
                          {getActionLabel(log.action_type)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{log.performer_name}</TableCell>
                    <TableCell>{log.target_user_name || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {JSON.stringify(log.details)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
