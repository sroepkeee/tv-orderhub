import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield, Save, CheckSquare, X, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useAvailableRoles } from "@/hooks/useAvailableRoles";

interface Permission {
  role: string;
  phase_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Phase {
  phase_key: string;
  display_name: string;
  order_index: number;
}

const PermissionsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { roles: availableRoles, loading: loadingRoles } = useAvailableRoles();
  
  const [phases, setPhases] = useState<Phase[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar fases do phase_config
      const { data: phasesData, error: phasesError } = await supabase
        .from('phase_config')
        .select('phase_key, display_name, order_index')
        .order('order_index');

      if (phasesError) throw phasesError;

      // Carregar permissões
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('phase_permissions')
        .select('*');

      if (permissionsError) throw permissionsError;

      setPhases(phasesData || []);
      setPermissions(permissionsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPermission = (role: string, phase: string) => {
    return permissions.find(p => p.role === role && p.phase_key === phase);
  };

  const updatePermission = (
    role: string,
    phase: string,
    field: 'can_view' | 'can_edit' | 'can_delete',
    value: boolean
  ) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.role === role && p.phase_key === phase);
      
      if (existing) {
        return prev.map(p => 
          p.role === role && p.phase_key === phase
            ? { ...p, [field]: value }
            : p
        );
      } else {
        return [...prev, {
          role,
          phase_key: phase,
          can_view: field === 'can_view' ? value : false,
          can_edit: field === 'can_edit' ? value : false,
          can_delete: field === 'can_delete' ? value : false,
        }];
      }
    });
  };

  const selectAllForRole = (role: string) => {
    setPermissions(prev => {
      const newPermissions = [...prev];
      
      phases.forEach(phase => {
        const existingIndex = newPermissions.findIndex(
          p => p.role === role && p.phase_key === phase.phase_key
        );
        
        if (existingIndex >= 0) {
          newPermissions[existingIndex] = {
            ...newPermissions[existingIndex],
            can_view: true,
            can_edit: true,
            can_delete: true,
          };
        } else {
          newPermissions.push({
            role,
            phase_key: phase.phase_key,
            can_view: true,
            can_edit: true,
            can_delete: true,
          });
        }
      });
      
      return newPermissions;
    });
  };

  const clearAllForRole = (role: string) => {
    setPermissions(prev => 
      prev.filter(p => p.role !== role)
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Deletar todas as permissões atuais
      const { error: deleteError } = await supabase
        .from('phase_permissions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) throw deleteError;

      // Inserir novas permissões
      const permissionsToInsert = permissions.map(({ role, phase_key, can_view, can_edit, can_delete }) => ({
        role,
        phase_key,
        can_view,
        can_edit,
        can_delete
      }));
      
      const { error: insertError } = await supabase
        .from('phase_permissions')
        .insert(permissionsToInsert as any);

      if (insertError) throw insertError;

      toast({
        title: "Permissões salvas",
        description: "As permissões foram atualizadas com sucesso. Usuários verão as mudanças automaticamente.",
      });

      // Recarregar dados
      await loadData();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as permissões",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingRoles) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-[98%] mx-auto py-8 px-6">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Admin
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-4xl font-bold">Gerenciamento de Permissões</h1>
                <p className="text-muted-foreground mt-1">
                  Configure permissões de visualização, edição e exclusão por role e fase
                </p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} size="lg">
              <Save className="h-5 w-5 mr-2" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Matriz de Permissões</CardTitle>
              <CardDescription>
                As mudanças são aplicadas imediatamente após salvar e sincronizam automaticamente com todos os usuários
              </CardDescription>
            </div>
            
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Configuração Padrão:</strong> Cada role tem acesso de visualização e edição apenas à sua fase correspondente, 
                mais visualização (somente leitura) das fases anteriores para contexto. Admins têm acesso total a todas as fases.
              </AlertDescription>
            </Alert>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold w-48">Role</th>
                    <th className="text-center p-4 font-semibold w-56">Ações Rápidas</th>
                    {phases.map(phase => (
                      <th key={phase.phase_key} className="text-center p-4 font-semibold min-w-[120px]">
                        <div className="text-sm">{phase.display_name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {availableRoles.map((role, roleIdx) => (
                    <tr key={role.value} className={roleIdx % 2 === 0 ? 'bg-muted/30' : ''}>
                      <td className="p-4 font-medium">
                        <div className="text-sm">{role.label}</div>
                        <div className="text-xs text-muted-foreground">{role.area}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => selectAllForRole(role.value)}
                          >
                            <CheckSquare className="h-4 w-4 mr-1" />
                            Todos
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => clearAllForRole(role.value)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Limpar
                          </Button>
                        </div>
                      </td>
                      {phases.map(phase => {
                        const perm = getPermission(role.value, phase.phase_key);
                        return (
                          <td key={phase.phase_key} className="p-4">
                            <div className="flex flex-col gap-3 items-center">
                              <label className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                                <Checkbox
                                  checked={perm?.can_view || false}
                                  onCheckedChange={(checked) => 
                                    updatePermission(role.value, phase.phase_key, 'can_view', checked as boolean)
                                  }
                                />
                                <span className="text-xs text-muted-foreground">Ver</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                                <Checkbox
                                  checked={perm?.can_edit || false}
                                  onCheckedChange={(checked) => 
                                    updatePermission(role.value, phase.phase_key, 'can_edit', checked as boolean)
                                  }
                                />
                                <span className="text-xs text-muted-foreground">Editar</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                                <Checkbox
                                  checked={perm?.can_delete || false}
                                  onCheckedChange={(checked) => 
                                    updatePermission(role.value, phase.phase_key, 'can_delete', checked as boolean)
                                  }
                                />
                                <span className="text-xs text-muted-foreground">Deletar</span>
                              </label>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="font-semibold">Legenda:</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Ver:</strong> Permite visualizar pedidos na fase</li>
                <li>• <strong>Editar:</strong> Permite mover pedidos para/desta fase e editar seus dados</li>
                <li>• <strong>Deletar:</strong> Permite excluir pedidos da fase</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-border">
                <strong>Ações Rápidas:</strong> Use "Todos" para dar acesso completo a uma role ou "Limpar" para remover todas as permissões
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PermissionsManagement;
