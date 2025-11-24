import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, CheckSquare, X, Info } from "lucide-react";
import { useAvailableRoles } from "@/hooks/useAvailableRoles";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Permission {
  role: string;
  phase_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const PHASES = [
  { key: 'almox_ssm', label: 'Almox SSM' },
  { key: 'order_generation', label: 'Gerar Ordem' },
  { key: 'almox_general', label: 'Almox Geral' },
  { key: 'production', label: 'Produção' },
  { key: 'balance_generation', label: 'Gerar Saldo' },
  { key: 'laboratory', label: 'Laboratório' },
  { key: 'packaging', label: 'Embalagem' },
  { key: 'freight_quote', label: 'Cotação Frete' },
  { key: 'invoicing', label: 'Faturamento' },
  { key: 'logistics', label: 'Expedição' },
  { key: 'in_transit', label: 'Em Trânsito' },
  { key: 'completion', label: 'Conclusão' },
];

export const PhasePermissionsMatrix = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { roles: ROLES, loading: loadingRoles } = useAvailableRoles();

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('phase_permissions')
        .select('*');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as permissões",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPermission = (role: string, phase: string) => {
    return permissions.find(p => p.role === role && p.phase_key === phase);
  };

  const updatePermission = (role: string, phase: string, field: 'can_view' | 'can_edit' | 'can_delete', value: boolean) => {
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
      
      PHASES.forEach(phase => {
        const existingIndex = newPermissions.findIndex(
          p => p.role === role && p.phase_key === phase.key
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
            phase_key: phase.key,
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
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) throw deleteError;

      // Inserir novas permissões (removendo campo id para evitar erro de constraint)
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
        description: "As permissões foram atualizadas com sucesso",
      });
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
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Matriz de Permissões por Fase</CardTitle>
            <CardDescription>Configure quem pode visualizar, editar e deletar em cada fase do Kanban</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Configuração Padrão:</strong> Cada role tem acesso de visualização e edição apenas à sua fase correspondente, 
            mais visualização (somente leitura) das fases anteriores para contexto. Admins têm acesso total a todas as fases.
            Alterações aqui permitem customizações avançadas.
          </AlertDescription>
        </Alert>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Role</TableHead>
                <TableHead className="w-[180px] text-center">Ações Rápidas</TableHead>
                {PHASES.map(phase => (
                  <TableHead key={phase.key} className="text-center">
                    <div className="text-xs">{phase.label}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLES.map(role => (
                <TableRow key={role.value}>
                  <TableCell className="font-medium">{role.label}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex gap-2 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectAllForRole(role.value)}
                        title="Selecionar todas as permissões desta role"
                      >
                        <CheckSquare className="h-4 w-4 mr-1" />
                        Todos
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clearAllForRole(role.value)}
                        title="Limpar todas as permissões desta role"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Limpar
                      </Button>
                    </div>
                  </TableCell>
                  {PHASES.map(phase => {
                    const perm = getPermission(role.value, phase.key);
                    return (
                      <TableCell key={phase.key} className="text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <Checkbox
                            checked={perm?.can_view || false}
                            onCheckedChange={(checked) => 
                              updatePermission(role.value, phase.key, 'can_view', checked as boolean)
                            }
                            title="Visualizar"
                          />
                          <Checkbox
                            checked={perm?.can_edit || false}
                            onCheckedChange={(checked) => 
                              updatePermission(role.value, phase.key, 'can_edit', checked as boolean)
                            }
                            title="Editar"
                          />
                          <Checkbox
                            checked={perm?.can_delete || false}
                            onCheckedChange={(checked) => 
                              updatePermission(role.value, phase.key, 'can_delete', checked as boolean)
                            }
                            title="Deletar"
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-sm text-muted-foreground space-y-1">
          <p><strong>Legenda:</strong> 1ª checkbox = Visualizar | 2ª checkbox = Editar | 3ª checkbox = Deletar</p>
          <p><strong>Ações Rápidas:</strong> "Todos" seleciona todas as permissões da role | "Limpar" remove todas as permissões da role</p>
        </div>
      </CardContent>
    </Card>
  );
};
