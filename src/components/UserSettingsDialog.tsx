import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface UserSettingsDialogProps {
  currentUserId: string;
  onUserIdChange: (userId: string) => void;
}

export const UserSettingsDialog = ({ currentUserId, onUserIdChange }: UserSettingsDialogProps) => {
  const [userId, setUserId] = useState(currentUserId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setUserId(currentUserId);
  }, [currentUserId]);

  const handleSave = () => {
    if (!userId.trim()) {
      toast({
        title: "Erro",
        description: "O ID do usuário não pode estar vazio.",
        variant: "destructive",
      });
      return;
    }

    onUserIdChange(userId.trim());
    setOpen(false);
    toast({
      title: "Configurações salvas",
      description: `Usuário configurado como: ${userId.trim()}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="gap-2">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{currentUserId}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações do Usuário
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="userId">ID do Usuário</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Digite seu ID"
            />
            <p className="text-sm text-muted-foreground">
              Suas preferências de visualização de colunas serão salvas com este ID.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
