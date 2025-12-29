import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trackLogin } from "@/hooks/useLoginTracking";
import { Activity, Shield, Wrench, Building } from "lucide-react";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [userType, setUserType] = useState<"internal" | "technician">("internal");
  const [document, setDocument] = useState("");

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Verificar tipo de usuário para redirecionar corretamente
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.user_type === 'technician') {
          navigate("/technician-portal");
        } else {
          navigate("/");
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Atualizar last_login
        await supabase.from('profiles').update({
          last_login: new Date().toISOString()
        }).eq('id', data.user.id);

        // Log login activity
        await trackLogin(data.user.id, 'email');

        // Verificar tipo de usuário para redirecionar
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', data.user.id)
          .single();

        toast.success("Login realizado com sucesso!");
        
        if (profile?.user_type === 'technician') {
          navigate("/technician-portal");
        } else {
          navigate("/");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações para colaborador interno
    if (userType === "internal") {
      if (!department) {
        toast.error("Por favor, selecione sua área de trabalho");
        return;
      }
      
      if (!location) {
        toast.error("Por favor, selecione sua localização");
        return;
      }
    }
    
    // Validações para técnico externo
    if (userType === "technician") {
      if (!document) {
        toast.error("Por favor, informe seu CPF ou CNPJ");
        return;
      }
    }
    
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            department: userType === "internal" ? department : "Técnico Externo",
            location: userType === "internal" ? location : "Externo",
            user_type: userType,
            document: userType === "technician" ? document : null,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Atualizar perfil com user_type e document
        await supabase.from('profiles').update({
          user_type: userType,
          document: userType === "technician" ? document : null,
        }).eq('id', data.user.id);

        if (userType === "technician") {
          toast.success("Cadastro realizado! Você será redirecionado ao portal.");
        } else {
          toast.success("Cadastro realizado! Aguarde a aprovação do administrador.");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const handleSignInWithMicrosoft = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email profile openid',
          redirectTo: `${window.location.origin}/`,
        },
      });
      
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login com Microsoft");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">V.I.V.O.</CardTitle>
          <CardDescription>Controle Operacional Inteligente</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">E-mail</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <div className="flex justify-center mt-2">
                  <ForgotPasswordDialog />
                </div>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Ou continue com
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleSignInWithMicrosoft}
                disabled={loading}
              >
                <Shield className="h-4 w-4" />
                Entrar com Microsoft
              </Button>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Seleção de tipo de usuário */}
                <div className="space-y-2">
                  <Label>Tipo de Acesso</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={userType === "internal" ? "default" : "outline"}
                      className="flex items-center gap-2 h-auto py-3"
                      onClick={() => setUserType("internal")}
                    >
                      <Building className="h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium text-sm">Colaborador</div>
                        <div className="text-xs opacity-70">Interno</div>
                      </div>
                    </Button>
                    <Button
                      type="button"
                      variant={userType === "technician" ? "default" : "outline"}
                      className="flex items-center gap-2 h-auto py-3"
                      onClick={() => setUserType("technician")}
                    >
                      <Wrench className="h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium text-sm">Técnico</div>
                        <div className="text-xs opacity-70">Externo</div>
                      </div>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome Completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                {/* Campo de documento para técnicos */}
                {userType === "technician" && (
                  <div className="space-y-2">
                    <Label htmlFor="signup-document">CPF ou CNPJ</Label>
                    <Input
                      id="signup-document"
                      type="text"
                      placeholder="000.000.000-00"
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Usado para vincular suas remessas de conserto
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                {/* Campos para colaborador interno */}
                {userType === "internal" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="signup-department">Área de Trabalho</Label>
                      <Select value={department} onValueChange={setDepartment} required>
                        <SelectTrigger id="signup-department">
                          <SelectValue placeholder="Selecione sua área" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 z-50 bg-popover">
                          <SelectItem value="Administração">Administração</SelectItem>
                          <SelectItem value="Almoxarifado Geral">Almoxarifado Geral</SelectItem>
                          <SelectItem value="Almoxarifado SSM">Almoxarifado SSM</SelectItem>
                          <SelectItem value="Comercial">Comercial</SelectItem>
                          <SelectItem value="Compras">Compras</SelectItem>
                          <SelectItem value="Expedição">Expedição</SelectItem>
                          <SelectItem value="Faturamento">Faturamento</SelectItem>
                          <SelectItem value="Financeiro">Financeiro</SelectItem>
                          <SelectItem value="Laboratório">Laboratório</SelectItem>
                          <SelectItem value="Logística">Logística</SelectItem>
                          <SelectItem value="Planejamento">Planejamento</SelectItem>
                          <SelectItem value="Produção">Produção</SelectItem>
                          <SelectItem value="Projetos">Projetos</SelectItem>
                          <SelectItem value="SSM">SSM</SelectItem>
                          <SelectItem value="Suporte">Suporte</SelectItem>
                          <SelectItem value="TI">TI</SelectItem>
                          <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-location">Localização</Label>
                      <Select value={location} onValueChange={setLocation} required>
                        <SelectTrigger id="signup-location">
                          <SelectValue placeholder="Selecione a localização" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 z-50 bg-popover">
                          <SelectItem value="Matriz">Matriz</SelectItem>
                          <SelectItem value="Filial">Filial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando conta..." : "Criar conta"}
                </Button>

                {userType === "technician" && (
                  <p className="text-xs text-center text-muted-foreground">
                    Como técnico externo, você terá acesso apenas às suas remessas de conserto.
                  </p>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}