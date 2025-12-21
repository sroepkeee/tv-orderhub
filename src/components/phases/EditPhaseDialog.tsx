import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { ROLE_LABELS } from "@/lib/roleLabels";
import type { PhaseConfig, UserByRole } from "@/pages/PhaseSettings";

interface EditPhaseDialogProps {
  phase: PhaseConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (phase: PhaseConfig) => void;
  usersByRole?: Record<string, UserByRole[]>;
}

export function EditPhaseDialog({ phase, open, onOpenChange, onSave, usersByRole = {} }: EditPhaseDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [responsibleRole, setResponsibleRole] = useState<string>("");

  useEffect(() => {
    if (phase) {
      setDisplayName(phase.display_name);
      setResponsibleRole(phase.responsible_role || "__none__");
    }
  }, [phase]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phase || !displayName.trim()) return;

    onSave({
      ...phase,
      display_name: displayName.trim(),
      responsible_role: responsibleRole === "__none__" ? null : responsibleRole || null,
    });
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return '?';
  };

  const availableRoles = Object.entries(ROLE_LABELS).filter(
    ([key]) => !['admin'].includes(key)
  );

  const currentRoleUsers = responsibleRole && responsibleRole !== "__none__" 
    ? usersByRole[responsibleRole] || [] 
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Fase</DialogTitle>
          <DialogDescription>
            Altere as configurações da fase "{phase?.phase_key}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editDisplayName">Nome da Fase</Label>
            <Input
              id="editDisplayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Verificação de Qualidade"
            />
          </div>

          <div className="space-y-2">
            <Label>Chave Única</Label>
            <Input
              value={phase?.phase_key || ""}
              disabled
              className="font-mono text-sm bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              A chave única não pode ser alterada após a criação.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editResponsibleRole">Responsável</Label>
            <Select value={responsibleRole} onValueChange={setResponsibleRole}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {availableRoles.map(([key, roleInfo]) => (
                  <SelectItem key={key} value={key}>
                    {roleInfo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentRoleUsers.length > 0 && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                <span>{currentRoleUsers.length} usuário{currentRoleUsers.length !== 1 ? 's' : ''} com esta função</span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {currentRoleUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-full text-xs">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[8px]">
                        {getInitials(user.full_name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[100px]">
                      {user.full_name || user.email || 'Sem nome'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!displayName.trim()}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
