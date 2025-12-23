import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  LayoutDashboard, BarChart3, Factory, FolderOpen, Truck, 
  MessageSquare, ShoppingCart, Users, Search, Save, RefreshCw,
  CheckSquare, XSquare, Wand2, Loader2, Shield
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Menu configuration
const CONFIGURABLE_MENUS = [
  { key: 'kanban', label: 'Kanban', icon: LayoutDashboard },
  { key: 'metrics', label: 'Indicadores', icon: BarChart3 },
  { key: 'producao', label: 'Produção', icon: Factory },
  { key: 'files', label: 'Arquivos', icon: FolderOpen },
  { key: 'transportadoras', label: 'Transportadoras', icon: Truck },
  { key: 'carriers-chat', label: 'Conversas', icon: MessageSquare },
  { key: 'compras', label: 'Compras', icon: ShoppingCart },
  { key: 'customers', label: 'Clientes', icon: Users },
];

// Department to menu mapping
const DEPARTMENT_MENUS_MAP: Record<string, string[]> = {
  'Almoxarifado SSM': ['kanban', 'producao'],
  'SSM': ['kanban', 'producao'],
  'Compras': ['kanban', 'compras', 'transportadoras'],
  'Almoxarifado Geral': ['kanban', 'producao'],
  'Produção': ['kanban', 'producao', 'metrics'],
  'Projetos': ['kanban', 'metrics', 'producao'],
  'Planejamento': ['kanban', 'metrics', 'producao'],
  'Laboratório': ['kanban', 'producao', 'files'],
  'Expedição': ['kanban', 'transportadoras', 'carriers-chat'],
  'Logística': ['kanban', 'transportadoras', 'carriers-chat', 'compras'],
  'Faturamento': ['kanban', 'metrics', 'customers'],
  'Financeiro': ['kanban', 'metrics', 'customers'],
  'Embalagem': ['kanban', 'producao'],
  'Administração': ['kanban', 'metrics', 'producao', 'files', 'transportadoras', 'carriers-chat', 'compras', 'customers'],
};

interface UserWithPermissions {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  is_active: boolean;
  isAdmin: boolean;
  menuPermissions: Record<string, boolean>;
}

