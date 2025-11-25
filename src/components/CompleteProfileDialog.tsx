import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CompleteProfileDialogProps {
  open: boolean;
  userId: string;
  userEmail: string | undefined;
}

export function CompleteProfileDialog({ open, userId, userEmail }: CompleteProfileDialogProps) {
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleComplete = async () => {
    if (!department) {
      toast.error("Por favor, selecione sua área de trabalho");
      return;
    }

    if (!location) {
      toast.error("Por favor, selecione sua localização");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          department,
          location,
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Perfil completado com sucesso!");
      navigate("/");
      window.location.reload(); // Força reload para atualizar contexto
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Complete seu Perfil</DialogTitle>
          <DialogDescription>
            Você entrou com {userEmail}. Para continuar, precisamos de algumas informações adicionais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="complete-department">Área de Trabalho</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger id="complete-department">
                <SelectValue placeholder="Selecione sua área" />
              </SelectTrigger>
              <SelectContent className="max-h-60 z-50 bg-popover">
                <SelectItem value="Administração">Administração</SelectItem>
                <SelectItem value="Almoxarifado">Almoxarifado</SelectItem>
                <SelectItem value="Compras">Compras</SelectItem>
                <SelectItem value="Expedição">Expedição</SelectItem>
                <SelectItem value="Financeiro">Financeiro</SelectItem>
                <SelectItem value="Laboratório">Laboratório</SelectItem>
                <SelectItem value="Logística">Logística</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
                <SelectItem value="Produção">Produção</SelectItem>
                <SelectItem value="Projetos">Projetos</SelectItem>
                <SelectItem value="SSM">SSM</SelectItem>
                <SelectItem value="TI">TI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="complete-location">Localização</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger id="complete-location">
                <SelectValue placeholder="Selecione a localização" />
              </SelectTrigger>
              <SelectContent className="max-h-60 z-50 bg-popover">
                <SelectItem value="Matriz">Matriz</SelectItem>
                <SelectItem value="Filial">Filial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleComplete} disabled={loading} className="w-full">
          {loading ? "Salvando..." : "Concluir"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
