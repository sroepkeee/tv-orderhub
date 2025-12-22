import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { Save, Info, Eye, Pencil, ArrowRight, Trash2, Users, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserPermission {
  user_id: string;
  phase_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_advance: boolean;
  can_delete: boolean;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  roles: string[];
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

const FULL_ACCESS_ROLES = ['admin', 'manager'];

// Cores por tipo de permissão
const PERMISSION_STYLES = {
  can_view: {
    color: 'text-emerald-600',
    bgChecked: 'data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500',
    icon: Eye,
    label: 'Ver',
    tooltip: 'Pode visualizar pedidos nesta fase'
  },
  can_edit: {
    color: 'text-blue-600',
    bgChecked: 'data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500',
    icon: Pencil,
    label: 'Editar',
    tooltip: 'Pode editar pedidos nesta fase'
  },
  can_advance: {
    color: 'text-orange-600',
    bgChecked: 'data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500',
    icon: ArrowRight,
    label: 'Avançar',
    tooltip: 'Pode mover pedidos para a próxima fase'
  },
  can_delete: {
    color: 'text-red-600',
    bgChecked: 'data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500',
    icon: Trash2,
    label: 'Deletar',
    tooltip: 'Pode deletar pedidos nesta fase'
  },
};

export const UserPhasePermissionsMatrix = () => {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { organization } = useOrganization();

  useEffect(() => {
    if (organization?.id) {
      loadData();
    }
  }, [organization?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department')
        .eq('organization_id', organization?.id)
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      const userIds = profilesData?.map(p => p.id) || [];
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      const usersWithRoles: UserProfile[] = (profilesData || []).map(profile => ({
        ...profile,
        roles: rolesData?.filter(r => r.user_id === profile.id).map(r => r.role) || []
      }));

      setUsers(usersWithRoles);

      const { data: permData, error: permError } = await supabase
        .from('user_phase_permissions')
        .select('*')
        .eq('organization_id', organization?.id);

      if (permError) throw permError;
      
      setPermissions(permData?.map(p => ({
        user_id: p.user_id,
        phase_key: p.phase_key,
        can_view: p.can_view ?? false,
        can_edit: p.can_edit ?? false,
        can_advance: p.can_advance ?? false,
        can_delete: p.can_delete ?? false,
      })) || []);
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

  const getPermission = (userId: string, phase: string) => {
    return permissions.find(p => p.user_id === userId && p.phase_key === phase);
  };

  const hasFullAccessRole = (user: UserProfile) => {
    return user.roles.some(role => FULL_ACCESS_ROLES.includes(role));
  };

  const updatePermission = (
    userId: string, 
    phase: string, 
    field: 'can_view' | 'can_edit' | 'can_advance' | 'can_delete', 
    value: boolean
  ) => {
    const user = users.find(u => u.id === userId);
    if (user && hasFullAccessRole(user)) return;

    setPermissions(prev => {
      const existing = prev.find(p => p.user_id === userId && p.phase_key === phase);
      
      if (existing) {
        return prev.map(p => 
          p.user_id === userId && p.phase_key === phase
            ? { ...p, [field]: value }
            : p
        );
      } else {
        return [...prev, {
          user_id: userId,
          phase_key: phase,
          can_view: field === 'can_view' ? value : false,
          can_edit: field === 'can_edit' ? value : false,
          can_advance: field === 'can_advance' ? value : false,
          can_delete: field === 'can_delete' ? value : false,
        }];
      }
    });
  };

  const handleSave = async () => {
    if (!organization?.id) return;

    try {
      setSaving(true);

      const permissionsToSave = permissions.filter(p => {
        const user = users.find(u => u.id === p.user_id);
        return user && !hasFullAccessRole(user);
      });

      const { error: deleteError } = await supabase
        .from('user_phase_permissions')
        .delete()
        .eq('organization_id', organization.id);

      if (deleteError) throw deleteError;

      if (permissionsToSave.length > 0) {
        const dataToInsert = permissionsToSave.map(p => ({
          user_id: p.user_id,
          phase_key: p.phase_key,
          can_view: p.can_view,
          can_edit: p.can_edit,
          can_advance: p.can_advance,
          can_delete: p.can_delete,
          organization_id: organization.id,
        }));
        
        const { error: insertError } = await supabase
          .from('user_phase_permissions')
          .insert(dataToInsert);

        if (insertError) throw insertError;
      }

      toast({
        title: "Permissões salvas",
        description: "As permissões individuais foram atualizadas",
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

  const getInitials = (name: string | null, email: string | null) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return '?';
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.department?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
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
              <Users className="h-5 w-5" />
              Permissões por Usuário
            </CardTitle>
            <CardDescription>Configure permissões individuais para cada usuário por fase</CardDescription>
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
            Usuários com role <strong>Admin</strong> ou <strong>Gestor</strong> têm acesso total automático (destacados em azul).
          </AlertDescription>
        </Alert>

        {/* Search */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário por nome, email ou departamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Legenda com cores */}
        <div className="mb-4 flex flex-wrap gap-6 text-sm p-3 bg-muted/50 rounded-lg">
          <TooltipProvider>
            {Object.entries(PERMISSION_STYLES).map(([key, style]) => {
              const Icon = style.icon;
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-help">
                      <div className={`w-4 h-4 rounded flex items-center justify-center ${
                        key === 'can_view' ? 'bg-emerald-500' :
                        key === 'can_edit' ? 'bg-blue-500' :
                        key === 'can_advance' ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}>
                        <Icon className="h-2.5 w-2.5 text-white" />
                      </div>
                      <span className={style.color}>{style.label}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{style.tooltip}</TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px] sticky left-0 bg-background">Usuário</TableHead>
                {PHASES.map(phase => (
                  <TableHead key={phase.key} className="text-center min-w-[90px]">
                    <div className="text-xs leading-tight">{phase.label}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={PHASES.length + 1} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário na organização'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map(user => {
                  const hasFullAccess = hasFullAccessRole(user);
                  
                  return (
                    <TableRow 
                      key={user.id}
                      className={hasFullAccess ? "bg-primary/5" : ""}
                    >
                      <TableCell className="font-medium sticky left-0 bg-background">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(user.full_name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm truncate max-w-[120px]">
                              {user.full_name || user.email || 'Sem nome'}
                            </span>
                            {user.department && (
                              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                {user.department}
                              </span>
                            )}
                          </div>
                          {hasFullAccess && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 bg-primary/20">
                              Total
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {PHASES.map(phase => {
                        const perm = getPermission(user.id, phase.key);
                        
                        if (hasFullAccess) {
                          return (
                            <TableCell key={phase.key} className="text-center">
                              <div className="flex gap-1 items-center justify-center">
                                {Object.entries(PERMISSION_STYLES).map(([key, style]) => {
                                  const Icon = style.icon;
                                  return (
                                    <div 
                                      key={key}
                                      className={`w-5 h-5 rounded flex items-center justify-center ${
                                        key === 'can_view' ? 'bg-emerald-500' :
                                        key === 'can_edit' ? 'bg-blue-500' :
                                        key === 'can_advance' ? 'bg-orange-500' :
                                        'bg-red-500'
                                      }`}
                                    >
                                      <Icon className="h-3 w-3 text-white" />
                                    </div>
                                  );
                                })}
                              </div>
                            </TableCell>
                          );
                        }
                        
                        return (
                          <TableCell key={phase.key} className="text-center">
                            <div className="flex gap-1 items-center justify-center">
                              <TooltipProvider>
                                {Object.entries(PERMISSION_STYLES).map(([key, style]) => {
                                  const Icon = style.icon;
                                  const fieldKey = key as 'can_view' | 'can_edit' | 'can_advance' | 'can_delete';
                                  const isChecked = perm?.[fieldKey] || false;
                                  
                                  return (
                                    <Tooltip key={key}>
                                      <TooltipTrigger asChild>
                                        <div className="flex flex-col items-center">
                                          <Icon className={`h-3 w-3 mb-0.5 ${isChecked ? style.color : 'text-muted-foreground/40'}`} />
                                          <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={(checked) => 
                                              updatePermission(user.id, phase.key, fieldKey, checked as boolean)
                                            }
                                            className={`h-4 w-4 ${style.bgChecked}`}
                                          />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">{style.label}</TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <strong>Dica:</strong> Clique nos checkboxes para definir permissões específicas por usuário e fase.
        </div>
      </CardContent>
    </Card>
  );
};
