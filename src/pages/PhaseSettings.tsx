import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Settings2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { PhaseList } from "@/components/phases/PhaseList";
import { AddPhaseDialog } from "@/components/phases/AddPhaseDialog";
import { UserPhasePermissionsMatrix } from "@/components/admin/UserPhasePermissionsMatrix";

export interface PhaseConfig {
  id: string;
  phase_key: string;
  display_name: string;
  order_index: number;
  responsible_role: string | null;
  organization_id: string | null;
  manager_user_id?: string | null;
  max_days_allowed?: number;
  warning_days?: number;
  stall_alerts_enabled?: boolean;
}

export interface UserByRole {
  id: string;
  full_name: string | null;
  email: string | null;
}

const PhaseSettings = () => {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const [usersByRole, setUsersByRole] = useState<Record<string, UserByRole[]>>({});
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchPhases = async () => {
    if (!organization?.id) return;

    try {
      const { data, error } = await supabase
        .from('phase_config')
        .select('*')
        .eq('organization_id', organization.id)
        .order('order_index');

      if (error) throw error;
      setPhases(data || []);
    } catch (error) {
      console.error('Error fetching phases:', error);
      toast.error('Erro ao carregar fases');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersByRole = async () => {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role, user_id');

      if (rolesError) throw rolesError;

      const userIds = [...new Set(rolesData?.map(r => r.user_id) || [])];
      
      if (userIds.length === 0) {
        setUsersByRole({});
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const grouped: Record<string, UserByRole[]> = {};
      
      rolesData?.forEach(roleEntry => {
        const profile = profilesData?.find(p => p.id === roleEntry.user_id);
        if (profile) {
          if (!grouped[roleEntry.role]) {
            grouped[roleEntry.role] = [];
          }
          if (!grouped[roleEntry.role].find(u => u.id === profile.id)) {
            grouped[roleEntry.role].push({
              id: profile.id,
              full_name: profile.full_name,
              email: profile.email,
            });
          }
        }
      });

      setUsersByRole(grouped);
    } catch (error) {
      console.error('Error fetching users by role:', error);
    }
  };

  useEffect(() => {
    if (organization?.id) {
      fetchPhases();
      fetchUsersByRole();
    }
  }, [organization?.id]);

  const handlePhasesReorder = async (reorderedPhases: PhaseConfig[]) => {
    setPhases(reorderedPhases);

    try {
      const updates = reorderedPhases.map((phase, index) => ({
        id: phase.id,
        order_index: index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('phase_config')
          .update({ order_index: update.order_index })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast.success('Ordem das fases atualizada');
    } catch (error) {
      console.error('Error reordering phases:', error);
      toast.error('Erro ao reordenar fases');
      fetchPhases();
    }
  };

  const handlePhaseUpdate = async (updatedPhase: PhaseConfig) => {
    try {
      // 1. Atualizar phase_config com todos os campos
      const { error } = await supabase
        .from('phase_config')
        .update({
          display_name: updatedPhase.display_name,
          responsible_role: updatedPhase.responsible_role as any,
          manager_user_id: updatedPhase.manager_user_id,
          max_days_allowed: updatedPhase.max_days_allowed,
          warning_days: updatedPhase.warning_days,
          stall_alerts_enabled: updatedPhase.stall_alerts_enabled,
        })
        .eq('id', updatedPhase.id);

      if (error) throw error;

      // 2. Sincronizar gestor principal com phase_managers
      if (updatedPhase.manager_user_id && organization?.id) {
        // Buscar WhatsApp do gestor
        const { data: profile } = await supabase
          .from('profiles')
          .select('whatsapp')
          .eq('id', updatedPhase.manager_user_id)
          .single();

        const whatsapp = profile?.whatsapp?.replace(/\D/g, '') || '';

        // Verificar se já existe entrada em phase_managers
        const { data: existingManager } = await supabase
          .from('phase_managers')
          .select('id')
          .eq('phase_key', updatedPhase.phase_key)
          .eq('user_id', updatedPhase.manager_user_id)
          .eq('organization_id', organization.id)
          .maybeSingle();

        if (!existingManager) {
          // Criar entrada em phase_managers
          await supabase
            .from('phase_managers')
            .insert({
              phase_key: updatedPhase.phase_key,
              user_id: updatedPhase.manager_user_id,
              whatsapp: whatsapp,
              organization_id: organization.id,
              is_active: true,
              receive_new_orders: true,
              receive_urgent_alerts: true,
              receive_daily_summary: false,
              notification_priority: 1,
            });
        }
      }

      setPhases(phases.map(p => p.id === updatedPhase.id ? updatedPhase : p));
      toast.success('Fase atualizada');
    } catch (error) {
      console.error('Error updating phase:', error);
      toast.error('Erro ao atualizar fase');
    }
  };

  const handlePhaseDelete = async (phaseId: string) => {
    try {
      const { error } = await supabase
        .from('phase_config')
        .delete()
        .eq('id', phaseId);

      if (error) throw error;

      setPhases(phases.filter(p => p.id !== phaseId));
      toast.success('Fase removida');
    } catch (error) {
      console.error('Error deleting phase:', error);
      toast.error('Erro ao remover fase');
    }
  };

  const handlePhaseAdd = async (newPhase: Omit<PhaseConfig, 'id' | 'order_index' | 'organization_id'>) => {
    if (!organization?.id) return;

    try {
      const maxOrderIndex = phases.length > 0 
        ? Math.max(...phases.map(p => p.order_index)) 
        : 0;

      const { data, error } = await supabase
        .from('phase_config')
        .insert({
          phase_key: newPhase.phase_key,
          display_name: newPhase.display_name,
          responsible_role: newPhase.responsible_role as any,
          organization_id: organization.id,
          order_index: maxOrderIndex + 1,
        } as any)
        .select()
        .single();

      if (error) throw error;

      setPhases([...phases, data]);
      setAddDialogOpen(false);
      toast.success('Fase adicionada');
    } catch (error: any) {
      console.error('Error adding phase:', error);
      if (error.code === '23505') {
        toast.error('Já existe uma fase com essa chave');
      } else {
        toast.error('Erro ao adicionar fase');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-6xl mx-auto py-6 px-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/users")}
            className="mb-3"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Admin
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Settings2 className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">Configuração de Fases</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure as fases do fluxo de trabalho e permissões da sua organização
          </p>
        </div>

        <Tabs defaultValue="phases" className="space-y-4">
          <TabsList>
            <TabsTrigger value="phases" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Fases do Workflow
            </TabsTrigger>
            <TabsTrigger value="user-permissions" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Permissões por Usuário
            </TabsTrigger>
          </TabsList>

          <TabsContent value="phases">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Fases do Workflow</CardTitle>
                    <CardDescription>
                      Arraste para reordenar. Cada fase representa um estágio do seu processo.
                    </CardDescription>
                  </div>
                  <Button onClick={() => setAddDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Fase
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {phases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma fase configurada</p>
                    <p className="text-sm">Adicione fases para organizar seu fluxo de trabalho</p>
                  </div>
                ) : (
                  <PhaseList
                    phases={phases}
                    usersByRole={usersByRole}
                    onReorder={handlePhasesReorder}
                    onUpdate={handlePhaseUpdate}
                    onDelete={handlePhaseDelete}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="user-permissions">
            <UserPhasePermissionsMatrix />
          </TabsContent>
        </Tabs>

        <AddPhaseDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onAdd={handlePhaseAdd}
          existingKeys={phases.map(p => p.phase_key)}
        />
      </div>
    </div>
  );
};

export default PhaseSettings;
