import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DepartmentSelectProps {
  userId: string;
  currentDepartment: string | null;
  onUpdate: () => void;
}

const DEPARTMENTS = [
  'Almoxarifado',
  'Compras',
  'Expedição',
  'Financeiro',
  'Outros',
  'Produção',
  'Projetos',
  'SSM',
  'TI'
];

export const DepartmentSelect = ({ userId, currentDepartment, onUpdate }: DepartmentSelectProps) => {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async (newDepartment: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ department: newDepartment })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Departamento atualizado",
        description: `Departamento alterado para ${newDepartment}`,
      });

      onUpdate();
    } catch (error) {
      console.error('Erro ao atualizar departamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o departamento",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select
      value={currentDepartment || ''}
      onValueChange={handleUpdate}
      disabled={saving}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecione..." />
      </SelectTrigger>
      <SelectContent>
        {DEPARTMENTS.map((dept) => (
          <SelectItem key={dept} value={dept}>
            {dept}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
