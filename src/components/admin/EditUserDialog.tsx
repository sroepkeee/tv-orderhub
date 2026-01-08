import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface UserData {
  id: string;
  email: string;
  full_name: string;
  department: string;
  location: string | null;
  whatsapp: string | null;
  is_manager: boolean;
  is_active: boolean;
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
  "Financeiro",
  "Expedição",
  "Produção",
  "Qualidade",
  "Administrativo",
  "TI",
  "RH",
  "Diretoria",
];

export const EditUserDialog = ({ open, onOpenChange, user, onSuccess }: EditUserDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    department: "",
    location: "",
    whatsapp: "",
    is_manager: false,
    is_active: true,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        department: user.department || "",
        location: user.location || "",
        whatsapp: user.whatsapp || "",
        is_manager: user.is_manager || false,
        is_active: user.is_active ?? true,
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
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

      if (error) throw error;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
