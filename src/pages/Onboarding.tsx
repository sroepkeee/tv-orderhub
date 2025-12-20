import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Building2, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Settings,
  Users,
  Workflow
} from "lucide-react";

type OnboardingStep = 'company' | 'phases' | 'complete';

interface PhaseTemplate {
  id: string;
  name: string;
  description: string;
  phases: { key: string; name: string; role: string }[];
}

const PHASE_TEMPLATES: PhaseTemplate[] = [
  {
    id: 'logistics',
    name: 'Logística / Entregas',
    description: 'Processos de separação, expedição e entrega',
    phases: [
      { key: 'entrada', name: 'Entrada', role: 'almox_ssm' },
      { key: 'separacao', name: 'Separação', role: 'almox_general' },
      { key: 'conferencia', name: 'Conferência', role: 'production' },
      { key: 'expedicao', name: 'Expedição', role: 'logistics' },
      { key: 'transito', name: 'Em Trânsito', role: 'logistics' },
      { key: 'entregue', name: 'Entregue', role: 'logistics' },
    ]
  },
  {
    id: 'manufacturing',
    name: 'Indústria / Produção',
    description: 'Processos de fabricação com múltiplas etapas',
    phases: [
      { key: 'pedido', name: 'Pedido Recebido', role: 'almox_ssm' },
      { key: 'planejamento', name: 'Planejamento', role: 'order_generation' },
      { key: 'producao', name: 'Produção', role: 'production' },
      { key: 'qualidade', name: 'Qualidade', role: 'laboratory' },
      { key: 'embalagem', name: 'Embalagem', role: 'packaging' },
      { key: 'expedicao', name: 'Expedição', role: 'logistics' },
      { key: 'entregue', name: 'Entregue', role: 'logistics' },
    ]
  },
  {
    id: 'services',
    name: 'Serviços / OS',
    description: 'Ordens de serviço com atendimento técnico',
    phases: [
      { key: 'abertura', name: 'Abertura', role: 'almox_ssm' },
      { key: 'triagem', name: 'Triagem', role: 'order_generation' },
      { key: 'atendimento', name: 'Em Atendimento', role: 'production' },
      { key: 'validacao', name: 'Validação', role: 'laboratory' },
      { key: 'conclusao', name: 'Concluído', role: 'logistics' },
    ]
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Pedidos online com foco em agilidade',
    phases: [
      { key: 'pedido', name: 'Pedido Novo', role: 'almox_ssm' },
      { key: 'pagamento', name: 'Pagamento', role: 'invoicing' },
      { key: 'separacao', name: 'Separação', role: 'almox_general' },
      { key: 'faturado', name: 'Faturado', role: 'invoicing' },
      { key: 'enviado', name: 'Enviado', role: 'logistics' },
      { key: 'entregue', name: 'Entregue', role: 'logistics' },
    ]
  },
  {
    id: 'custom',
    name: 'Personalizado',
    description: 'Crie suas próprias fases do zero',
    phases: [
      { key: 'inicio', name: 'Início', role: 'almox_ssm' },
      { key: 'processamento', name: 'Processamento', role: 'production' },
      { key: 'conclusao', name: 'Conclusão', role: 'logistics' },
    ]
  }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<OnboardingStep>('company');
  const [loading, setLoading] = useState(false);
  
  // Company info
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState("");
  
  // Phases
  const [selectedTemplate, setSelectedTemplate] = useState<string>('logistics');
  
  // Redirect se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Verificar se já tem organização
  useEffect(() => {
    const checkExistingOrg = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (data?.organization_id) {
        // Já tem org, redirecionar para dashboard
        navigate('/');
      }
    };
    
    checkExistingOrg();
  }, [user, navigate]);

  // Auto-generate slug from company name
  useEffect(() => {
    const generateSlug = (name: string) => {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    };
    
    if (companyName) {
      setSlug(generateSlug(companyName));
    }
  }, [companyName]);

  // Validate slug availability
  const validateSlug = async (slugValue: string) => {
    if (!slugValue || slugValue.length < 3) {
      setSlugError('O identificador deve ter pelo menos 3 caracteres');
      return false;
    }
    
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slugValue)
      .maybeSingle();
    
    if (data) {
      setSlugError('Este identificador já está em uso');
      return false;
    }
    
    setSlugError('');
    return true;
  };

  const handleNext = async () => {
    if (step === 'company') {
      if (!companyName.trim()) {
        toast.error('Por favor, informe o nome da empresa');
        return;
      }
      
      const isValid = await validateSlug(slug);
      if (!isValid) return;
      
      setStep('phases');
    } else if (step === 'phases') {
      await createOrganization();
    }
  };

  const handleBack = () => {
    if (step === 'phases') {
      setStep('company');
    }
  };

  const createOrganization = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // 1. Criar organização
      const { data: orgId, error: orgError } = await supabase.rpc(
        'create_organization_with_defaults',
        {
          _org_name: companyName,
          _slug: slug,
          _owner_user_id: user.id,
          _plan: 'starter'
        }
      );
      
      if (orgError) throw orgError;
      
      // 2. Se selecionou template diferente do padrão, atualizar fases
      const template = PHASE_TEMPLATES.find(t => t.id === selectedTemplate);
      if (template && selectedTemplate !== 'custom') {
        // Deletar fases padrão criadas pela função
        await supabase
          .from('phase_config')
          .delete()
          .eq('organization_id', orgId);
        
        // Inserir fases do template
        const phasesToInsert = template.phases.map((phase, index) => ({
          organization_id: orgId as string,
          phase_key: phase.key,
          display_name: phase.name,
          responsible_role: phase.role as "admin" | "almox_general" | "almox_ssm" | "balance_generation" | "freight_quote" | "invoicing" | "laboratory" | "logistics" | "order_generation" | "packaging" | "production",
          order_index: index + 1
        }));
        
        await supabase
          .from('phase_config')
          .insert(phasesToInsert);
      }
      
      setStep('complete');
      
      toast.success('Organização criada com sucesso!');
      
      // Aguardar um momento antes de redirecionar
      setTimeout(() => {
        navigate('/');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast.error(error.message || 'Erro ao criar organização');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-500"
          style={{ 
            width: step === 'company' ? '33%' : step === 'phases' ? '66%' : '100%' 
          }}
        />
      </div>

      <div className="container max-w-2xl mx-auto py-16 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Bem-vindo ao V.I.V.O.</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {step === 'company' && 'Configure sua empresa'}
            {step === 'phases' && 'Escolha seu fluxo de trabalho'}
            {step === 'complete' && 'Tudo pronto!'}
          </h1>
          <p className="text-muted-foreground">
            {step === 'company' && 'Vamos começar com as informações básicas'}
            {step === 'phases' && 'Selecione um modelo que se adeque ao seu negócio'}
            {step === 'complete' && 'Sua organização foi criada com sucesso'}
          </p>
        </div>

        {/* Step: Company */}
        {step === 'company' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Informações da Empresa
              </CardTitle>
              <CardDescription>
                Estes dados serão usados para identificar sua organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="company-name">Nome da Empresa</Label>
                <Input
                  id="company-name"
                  placeholder="Ex: Minha Empresa Ltda"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="text-lg"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="slug">Identificador único</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">vivo.app/</span>
                  <Input
                    id="slug"
                    placeholder="minha-empresa"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      setSlugError('');
                    }}
                    onBlur={() => validateSlug(slug)}
                    className={slugError ? 'border-destructive' : ''}
                  />
                </div>
                {slugError && (
                  <p className="text-sm text-destructive">{slugError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  URL única para acessar sua organização
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Phases */}
        {step === 'phases' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Modelo de Processo
              </CardTitle>
              <CardDescription>
                Você poderá personalizar as fases depois
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {PHASE_TEMPLATES.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`
                    relative p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${selectedTemplate === template.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{template.name}</h3>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </div>
                    {selectedTemplate === template.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  
                  {/* Preview das fases */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {template.phases.map((phase, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {phase.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <Card className="text-center py-12">
            <CardContent className="space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Parabéns!</h2>
                <p className="text-muted-foreground">
                  Sua organização <strong>{companyName}</strong> foi criada.
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <Settings className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Configure</p>
                  <p className="text-xs text-muted-foreground">Personalize suas fases</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Convide</p>
                  <p className="text-xs text-muted-foreground">Adicione sua equipe</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <Workflow className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Comece</p>
                  <p className="text-xs text-muted-foreground">Importe seus processos</p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Redirecionando para o dashboard...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        {step !== 'complete' && (
          <div className="flex justify-between mt-8">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 'company'}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            
            <Button onClick={handleNext} disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Criando...
                </>
              ) : (
                <>
                  {step === 'phases' ? 'Criar Organização' : 'Próximo'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
