import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Mail, Eye, Search, Package, Loader2 } from 'lucide-react';
import { useDispatchRecipients, DispatchRecipient } from '@/hooks/useDispatchRecipients';
import { SendTechnicianInviteDialog } from './SendTechnicianInviteDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function DispatchRecipientsTable() {
  const { recipients, loading, refetch } = useDispatchRecipients();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<DispatchRecipient | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [testingAs, setTestingAs] = useState<string | null>(null);
  const navigate = useNavigate();

  const filteredRecipients = recipients.filter(
    (r) =>
      r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer_document?.includes(searchTerm)
  );

  const handleTestAs = async (recipient: DispatchRecipient) => {
    try {
      setTestingAs(recipient.customer_name);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Atualizar perfil com documento de teste
      const testValue = recipient.customer_document || `NAME:${recipient.customer_name}`;
      
      const { error } = await supabase
        .from('profiles')
        .update({ test_as_customer_document: testValue })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Modo de teste ativado', {
        description: `Visualizando como: ${recipient.customer_name}`,
      });

      navigate('/technician-portal');
    } catch (error: any) {
      console.error('Error activating test mode:', error);
      toast.error('Erro ao ativar modo de teste');
    } finally {
      setTestingAs(null);
    }
  };

  const getStatusBadge = (recipient: DispatchRecipient) => {
    if (recipient.has_registered) {
      return <Badge className="bg-emerald-500">Cadastrado</Badge>;
    }
    if (recipient.invite_status === 'pending') {
      return <Badge variant="outline" className="border-amber-500 text-amber-500">Convite Enviado</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Destinatários de Remessas
              </CardTitle>
              <CardDescription>
                Técnicos e clientes com NFs de remessa para conserto/garantia
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRecipients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum destinatário encontrado
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-center">NFs Ativas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecipients.map((recipient, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{recipient.customer_name}</div>
                          {recipient.invite_email && (
                            <div className="text-xs text-muted-foreground">
                              Enviado para: {recipient.invite_email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {recipient.customer_document || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{recipient.nf_count}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(recipient)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!recipient.has_registered && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRecipient(recipient);
                                setShowInviteDialog(true);
                              }}
                            >
                              <Mail className="mr-1 h-4 w-4" />
                              {recipient.invite_status === 'pending' ? 'Reenviar' : 'Enviar Convite'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTestAs(recipient)}
                            disabled={testingAs === recipient.customer_name}
                          >
                            {testingAs === recipient.customer_name ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="mr-1 h-4 w-4" />
                            )}
                            Testar Visão
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SendTechnicianInviteDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        recipient={selectedRecipient}
        onSuccess={refetch}
      />
    </>
  );
}
