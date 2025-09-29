import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Sun, Moon, LogOut, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "@/hooks/use-toast";

interface UserMenuProps {
  currentUserId: string;
  onUserIdChange: (userId: string) => void;
}

export const UserMenu = ({ currentUserId, onUserIdChange }: UserMenuProps) => {
  const { theme, setTheme } = useTheme();
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [tempUserId, setTempUserId] = useState(currentUserId);

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleUserIdSave = () => {
    if (!tempUserId.trim()) {
      toast({
        title: "Erro",
        description: "O ID do usuário não pode estar vazio.",
        variant: "destructive",
      });
      return;
    }

    onUserIdChange(tempUserId.trim());
    setUserDialogOpen(false);
    toast({
      title: "Usuário atualizado",
      description: `Usuário configurado como: ${tempUserId.trim()}`,
    });
  };

  const handleLogout = () => {
    toast({
      title: "Saindo...",
      description: "Você será desconectado do sistema.",
    });
    // Aqui você pode adicionar lógica de logout real no futuro
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <User className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Usuário</span>
              <span className="text-xs text-muted-foreground">{currentUserId}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setUserDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleThemeToggle}>
            {theme === "dark" ? (
              <>
                <Sun className="mr-2 h-4 w-4" />
                <span>Modo Claro</span>
              </>
            ) : (
              <>
                <Moon className="mr-2 h-4 w-4" />
                <span>Modo Escuro</span>
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleLogout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog para editar usuário */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações do Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium">
                ID do Usuário
              </label>
              <Input
                id="userId"
                value={tempUserId}
                onChange={(e) => setTempUserId(e.target.value)}
                placeholder="Digite seu ID"
              />
              <p className="text-sm text-muted-foreground">
                Suas preferências de visualização de colunas serão salvas com este ID.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUserIdSave}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
