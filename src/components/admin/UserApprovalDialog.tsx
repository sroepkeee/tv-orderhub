import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface UserApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string;
    email: string;
  };
  onSuccess: () => void;
}

export const UserApprovalDialog = ({ open, onOpenChange, user, onSuccess }: UserApprovalDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const handleSubmit = async () => {
    if (action === 'reject' && !reason.trim()) {
      toast({
        title: "Motivo obrigatório",
        description: "Informe o motivo da rejeição",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Atualizar status de aprovação
      const { error: updateError } = await supabase
        .from('user_approval_status')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          approved_by: currentUser?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: action === 'reject' ? reason : null,
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Se aprovar, ativar perfil
      if (action === 'approve') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ is_active: true })
          .eq('id', user.id);

        if (profileError) throw profileError;
      }

      // Registrar no audit log
      const { error: logError } = await supabase
        .from('permission_audit_log')
        .insert({
          action_type: action === 'approve' ? 'user_approved' : 'user_rejected',
          performed_by: currentUser?.id,
          target_user_id: user.id,
          details: {
            user_name: user.full_name,
            user_email: user.email,
            rejection_reason: action === 'reject' ? reason : undefined,
          },
        });

      if (logError) throw logError;

      toast({
        title: action === 'approve' ? "Usuário aprovado" : "Usuário rejeitado",
        description: `${user.full_name} foi ${action === 'approve' ? 'aprovado' : 'rejeitado'} com sucesso`,
      });

      onSuccess();
      onOpenChange(false);
      setReason("");
    } catch (error) {
      console.error('Error updating approval:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do usuário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerenciar Aprovação</DialogTitle>
          <DialogDescription>
            Aprovar ou rejeitar acesso de {user.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Button
              variant={action === 'approve' ? 'default' : 'outline'}
              onClick={() => setAction('approve')}
              className="flex-1"
            >
              Aprovar
            </Button>
            <Button
              variant={action === 'reject' ? 'destructive' : 'outline'}
              onClick={() => setAction('reject')}
              className="flex-1"
            >
              Rejeitar
            </Button>
          </div>

          {action === 'reject' && (
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo da Rejeição *</Label>
              <Textarea
                id="reason"
                placeholder="Explique o motivo da rejeição..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Processando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
