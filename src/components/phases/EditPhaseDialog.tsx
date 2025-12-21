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
import { ROLE_LABELS } from "@/lib/roleLabels";
import type { PhaseConfig } from "@/pages/PhaseSettings";

interface EditPhaseDialogProps {
  phase: PhaseConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (phase: PhaseConfig) => void;
}

export function EditPhaseDialog({ phase, open, onOpenChange, onSave }: EditPhaseDialogProps) {
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

  const availableRoles = Object.entries(ROLE_LABELS).filter(
    ([key]) => !['admin'].includes(key)
  );

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