export function UserMenuPermissionsMatrix() {
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, boolean>>>({});
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const loadData = async () => {
    setLoading(true);
    try {
      // Load profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, is_active')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Load admin roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);

      // Load existing menu permissions
      const { data: menuPerms, error: permsError } = await supabase
        .from('menu_permissions')
        .select('user_id, menu_key, can_view');

      if (permsError) throw permsError;

      // Build permissions map
      const permsMap: Record<string, Record<string, boolean>> = {};
      menuPerms?.forEach(perm => {
        if (!permsMap[perm.user_id]) {
          permsMap[perm.user_id] = {};
        }
        permsMap[perm.user_id][perm.menu_key] = perm.can_view ?? true;
      });

      // Combine data
      const usersWithPerms: UserWithPermissions[] = (profiles || []).map(profile => {
        const userPerms = permsMap[profile.id] || {};
        // Default: all menus visible unless explicitly set to false
        const menuPermissions: Record<string, boolean> = {};
        CONFIGURABLE_MENUS.forEach(menu => {
          menuPermissions[menu.key] = userPerms[menu.key] !== false;
        });

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          department: profile.department,
          is_active: profile.is_active ?? false,
          isAdmin: adminUserIds.has(profile.id),
          menuPermissions,
        };
      });

      setUsers(usersWithPerms);
      setPendingChanges({});
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter and paginate users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Status filter
      if (statusFilter === 'active' && !user.is_active) return false;
      if (statusFilter === 'inactive' && user.is_active) return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchName = user.full_name?.toLowerCase().includes(search);
        const matchEmail = user.email?.toLowerCase().includes(search);
        const matchDept = user.department?.toLowerCase().includes(search);
        return matchName || matchEmail || matchDept;
      }

      return true;
    });
  }, [users, searchTerm, statusFilter]);

  const paginatedUsers = useMemo(() => {
    const start = page * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  // Get current permission value (pending changes take priority)
  const getPermission = (userId: string, menuKey: string): boolean => {
    if (pendingChanges[userId]?.[menuKey] !== undefined) {
      return pendingChanges[userId][menuKey];
    }
    const user = users.find(u => u.id === userId);
    return user?.menuPermissions[menuKey] ?? true;
  };

  // Toggle permission
  const togglePermission = (userId: string, menuKey: string) => {
    const currentValue = getPermission(userId, menuKey);
    setPendingChanges(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [menuKey]: !currentValue,
      },
    }));
  };

  // Set all menus for a user
  const setAllMenusForUser = (userId: string, value: boolean) => {
    const newPerms: Record<string, boolean> = {};
    CONFIGURABLE_MENUS.forEach(menu => {
      newPerms[menu.key] = value;
    });
    setPendingChanges(prev => ({
      ...prev,
      [userId]: newPerms,
    }));
  };

  // Apply department suggestion
  const applyDepartmentSuggestion = (userId: string, department: string | null) => {
    if (!department) {
      toast.error('Usuário sem departamento definido');
      return;
    }

    const suggestedMenus = DEPARTMENT_MENUS_MAP[department];
    if (!suggestedMenus) {
      toast.error(`Nenhuma sugestão para o departamento "${department}"`);
      return;
    }

    const newPerms: Record<string, boolean> = {};
    CONFIGURABLE_MENUS.forEach(menu => {
      newPerms[menu.key] = suggestedMenus.includes(menu.key);
    });
    setPendingChanges(prev => ({
      ...prev,
      [userId]: newPerms,
    }));
    toast.success(`Sugestão aplicada para ${department}`);
  };

  // Check if there are pending changes
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // Save all changes
  const saveChanges = async () => {
    if (!hasPendingChanges) return;

    setSaving(true);
    try {
      // Collect all changes to save
      const operations: { user_id: string; menu_key: string; can_view: boolean }[] = [];

      for (const [userId, menuChanges] of Object.entries(pendingChanges)) {
        for (const [menuKey, canView] of Object.entries(menuChanges)) {
          operations.push({ user_id: userId, menu_key: menuKey, can_view: canView });
        }
      }

      // For each operation, upsert the permission
      for (const op of operations) {
        const { error } = await supabase
          .from('menu_permissions')
          .upsert(
            { user_id: op.user_id, menu_key: op.menu_key, can_view: op.can_view },
            { onConflict: 'user_id,menu_key' }
          );

        if (error) throw error;
      }

      toast.success(`${operations.length} permissões atualizadas`);
      await loadData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const discardChanges = () => {
    setPendingChanges({});
    toast.info('Alterações descartadas');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" />
          Permissões de Menu por Usuário
        </CardTitle>
        <CardDescription>
          Configure quais menus cada usuário pode ver no sistema. Admins têm acesso total automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters and Actions */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                className="pl-9 w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(0); }}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            {hasPendingChanges && (
              <>
                <Button variant="outline" size="sm" onClick={discardChanges}>
                  <XSquare className="h-4 w-4 mr-1" />
                  Descartar
                </Button>
                <Button size="sm" onClick={saveChanges} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar ({Object.keys(pendingChanges).length})
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{filteredUsers.length} usuários</span>
          {hasPendingChanges && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              {Object.keys(pendingChanges).length} usuários com alterações pendentes
            </Badge>
          )}
        </div>

        {/* Matrix Table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Usuário</TableHead>
                {CONFIGURABLE_MENUS.map(menu => (
                  <TableHead key={menu.key} className="text-center min-w-[80px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-center gap-1">
                            <menu.icon className="h-4 w-4" />
                            <span className="text-xs">{menu.label}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{menu.label}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                ))}
                <TableHead className="text-center min-w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map(user => {
                const hasChanges = !!pendingChanges[user.id];
                return (
                  <TableRow 
                    key={user.id} 
                    className={hasChanges ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                  >
                    <TableCell className="sticky left-0 bg-background z-10">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {user.full_name || 'Sem nome'}
                          </span>
                          {user.isAdmin && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] px-1">
                              <Shield className="h-3 w-3 mr-0.5" />
                              Admin
                            </Badge>
                          )}
                          {!user.is_active && (
                            <Badge variant="outline" className="text-[10px] px-1">Inativo</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {user.department || 'Sem departamento'}
                        </span>
                      </div>
                    </TableCell>

                    {CONFIGURABLE_MENUS.map(menu => {
                      const isEnabled = getPermission(user.id, menu.key);
                      const isChanged = pendingChanges[user.id]?.[menu.key] !== undefined;

                      return (
                        <TableCell key={menu.key} className="text-center">
                          {user.isAdmin ? (
                            <Checkbox checked disabled className="opacity-50" />
                          ) : (
                            <Checkbox
                              checked={isEnabled}
                              onCheckedChange={() => togglePermission(user.id, menu.key)}
                              className={isChanged ? 'ring-2 ring-amber-500' : ''}
                            />
                          )}
                        </TableCell>
                      );
                    })}

                    <TableCell>
                      {!user.isAdmin && (
                        <div className="flex gap-1 justify-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setAllMenusForUser(user.id, true)}
                                >
                                  <CheckSquare className="h-4 w-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Liberar todos</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setAllMenusForUser(user.id, false)}
                                >
                                  <XSquare className="h-4 w-4 text-red-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Bloquear todos</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => applyDepartmentSuggestion(user.id, user.department)}
                                >
                                  <Wand2 className="h-4 w-4 text-purple-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Aplicar sugestão por departamento</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {paginatedUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={CONFIGURABLE_MENUS.length + 2} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-4">
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            <span>Admin = acesso total (não editável)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded ring-2 ring-amber-500" />
            <span>Alteração pendente</span>
          </div>
          <div className="flex items-center gap-1">
            <Wand2 className="h-3 w-3 text-purple-600" />
            <span>Aplica menus sugeridos para o departamento</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
