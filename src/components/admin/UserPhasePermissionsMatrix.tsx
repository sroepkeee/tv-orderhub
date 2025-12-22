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
      
      // Carregar usuários com roles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department')
        .eq('organization_id', organization?.id)
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Carregar roles de todos os usuários
      const userIds = profilesData?.map(p => p.id) || [];
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Mapear usuários com suas roles
      const usersWithRoles: UserProfile[] = (profilesData || []).map(profile => ({
        ...profile,
        roles: rolesData?.filter(r => r.user_id === profile.id).map(r => r.role) || []
      }));

      setUsers(usersWithRoles);

      // Carregar permissões individuais
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

      // Filtrar permissões de usuários com acesso total
      const permissionsToSave = permissions.filter(p => {
        const user = users.find(u => u.id === p.user_id);
        return user && !hasFullAccessRole(user);
      });

      // Deletar todas as permissões atuais da org
      const { error: deleteError } = await supabase
        .from('user_phase_permissions')
        .delete()
        .eq('organization_id', organization.id);

      if (deleteError) throw deleteError;

      // Inserir novas permissões
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
            <CardDescription>Configure permissões individuais além das permissões de role</CardDescription>
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
            Permissões individuais são <strong>adicionais</strong> às permissões de role. 
            Usuários com role Admin ou Gestor têm acesso total (destacados em azul).
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
                <TableHead className="w-[200px] sticky left-0 bg-background">Usuário</TableHead>
                {PHASES.map(phase => (
                  <TableHead key={phase.key} className="text-center min-w-[80px]">
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
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
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
                                          updatePermission(user.id, phase.key, 'can_view', checked as boolean)
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
                                          updatePermission(user.id, phase.key, 'can_edit', checked as boolean)
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
                                          updatePermission(user.id, phase.key, 'can_advance', checked as boolean)
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
                                          updatePermission(user.id, phase.key, 'can_delete', checked as boolean)
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
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-4 text-xs text-muted-foreground space-y-1 border-t pt-3">
          <p><strong>Ordem dos checkboxes:</strong> 👁️ Ver → ✏️ Editar → ▶️ Avançar → 🗑️ Deletar</p>
          <p><strong>Dica:</strong> Estas permissões são <em>adicionais</em> às permissões que o usuário já tem por sua role.</p>
        </div>
      </CardContent>
    </Card>
  );
};
