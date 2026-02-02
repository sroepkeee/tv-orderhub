import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Tag } from "lucide-react";
import { ROLE_LABELS } from "@/lib/roleLabels";

interface UserData {
  id: string;
  email: string;
  full_name: string;
  department: string;
  location: string | null;
  whatsapp: string | null;
  is_manager: boolean;
  is_active: boolean;
  roles?: string[];
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData | null;
  onSuccess: () => void;
}

const DEPARTMENTS = [
  "Comercial",
  "Compras",
  "Expedição",
  "Financeiro",
  "Produção",
  "Projetos",
  "Qualidade",
  "Administrativo",
  "TI",
  "RH",
  "Diretoria",
];

// Roles disponíveis para atribuição (exceto admin que é gerenciado separadamente)
const AVAILABLE_ROLES = Object.entries(ROLE_LABELS)
  .filter(([key]) => key !== 'admin')
  .map(([key, info]) => ({
    key,
    label: info.name,
    area: info.area,
  }));

export const EditUserDialog = ({ open, onOpenChange, user, onSuccess }: EditUserDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    department: "",
    location: "",
    whatsapp: "",
    is_manager: false,
    is_active: true,
  });
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [originalRoles, setOriginalRoles] = useState<string[]>([]);

  useEffect(() => {
    if (user && open) {
      setFormData({
        full_name: user.full_name || "",
        department: user.department || "",
        location: user.location || "",
        whatsapp: user.whatsapp || "",
        is_manager: user.is_manager || false,
        is_active: user.is_active ?? true,
      });
      loadUserRoles(user.id);
    }
  }, [user, open]);

  const loadUserRoles = async (userId: string) => {
    setLoadingRoles(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const roles = data?.map(r => r.role).filter(r => r !== 'admin') || [];
      setUserRoles(roles);
      setOriginalRoles(roles);
    } catch (error) {
      console.error('Error loading user roles:', error);
    } finally {
      setLoadingRoles(false);
    }
  };

  const toggleRole = (roleKey: string) => {
    setUserRoles(prev => 
      prev.includes(roleKey)
        ? prev.filter(r => r !== roleKey)
        : [...prev, roleKey]
    );
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 1. Atualizar profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          department: formData.department || null,
          location: formData.location || null,
          whatsapp: formData.whatsapp?.replace(/\D/g, "") || null,
          is_manager: formData.is_manager,
          is_active: formData.is_active,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // 2. Atualizar roles (apenas se houve mudança)
      const rolesToAdd = userRoles.filter(r => !originalRoles.includes(r));
      const rolesToRemove = originalRoles.filter(r => !userRoles.includes(r));

      if (rolesToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.id)
          .in('role', rolesToRemove as any);
        
        if (removeError) throw removeError;
      }

      if (rolesToAdd.length > 0) {
        const { error: addError } = await supabase
          .from('user_roles')
          .insert(rolesToAdd.map(role => ({ user_id: user.id, role: role as any })));
        
        if (addError) throw addError;
      }

      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso!",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o usuário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  // Agrupar roles por área
  const rolesByArea = AVAILABLE_ROLES.reduce((acc, role) => {
    if (!acc[role.area]) {
      acc[role.area] = [];
    }
    acc[role.area].push(role);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_ROLES>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} disabled className="bg-muted" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="full_name">Nome Completo</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Nome do usuário"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="department">Departamento</Label>
            <Select
              value={formData.department}
              onValueChange={(v) => setFormData({ ...formData, department: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o departamento" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Localização</Label>
            <Select
              value={formData.location}
              onValueChange={(v) => setFormData({ ...formData, location: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a localização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Matriz">Matriz</SelectItem>
                <SelectItem value="Filial">Filial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              placeholder="5551999999999"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_manager">Gestor</Label>
            <Switch
              id="is_manager"
              checked={formData.is_manager}
              onCheckedChange={(checked) => setFormData({ ...formData, is_manager: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Ativo</Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <Separator className="my-2" />

          {/* Seção de Roles */}
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <Label className="text-base font-semibold">Roles (Funções)</Label>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                💡 Dica: Simplificando o acesso
              </p>
              <ul className="text-amber-700 dark:text-amber-300 space-y-1 text-xs">
                <li>• <strong>Supervisores/Coordenadores</strong>: Clique em "Admin" nas ações da tabela para dar acesso total ao Kanban</li>
                <li>• <strong>Operadores</strong>: Selecione apenas a role da área de atuação (ex: Compras, Laboratório)</li>
                <li>• Após definir a role, configure o acesso ao Kanban via botão "Kanban" na tabela</li>
              </ul>
            </div>
            
            {loadingRoles ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando roles...
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(rolesByArea).map(([area, roles]) => (
                  <div key={area} className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">{area}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {roles.map((role) => (
                        <div
                          key={role.key}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`role-${role.key}`}
                            checked={userRoles.includes(role.key)}
                            onCheckedChange={() => toggleRole(role.key)}
                          />
                          <label
                            htmlFor={`role-${role.key}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {role.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {userRoles.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {userRoles.map(role => (
                  <Badge key={role} variant="secondary" className="text-xs">
                    {ROLE_LABELS[role]?.name || role}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
