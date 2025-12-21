import { useState } from "react";
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

interface AddPhaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (phase: Omit<PhaseConfig, 'id' | 'order_index' | 'organization_id'>) => void;
  existingKeys: string[];
}

export function AddPhaseDialog({ open, onOpenChange, onAdd, existingKeys }: AddPhaseDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [phaseKey, setPhaseKey] = useState("");
  const [responsibleRole, setResponsibleRole] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim() || !phaseKey.trim()) return;
    
    if (existingKeys.includes(phaseKey)) {
      return; // Key already exists
    }

    onAdd({
      display_name: displayName.trim(),
      phase_key: phaseKey.trim().toLowerCase().replace(/\s+/g, '_'),
      responsible_role: responsibleRole === "__none__" ? null : responsibleRole || null,
    });

    // Reset form
    setDisplayName("");
    setPhaseKey("");
    setResponsibleRole("");
  };

  const generateKey = (name: string) => {
    return name.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const handleNameChange = (value: string) => {
    setDisplayName(value);
    if (!phaseKey || phaseKey === generateKey(displayName)) {
      setPhaseKey(generateKey(value));
    }
  };

  const availableRoles = Object.entries(ROLE_LABELS).filter(
    ([key]) => !['admin'].includes(key)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Nova Fase</DialogTitle>
          <DialogDescription>
            Crie uma nova fase para o fluxo de trabalho da sua organização.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Nome da Fase</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Verificação de Qualidade"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phaseKey">Chave Única</Label>
            <Input
              id="phaseKey"
              value={phaseKey}
              onChange={(e) => setPhaseKey(e.target.value)}
              placeholder="Ex: verificacao_qualidade"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Identificador interno da fase. Use apenas letras minúsculas e underscores.
            </p>
            {existingKeys.includes(phaseKey) && (
              <p className="text-xs text-destructive">
                Esta chave já está em uso.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsibleRole">Responsável (opcional)</Label>
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
            <Button 
              type="submit" 
              disabled={!displayName.trim() || !phaseKey.trim() || existingKeys.includes(phaseKey)}
            >
              Adicionar Fase
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
