import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCheck, UserX, Shield, Search, CheckCircle, XCircle, Clock, Crown, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserApprovalDialog } from "./UserApprovalDialog";
import { UserRolesDialog } from "./UserRolesDialog";
import { DepartmentSelect } from "./DepartmentSelect";
import { UserActivityHistoryDialog } from "./UserActivityHistoryDialog";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserData {
  id: string;
  email: string;
  full_name: string;
  department: string;
  location: string | null;
  approval_status: string;
  roles: string[];
  created_at: string;
  is_active: boolean;
  whatsapp: string | null;
  is_manager: boolean;
}

export const UserManagementTable = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRolesDialog, setShowRolesDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    
    // Subscribe to changes
    const approvalChannel = supabase
      .channel('user-approvals-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_approval_status' },
        () => loadUsers()
      )
      .subscribe();
    
    const rolesChannel = supabase
      .channel('user-roles-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_roles' },
        () => loadUsers()
      )
      .subscribe();
    
    return () => {
      approvalChannel.unsubscribe();
      rolesChannel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, statusFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Buscar profiles com novos campos whatsapp e is_manager
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, department, location, created_at, is_active, whatsapp, is_manager')
      .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;
      if (!profiles) {
        setUsers([]);
        return;
      }
      
      // Buscar status de aprovação
      const { data: approvalStatuses, error: approvalError } = await supabase
        .from('user_approval_status')
        .select('user_id, status');
      
      if (approvalError) throw approvalError;
      
      // Buscar roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;
      
      // Combinar dados
      const usersData: UserData[] = profiles.map(profile => {
        const approval = approvalStatuses?.find(a => a.user_id === profile.id);
        const roles = userRoles?.filter(r => r.user_id === profile.id).map(r => r.role) || [];
        
      return {
        id: profile.id,
        email: profile.email || '',
        full_name: profile.full_name || 'Sem nome',
        department: profile.department || 'Não definido',
        location: profile.location || null,
        approval_status: approval?.status || 'pending',
        roles: roles,
        created_at: profile.created_at,
        is_active: profile.is_active ?? false,
        whatsapp: profile.whatsapp || null,
        is_manager: profile.is_manager ?? false,
      };
      });
      
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Erro ao carregar usuários",
        description: "Não foi possível carregar a lista de usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter === "active") {
      filtered = filtered.filter(user => user.is_active);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter(user => !user.is_active);
    } else if (statusFilter !== "all") {
      filtered = filtered.filter(user => user.approval_status === statusFilter);
    }

    setFilteredUsers(filtered);
  };

  const updateUserLocation = async (userId: string, newLocation: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ location: newLocation })
      .eq('id', userId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar localização",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Localização atualizada com sucesso!",
      });
      loadUsers();
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newStatus })
      .eq('id', userId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível alterar status do usuário",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: `Usuário ${newStatus ? 'ativado' : 'inativado'} com sucesso!`,
      });
      loadUsers();
    }
  };

  const updateUserWhatsApp = async (userId: string, newWhatsApp: string) => {
    const formatted = newWhatsApp.replace(/\D/g, '');
    const { error } = await supabase
      .from('profiles')
      .update({ whatsapp: formatted || null })
      .eq('id', userId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar WhatsApp",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "WhatsApp atualizado!",
      });
      loadUsers();
    }
  };

  const toggleUserManager = async (userId: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_manager: !currentValue })
      .eq('id', userId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível alterar status de gestor",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: `Usuário ${!currentValue ? 'marcado como gestor' : 'removido de gestor'}!`,
      });
      loadUsers();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success/10 text-success hover:bg-success/20"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejected':
        return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge className="bg-warning/10 text-warning hover:bg-warning/20"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  const pendingCount = users.filter(u => u.approval_status === 'pending').length;
  const approvedCount = users.filter(u => u.approval_status === 'approved').length;
  const rejectedCount = users.filter(u => u.approval_status === 'rejected').length;
  const managerCount = users.filter(u => u.is_manager).length;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitados</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gestores</CardTitle>
            <Crown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{managerCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários do Sistema</CardTitle>
          <CardDescription>Gerencie aprovações e permissões dos usuários</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou departamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Gestor</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Status Ativo</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status Aprovação</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8">
                      Carregando usuários...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowHistoryDialog(true);
                          }}
                          className="flex items-center gap-2 hover:text-primary transition-colors text-left"
                        >
                          {user.is_manager && <Crown className="h-4 w-4 text-amber-500" />}
                          <span className="font-medium underline decoration-dotted">
                            {user.full_name}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Input
                          placeholder="5551999999999"
                          value={user.whatsapp || ''}
                          onChange={(e) => {
                            const newUsers = users.map(u => 
                              u.id === user.id ? { ...u, whatsapp: e.target.value } : u
                            );
                            setUsers(newUsers);
                          }}
                          onBlur={(e) => updateUserWhatsApp(user.id, e.target.value)}
                          className="w-36 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.is_manager}
                            onCheckedChange={() => toggleUserManager(user.id, user.is_manager)}
                          />
                          {user.is_manager && (
                            <Crown className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DepartmentSelect
                          userId={user.id}
                          currentDepartment={user.department}
                          onUpdate={loadUsers}
                        />
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={user.location || ''} 
                          onValueChange={(v) => updateUserLocation(user.id, v)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Não definido" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Matriz">Matriz</SelectItem>
                            <SelectItem value="Filial">Filial</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800">
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles.length > 0 ? (
                            user.roles.map(role => (
                              <Badge key={role} variant="outline" className="text-xs">
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Nenhuma</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(user.approval_status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(user.created_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {user.approval_status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowApprovalDialog(true);
                                }}
                              >
                                <UserCheck className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowApprovalDialog(true);
                                }}
                              >
                                <UserX className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowRolesDialog(true);
                            }}
                            title="Administrador"
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            Admin
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate('/settings/phases')}
                            title="Configurar permissões de fases"
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Fases
                          </Button>
                          <Button
                            size="sm"
                            variant={user.is_active ? "ghost" : "default"}
                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                          >
                            {user.is_active ? (
                              <>
                                <UserX className="h-4 w-4 mr-1" />
                                Inativar
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4 mr-1" />
                                Reativar
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <>
          <UserApprovalDialog
            open={showApprovalDialog}
            onOpenChange={setShowApprovalDialog}
            user={selectedUser}
            onSuccess={loadUsers}
          />
          <UserRolesDialog
            open={showRolesDialog}
            onOpenChange={setShowRolesDialog}
            user={selectedUser}
            onSuccess={loadUsers}
          />
          <UserActivityHistoryDialog
            open={showHistoryDialog}
            onOpenChange={setShowHistoryDialog}
            userId={selectedUser.id}
            userName={selectedUser.full_name}
          />
        </>
      )}
    </>
  );
};
