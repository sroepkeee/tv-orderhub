import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, User, ClipboardCheck, Shield, 
  AlertTriangle, Truck, FileText, Clock,
  Loader2, MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MainLayout from '@/layouts/MainLayout';
import { DynamicChecklist } from '@/components/technicians/DynamicChecklist';
import { SignatureCanvas } from '@/components/technicians/SignatureCanvas';
import { AccessBlockPanel } from '@/components/technicians/AccessBlockPanel';
import { DivergenceManager } from '@/components/technicians/DivergenceManager';
import { ReturnProcessTimeline } from '@/components/technicians/ReturnProcessTimeline';
import { useReturnProcesses, useProcessChecklist, useAccessBlocks, useDivergencias } from '@/hooks/useReturnProcesses';
import { 
  ReturnProcess, 
  STATUS_LABELS, 
  STATUS_COLORS, 
  MOTIVO_LABELS,
  ReturnProcessStatus
} from '@/types/returnProcess';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ReturnProcessDetail() {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const [process, setProcess] = useState<ReturnProcess | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('checklist');

  const { updateProcessStatus } = useReturnProcesses();
  const { items: checklistItems } = useProcessChecklist(processId || null);
  const { blocks: accessBlocks } = useAccessBlocks(processId || null);
  const { divergencias } = useDivergencias(processId || null);

  useEffect(() => {
    if (!processId) return;

    const fetchProcess = async () => {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('return_processes') as any)
          .select(`
            *,
            technician:technicians(id, name, email, phone, specialty, city, state)
          `)
          .eq('id', processId)
          .single();

        if (error) throw error;
        setProcess(data);
      } catch (error) {
        console.error('Error fetching process:', error);
        toast.error('Erro ao carregar processo');
        navigate('/technician-dispatches');
      } finally {
        setLoading(false);
      }
    };

    fetchProcess();

    // Realtime subscription
    const channel = supabase
      .channel(`return_process_${processId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'return_processes',
          filter: `id=eq.${processId}`
        },
        () => fetchProcess()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [processId, navigate]);

  const handleStatusChange = async (newStatus: ReturnProcessStatus) => {
    if (!processId) return;
    await updateProcessStatus(processId, newStatus);
    
    // Refetch process
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('return_processes') as any)
      .select(`*, technician:technicians(id, name, email, phone, specialty, city, state)`)
      .eq('id', processId)
      .single();
    if (data) setProcess(data);
  };

  const handleChecklistComplete = async () => {
    await handleStatusChange('aguardando_envio');
    setActiveTab('shipping');
  };

  // Calculate progress
  const checklistProgress = checklistItems.length > 0
    ? Math.round((checklistItems.filter(i => i.status === 'concluido' || i.status === 'nao_aplicavel').length / checklistItems.length) * 100)
    : 0;

  const accessProgress = accessBlocks.length > 0
    ? Math.round((accessBlocks.filter(b => b.status === 'bloqueado' || b.status === 'nao_aplicavel').length / accessBlocks.length) * 100)
    : 0;

  const pendingDivergencias = divergencias.filter(d => 
    !['resolvida', 'desconsiderada'].includes(d.status)
  ).length;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!process) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Processo não encontrado</p>
          <Button onClick={() => navigate('/technician-dispatches')}>
            Voltar
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isEditable = !['finalizado', 'cancelado'].includes(process.status);

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/technician-dispatches')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Processo de Devolução</h1>
                <Badge className={STATUS_COLORS[process.status]}>
                  {STATUS_LABELS[process.status]}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {MOTIVO_LABELS[process.motivo]}
                {process.motivo_detalhes && ` - ${process.motivo_detalhes}`}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {process.status === 'aberto' && (
                <DropdownMenuItem onClick={() => handleStatusChange('em_checklist')}>
                  Iniciar Checklist
                </DropdownMenuItem>
              )}
              {process.status === 'em_checklist' && checklistProgress === 100 && (
                <DropdownMenuItem onClick={() => handleStatusChange('aguardando_envio')}>
                  Pronto para Envio
                </DropdownMenuItem>
              )}
              {process.status === 'aguardando_envio' && (
                <DropdownMenuItem onClick={() => handleStatusChange('enviado')}>
                  Marcar como Enviado
                </DropdownMenuItem>
              )}
              {process.status === 'recebido' && (
                <DropdownMenuItem onClick={() => handleStatusChange('em_conferencia')}>
                  Iniciar Conferência
                </DropdownMenuItem>
              )}
              {(process.status === 'em_conferencia' || process.status === 'divergencia') && (
                <DropdownMenuItem onClick={() => handleStatusChange('finalizado')}>
                  Finalizar Processo
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {isEditable && (
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => handleStatusChange('cancelado')}
                >
                  Cancelar Processo
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Technician Info Card */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg">{process.technician?.name}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {process.technician?.email && <span>{process.technician.email}</span>}
                  {process.technician?.phone && <span>• {process.technician.phone}</span>}
                </div>
              </div>
              {process.technician?.specialty && (
                <Badge variant="secondary">{process.technician.specialty}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('checklist')}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Checklist</span>
                </div>
                <span className="text-2xl font-bold">{checklistProgress}%</span>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ width: `${checklistProgress}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('access')}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Acessos</span>
                </div>
                <span className="text-2xl font-bold">{accessProgress}%</span>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${accessProgress}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('divergencias')}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Divergências</span>
                </div>
                <span className={`text-2xl font-bold ${pendingDivergencias > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {pendingDivergencias}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {pendingDivergencias === 0 ? 'Nenhuma pendência' : `${pendingDivergencias} pendente(s)`}
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('timeline')}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Criado em</span>
                </div>
              </div>
              <p className="mt-2 text-lg font-medium">
                {new Date(process.created_at).toLocaleDateString('pt-BR')}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(process.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="checklist" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Checklist</span>
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Acessos</span>
            </TabsTrigger>
            <TabsTrigger value="divergencias" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Divergências</span>
              {pendingDivergencias > 0 && (
                <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800">
                  {pendingDivergencias}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="shipping" className="gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Envio</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="checklist" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <DynamicChecklist 
                  processId={processId!} 
                  readOnly={!isEditable}
                  onComplete={handleChecklistComplete}
                />
              </div>
              <div>
                <SignatureCanvas
                  processId={processId!}
                  title="Assinatura do Técnico"
                  description="Assinatura confirmando a devolução dos itens"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="access" className="mt-6">
            <AccessBlockPanel processId={processId!} readOnly={!isEditable} />
          </TabsContent>

          <TabsContent value="divergencias" className="mt-6">
            <DivergenceManager processId={processId!} readOnly={!isEditable} />
          </TabsContent>

          <TabsContent value="shipping" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Logística de Envio
                </CardTitle>
                <CardDescription>
                  Configure o envio dos itens para a base
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Módulo de integração com Correios/Transportadora em desenvolvimento
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <ReturnProcessTimeline processId={processId!} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
