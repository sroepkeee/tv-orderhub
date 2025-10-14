import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { importOrders } from "@/lib/importOrders";
import { toast } from "sonner";

export function ImportOrdersButton() {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para importar pedidos");
      return;
    }

    setImporting(true);
    try {
      const result = await importOrders(user.id);
      toast.success(`Importação concluída! ${result.successCount} pedidos importados com sucesso.${result.errorCount > 0 ? ` ${result.errorCount} erros.` : ''}`);
      window.location.reload(); // Recarregar para mostrar os novos dados
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error("Erro ao importar pedidos. Verifique o console para mais detalhes.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Button 
      onClick={handleImport} 
      disabled={importing}
      variant="outline"
      className="gap-2"
    >
      <Upload className="h-4 w-4" />
      {importing ? "Importando..." : "Importar Pedidos da Planilha"}
    </Button>
  );
}
