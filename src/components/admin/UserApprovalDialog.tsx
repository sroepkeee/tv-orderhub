import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";

// Mapeamento de role para permissões de fase padrão
const ROLE_DEFAULT_PHASES: Record<string, { phase_key: string; can_view: boolean; can_edit: boolean; can_advance: boolean }[]> = {
  purchases: [
    { phase_key: 'almox_ssm', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'order_generation', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'purchases', can_view: true, can_edit: true, can_advance: true },
    { phase_key: 'almox_general', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'production_client', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'production_stock', can_view: true, can_edit: false, can_advance: false },
  ],
  almox_ssm: [
    { phase_key: 'almox_ssm', can_view: true, can_edit: true, can_advance: true },
    { phase_key: 'order_generation', can_view: true, can_edit: false, can_advance: false },
  ],
  order_generation: [
    { phase_key: 'almox_ssm', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'order_generation', can_view: true, can_edit: true, can_advance: true },
    { phase_key: 'purchases', can_view: true, can_edit: false, can_advance: false },
  ],
  production_client: [
    { phase_key: 'purchases', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'almox_general', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'production_client', can_view: true, can_edit: true, can_advance: true },
    { phase_key: 'production_stock', can_view: true, can_edit: false, can_advance: false },
  ],
  production_stock: [
    { phase_key: 'almox_general', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'production_client', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'production_stock', can_view: true, can_edit: true, can_advance: true },
    { phase_key: 'balance_generation', can_view: true, can_edit: false, can_advance: false },
  ],
  laboratory: [
    { phase_key: 'balance_generation', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'laboratory', can_view: true, can_edit: true, can_advance: true },
    { phase_key: 'packaging', can_view: true, can_edit: false, can_advance: false },
  ],
  packaging: [
    { phase_key: 'laboratory', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'packaging', can_view: true, can_edit: true, can_advance: true },
    { phase_key: 'freight_quote', can_view: true, can_edit: false, can_advance: false },
  ],
  freight_quote: [
    { phase_key: 'packaging', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'freight_quote', can_view: true, can_edit: true, can_advance: true },
    { phase_key: 'invoicing', can_view: true, can_edit: false, can_advance: false },
  ],
  invoicing: [
    { phase_key: 'freight_quote', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'invoicing', can_view: true, can_edit: true, can_advance: true },
    { phase_key: 'logistics', can_view: true, can_edit: false, can_advance: false },
  ],
  logistics: [
    { phase_key: 'invoicing', can_view: true, can_edit: false, can_advance: false },
    { phase_key: 'logistics', can_view: true, can_edit: true, can_advance: true },
    { phase_key: 'in_transit', can_view: true, can_edit: true, can_advance: true },
    { phase_key: 'completion', can_view: true, can_edit: false, can_advance: false },
  ],
};

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
  const { organization } = useOrganization();

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

      // Se aprovar, ativar perfil e vincular à organização
      if (action === 'approve') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ is_active: true })
          .eq('id', user.id);

        if (profileError) throw profileError;

        // Verificar se usuário já está em alguma organização
        const { data: existingMembership } = await supabase
          .from('organization_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        // Se não está em nenhuma organização, adicionar à do admin
        if (!existingMembership && organization?.id) {
          const { error: memberError } = await supabase
            .from('organization_members')
            .insert({
              organization_id: organization.id,
              user_id: user.id,
              role: 'member',
              is_active: true,
            });

          if (memberError) {
            console.error('Error adding to organization:', memberError);
            toast({
              title: "Atenção",
              description: "Usuário aprovado, mas houve erro ao vincular à organização",
            });
          }
        }

        // Buscar roles do usuário para aplicar permissões de fase padrão
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (userRoles && userRoles.length > 0 && organization?.id) {
          const phasePermissions: {
            user_id: string;
            phase_key: string;
            can_view: boolean;
            can_edit: boolean;
            can_advance: boolean;
            can_delete: boolean;
            organization_id: string;
          }[] = [];

          // Coletar permissões de todas as roles
          for (const { role } of userRoles) {
            const defaultPhases = ROLE_DEFAULT_PHASES[role];
            if (defaultPhases) {
              for (const phase of defaultPhases) {
                // Verificar se já existe essa fase na lista
                const existing = phasePermissions.find(p => p.phase_key === phase.phase_key);
                if (existing) {
                  // Merge: manter o mais permissivo
                  existing.can_view = existing.can_view || phase.can_view;
                  existing.can_edit = existing.can_edit || phase.can_edit;
                  existing.can_advance = existing.can_advance || phase.can_advance;
                } else {
                  phasePermissions.push({
                    user_id: user.id,
                    phase_key: phase.phase_key,
                    can_view: phase.can_view,
                    can_edit: phase.can_edit,
                    can_advance: phase.can_advance,
                    can_delete: false,
                    organization_id: organization.id,
                  });
                }
              }
            }
          }

          // Inserir permissões de fase
          if (phasePermissions.length > 0) {
            const { error: phaseError } = await supabase
              .from('user_phase_permissions')
              .insert(phasePermissions);

            if (phaseError) {
              console.error('Error adding phase permissions:', phaseError);
              // Não falhar a aprovação por causa disso
            }
          }
        }
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

      // Log no user_activity_log
      await supabase.from('user_activity_log').insert({
        user_id: currentUser?.id,
        action_type: action === 'approve' ? 'approve' : 'reject',
        table_name: 'user_approval_status',
        record_id: user.id,
        description: `${action === 'approve' ? 'Aprovou' : 'Rejeitou'} usuário ${user.full_name}`,
        metadata: {
          target_user: user.full_name,
          target_email: user.email,
          rejection_reason: action === 'reject' ? reason : null,
        }
      });

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
