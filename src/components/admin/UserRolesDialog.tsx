import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Info, Shield, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";

interface UserRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string;
    roles: string[];
  };
  onSuccess: () => void;
}

export const UserRolesDialog = ({ open, onOpenChange, user, onSuccess }: UserRolesDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(user.roles.includes('admin'));
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setIsAdmin(user.roles.includes('admin'));
  }, [user.roles]);

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Se está tornando admin
      if (isAdmin && !user.roles.includes('admin')) {
        // Adicionar role admin
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: 'admin' as any });

        if (insertError) throw insertError;

        // Registrar no audit log
        await supabase.from('permission_audit_log').insert({
          action_type: 'role_granted',
          performed_by: currentUser?.id,
          target_user_id: user.id,
          details: {
            user_name: user.full_name,
            roles_added: ['admin'],
            roles_removed: [],
          },
        });

        await supabase.from('user_activity_log').insert({
          user_id: currentUser?.id,
          action_type: 'update',
          table_name: 'user_roles',
          record_id: user.id,
          description: `Concedeu acesso de Administrador para ${user.full_name}`,
          metadata: { target_user: user.full_name, role: 'admin' }
        });
      } 
      // Se está removendo admin
      else if (!isAdmin && user.roles.includes('admin')) {
        // Remover role admin
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.id)
          .eq('role', 'admin');

        if (deleteError) throw deleteError;

        // Registrar no audit log
        await supabase.from('permission_audit_log').insert({
          action_type: 'role_revoked',
          performed_by: currentUser?.id,
          target_user_id: user.id,
          details: {
            user_name: user.full_name,
            roles_added: [],
            roles_removed: ['admin'],
          },
        });

        await supabase.from('user_activity_log').insert({
          user_id: currentUser?.id,
          action_type: 'update',
          table_name: 'user_roles',
          record_id: user.id,
          description: `Removeu acesso de Administrador de ${user.full_name}`,
          metadata: { target_user: user.full_name, role: 'admin' }
        });
      }

      toast({
        title: "Permissão atualizada",
        description: isAdmin 
          ? `${user.full_name} agora é Administrador` 
          : `${user.full_name} não é mais Administrador`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating admin status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status de administrador",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const goToPhaseSettings = () => {
    onOpenChange(false);
    navigate('/settings/phases');
  };

  const hasChanged = isAdmin !== user.roles.includes('admin');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permissões de {user.full_name}</DialogTitle>
          <DialogDescription>
            Configure o nível de acesso do usuário
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Toggle de Admin */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <Label htmlFor="admin-toggle" className="text-base font-medium">
                  Administrador
                </Label>
                <p className="text-sm text-muted-foreground">
                  Acesso total ao sistema
                </p>
              </div>
            </div>
            <Switch
              id="admin-toggle"
              checked={isAdmin}
              onCheckedChange={setIsAdmin}
            />
          </div>

          {/* Status atual */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status atual:</span>
            {user.roles.includes('admin') ? (
              <Badge className="bg-primary/10 text-primary">Administrador</Badge>
            ) : (
              <Badge variant="outline">Usuário comum</Badge>
            )}
          </div>

          {/* Info sobre permissões de fase */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-2">
                <p>
                  {isAdmin 
                    ? "Administradores têm acesso total a todas as fases e funcionalidades."
                    : "Para configurar permissões específicas de fases (ver, editar, avançar), acesse a Configuração de Fases."}
                </p>
                {!isAdmin && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-primary"
                    onClick={goToPhaseSettings}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ir para Permissões por Fase
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !hasChanged}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
