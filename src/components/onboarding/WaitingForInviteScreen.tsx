import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Users, LogOut, Clock } from "lucide-react";
import { toast } from "sonner";

/**
 * Tela exibida para usuários que não são admin e não pertencem a nenhuma organização.
 * Eles devem aguardar um administrador adicioná-los.
 */
export function WaitingForInviteScreen() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Erro ao sair');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          {/* Ícone */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mx-auto">
            <Users className="h-10 w-10" />
          </div>

          {/* Título */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Aguardando Convite</h1>
            <p className="text-muted-foreground">
              Seu cadastro foi realizado com sucesso!
            </p>
          </div>

          {/* Mensagem */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Próximo passo</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Aguarde um administrador adicionar você a uma organização. 
              Você receberá acesso assim que for incluído.
            </p>
          </div>

          {/* Botão de Sair */}
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>

          {/* Rodapé */}
          <p className="text-xs text-muted-foreground">
            Se você é administrador e deveria criar uma organização, 
            entre em contato com o suporte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
