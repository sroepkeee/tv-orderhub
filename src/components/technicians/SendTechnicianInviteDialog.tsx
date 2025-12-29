import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Send, Loader2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendTechnicianInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: {
    customer_name: string;
    customer_document: string | null;
    nf_count: number;
  } | null;
  onSuccess: () => void;
}

export function SendTechnicianInviteDialog({
  open,
  onOpenChange,
  recipient,
  onSuccess,
}: SendTechnicianInviteDialogProps) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!recipient || !email) return;

    try {
      setSending(true);

      // Buscar organization_id do usuário atual
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data, error } = await supabase.functions.invoke('send-technician-invite', {
        body: {
          customer_name: recipient.customer_name,
          customer_document: recipient.customer_document,
          email,
          nf_count: recipient.nf_count,
          organization_id: profile?.organization_id,
        },
      });

      if (error) throw error;

      toast.success('Convite enviado com sucesso!', {
        description: `Email enviado para ${email}`,
      });

      setEmail('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error sending invite:', error);
      toast.error('Erro ao enviar convite', {
        description: error.message || 'Tente novamente mais tarde',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar Link de Cadastro
          </DialogTitle>
        </DialogHeader>

        {recipient && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Destinatário</Label>
                <p className="font-medium">{recipient.customer_name}</p>
              </div>
              {recipient.customer_document && (
                <div>
                  <Label className="text-xs text-muted-foreground">Documento</Label>
                  <p className="font-mono text-sm">{recipient.customer_document}</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>{recipient.nf_count} NF(s) ativa(s)</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email do Técnico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tecnico@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
              />
              <p className="text-xs text-muted-foreground">
                O técnico receberá um email com link para criar o acesso
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={!email || sending}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar Convite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
