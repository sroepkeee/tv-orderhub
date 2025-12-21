import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, CheckSquare, X, Info, Eye, Pencil, ArrowRight, Trash2, Shield } from "lucide-react";
import { useAvailableRoles } from "@/hooks/useAvailableRoles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Permission {
  role: string;
  phase_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_advance: boolean;
  can_delete: boolean;
}

const PHASES = [
  { key: 'almox_ssm', label: 'Almox SSM' },
  { key: 'order_generation', label: 'Gerar Ordem' },
  { key: 'purchases', label: 'Compras' },
  { key: 'almox_general', label: 'Almox Geral' },
  { key: 'production_client', label: 'Prod. Clientes' },
  { key: 'production_stock', label: 'Prod. Estoque' },
  { key: 'balance_generation', label: 'Gerar Saldo' },
  { key: 'laboratory', label: 'Laboratório' },
  { key: 'packaging', label: 'Embalagem' },
  { key: 'freight_quote', label: 'Cotação Frete' },
  { key: 'ready_to_invoice', label: 'À Faturar' },
  { key: 'invoicing', label: 'Faturamento' },
  { key: 'logistics', label: 'Expedição' },
  { key: 'in_transit', label: 'Em Trânsito' },
  { key: 'completion', label: 'Conclusão' },
  { key: 'carriers_chat', label: 'Chat Transp.' },
];

// Roles que têm acesso total (admin e manager)
const FULL_ACCESS_ROLES = ['admin', 'manager'];

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
      
      // Mapear dados incluindo can_advance (default false se não existir)
      const mappedData = (data || []).map(p => ({
        ...p,
        can_advance: p.can_advance ?? false,
      }));
      
      setPermissions(mappedData);
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

  const isFullAccessRole = (role: string) => FULL_ACCESS_ROLES.includes(role);

  const updatePermission = (
    role: string, 
    phase: string, 
    field: 'can_view' | 'can_edit' | 'can_advance' | 'can_delete', 
    value: boolean
  ) => {
    // Não permitir alteração de roles com acesso total
    if (isFullAccessRole(role)) return;

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
          can_advance: field === 'can_advance' ? value : false,
          can_delete: field === 'can_delete' ? value : false,
        }];
      }
    });
  };

  const selectAllForRole = (role: string) => {
    if (isFullAccessRole(role)) return;

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
            can_advance: true,
            can_delete: true,
          };
        } else {
          newPermissions.push({
            role,
            phase_key: phase.key,
            can_view: true,
            can_edit: true,
            can_advance: true,
            can_delete: true,
          });
        }
      });
      
      return newPermissions;
    });
  };

  const clearAllForRole = (role: string) => {
    if (isFullAccessRole(role)) return;

    setPermissions(prev => 
      prev.filter(p => p.role !== role)
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Filtrar permissões de roles com acesso total (não salvar, são implícitas)
      const permissionsToSave = permissions.filter(p => !isFullAccessRole(p.role));

      // Deletar todas as permissões atuais (exceto as que virão de roles com acesso total)
      const { error: deleteError } = await supabase
        .from('phase_permissions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) throw deleteError;

      // Inserir novas permissões
      if (permissionsToSave.length > 0) {
        const permissionsData = permissionsToSave.map(({ role, phase_key, can_view, can_edit, can_advance, can_delete }) => ({
          role,
          phase_key,
          can_view,
          can_edit,
          can_advance,
          can_delete
        }));
        
        const { error: insertError } = await supabase
          .from('phase_permissions')
          .insert(permissionsData as any);

        if (insertError) throw insertError;
      }

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
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Matriz de Permissões por Fase
            </CardTitle>
            <CardDescription>Configure quem pode visualizar, editar, avançar e deletar em cada fase</CardDescription>
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
            <strong>Admins e Gestores</strong> têm acesso total a todas as fases automaticamente (destacados em azul).
            Configure permissões granulares para as demais roles abaixo.
          </AlertDescription>
        </Alert>

        {/* Legenda */}
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span>Ver</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Pode visualizar pedidos nesta fase</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  <span>Editar</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Pode editar pedidos nesta fase</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span>Avançar</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Pode mover pedidos para a próxima fase</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-help">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                  <span>Deletar</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Pode deletar pedidos nesta fase</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px] sticky left-0 bg-background">Role</TableHead>
                <TableHead className="w-[150px] text-center">Ações Rápidas</TableHead>
                {PHASES.map(phase => (
                  <TableHead key={phase.key} className="text-center min-w-[80px]">
                    <div className="text-xs leading-tight">{phase.label}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLES.map(role => {
                const hasFullAccess = isFullAccessRole(role.value);
                
                return (
                  <TableRow 
                    key={role.value}
                    className={hasFullAccess ? "bg-primary/5" : ""}
                  >
                    <TableCell className="font-medium sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        {role.label}
                        {hasFullAccess && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Acesso Total
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {hasFullAccess ? (
                        <span className="text-xs text-muted-foreground">Automático</span>
                      ) : (
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => selectAllForRole(role.value)}
                            title="Selecionar todas as permissões"
                            className="h-7 px-2"
                          >
                            <CheckSquare className="h-3 w-3 mr-1" />
                            Todos
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => clearAllForRole(role.value)}
                            title="Limpar todas as permissões"
                            className="h-7 px-2"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Limpar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    {PHASES.map(phase => {
                      const perm = getPermission(role.value, phase.key);
                      
                      if (hasFullAccess) {
                        return (
                          <TableCell key={phase.key} className="text-center">
                            <div className="flex flex-col gap-0.5 items-center">
                              <Checkbox checked disabled className="data-[state=checked]:bg-primary" />
                              <Checkbox checked disabled className="data-[state=checked]:bg-primary" />
                              <Checkbox checked disabled className="data-[state=checked]:bg-primary" />
                              <Checkbox checked disabled className="data-[state=checked]:bg-primary" />
                            </div>
                          </TableCell>
                        );
                      }
                      
                      return (
                        <TableCell key={phase.key} className="text-center">
                          <div className="flex flex-col gap-0.5 items-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Checkbox
                                      checked={perm?.can_view || false}
                                      onCheckedChange={(checked) => 
                                        updatePermission(role.value, phase.key, 'can_view', checked as boolean)
                                      }
                                    />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">Ver</TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Checkbox
                                      checked={perm?.can_edit || false}
                                      onCheckedChange={(checked) => 
                                        updatePermission(role.value, phase.key, 'can_edit', checked as boolean)
                                      }
                                    />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">Editar</TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Checkbox
                                      checked={perm?.can_advance || false}
                                      onCheckedChange={(checked) => 
                                        updatePermission(role.value, phase.key, 'can_advance', checked as boolean)
                                      }
                                    />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">Avançar</TooltipContent>
                              </Tooltip>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Checkbox
                                      checked={perm?.can_delete || false}
                                      onCheckedChange={(checked) => 
                                        updatePermission(role.value, phase.key, 'can_delete', checked as boolean)
                                      }
                                    />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">Deletar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-4 text-xs text-muted-foreground space-y-1 border-t pt-3">
          <p><strong>Ordem dos checkboxes:</strong> 👁️ Ver → ✏️ Editar → ▶️ Avançar → 🗑️ Deletar</p>
          <p><strong>Dica:</strong> Use "Todos" para dar acesso completo a uma role, ou configure permissões específicas por fase.</p>
        </div>
      </CardContent>
    </Card>
  );
};
