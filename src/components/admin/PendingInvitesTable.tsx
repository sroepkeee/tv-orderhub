import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail, RefreshCw, X, Clock, CheckCircle, XCircle, Copy, Loader2 } from "lucide-react";

interface Invite {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  sent_at: string;
  expires_at: string;
  invite_token: string;
  invited_by: string;
  inviter_name?: string;
}

export function PendingInvitesTable() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const loadInvites = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_invites')
        .select(`
          id,
          email,
          name,
          role,
          status,
          sent_at,
          expires_at,
          invite_token,
          invited_by
        `)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      // Fetch inviter names
      const inviterIds = [...new Set(data?.map(i => i.invited_by).filter(Boolean))];
      let inviterNames: Record<string, string> = {};
      
      if (inviterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', inviterIds);
        
        inviterNames = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name || 'Usuário';
          return acc;
        }, {} as Record<string, string>);
      }

      setInvites((data || []).map(invite => ({
        ...invite,
        inviter_name: invite.invited_by ? inviterNames[invite.invited_by] : undefined
      })));
    } catch (error) {
      console.error('Error loading invites:', error);
      toast.error('Erro ao carregar convites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvites();
  }, []);

  const getStatusBadge = (invite: Invite) => {
    if (invite.status === 'accepted') {
      return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Aceito</Badge>;
    }
    if (invite.status === 'cancelled') {
      return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Cancelado</Badge>;
    }
    if (isPast(new Date(invite.expires_at))) {
      return <Badge variant="destructive" className="gap-1"><Clock className="h-3 w-3" /> Expirado</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive">Admin</Badge>;
      case 'viewer':
        return <Badge variant="secondary">Visualizador</Badge>;
      default:
        return <Badge variant="outline">Membro</Badge>;
    }
  };

  const handleResend = async (invite: Invite) => {
    setResending(invite.id);
    try {
      const response = await supabase.functions.invoke('send-organization-invite', {
        body: {
          email: invite.email,
          name: invite.name,
          role: invite.role,
          sendViaEmail: true,
          sendViaWhatsApp: false,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast.success('Convite reenviado com sucesso');
      loadInvites();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao reenviar convite');
    } finally {
      setResending(null);
    }
  };

  const handleCancel = async (invite: Invite) => {
    setCancelling(invite.id);
    try {
      const { error } = await supabase
        .from('organization_invites')
        .update({ status: 'cancelled' })
        .eq('id', invite.id);

      if (error) throw error;

      toast.success('Convite cancelado');
      loadInvites();
    } catch (error: any) {
      toast.error('Erro ao cancelar convite');
    } finally {
      setCancelling(null);
    }
  };

  const copyInviteLink = async (token: string) => {
    const url = `${window.location.origin}/auth?type=invite&token=${token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (invites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Convites Enviados
          </CardTitle>
          <CardDescription>
            Nenhum convite enviado ainda
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Convites Enviados
        </CardTitle>
        <CardDescription>
          Gerencie os convites pendentes e histórico
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead>Convidado por</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell className="font-medium">{invite.email}</TableCell>
                <TableCell>{invite.name || '-'}</TableCell>
                <TableCell>{getRoleBadge(invite.role)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {invite.inviter_name || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(invite.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell>{getStatusBadge(invite)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {invite.status === 'pending' && !isPast(new Date(invite.expires_at)) && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyInviteLink(invite.invite_token)}
                          title="Copiar link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleResend(invite)}
                          disabled={resending === invite.id}
                          title="Reenviar"
                        >
                          {resending === invite.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancel(invite)}
                          disabled={cancelling === invite.id}
                          title="Cancelar"
                        >
                          {cancelling === invite.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}