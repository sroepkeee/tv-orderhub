import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Clock, 
  RefreshCw, 
  Phone, 
  Mail, 
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  Copy,
  Loader2,
  Calendar,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CronJob {
  job_id: number;
  job_name: string;
  schedule: string;
  is_active: boolean;
  last_run: string | null;
  last_status: string | null;
  run_count: number;
  success_count: number;
  fail_count: number;
}

interface ExpectedJob {
  name: string;
  channel: 'whatsapp' | 'email' | 'discord' | 'system';
  description: string;
  schedule: string;
  edgeFunction: string;
}

const EXPECTED_CRON_JOBS: ExpectedJob[] = [
  // WhatsApp
  { 
    name: 'process-message-queue', 
    channel: 'whatsapp',
    description: 'Processador de Fila de Mensagens',
    schedule: '*/1 * * * *',
    edgeFunction: 'process-message-queue'
  },
  { 
    name: 'daily-management-report-08h', 
    channel: 'whatsapp',
    description: 'Relatório Gerencial 8h',
    schedule: '0 11 * * 1-6',
    edgeFunction: 'daily-management-report'
  },
  { 
    name: 'daily-management-report-1330', 
    channel: 'whatsapp',
    description: 'Relatório Gerencial 13:30',
    schedule: '30 16 * * 1-6',
    edgeFunction: 'daily-management-report'
  },
  { 
    name: 'check-delivery-confirmations', 
    channel: 'whatsapp',
    description: 'Verificar Confirmações de Entrega',
    schedule: '0 * * * *',
    edgeFunction: 'check-delivery-confirmations'
  },
  { 
    name: 'check-stalled-orders', 
    channel: 'whatsapp',
    description: 'Verificar Pedidos Parados',
    schedule: '0 12 * * *',
    edgeFunction: 'check-stalled-orders'
  },
  
  // Discord
  { 
    name: 'discord-visual-report-daily-8h', 
    channel: 'discord',
    description: 'Relatório Visual Discord 8h',
    schedule: '0 11 * * *',
    edgeFunction: 'discord-send-chart-report'
  },
  { 
    name: 'discord-send-digest', 
    channel: 'discord',
    description: 'Digest de Notificações (15min)',
    schedule: '*/15 * * * *',
    edgeFunction: 'discord-send-digest'
  },
  
  // E-mail
  { 
    name: 'send-scheduled-reports', 
    channel: 'email',
    description: 'Relatórios Agendados por E-mail',
    schedule: '0 12 * * *',
    edgeFunction: 'send-scheduled-reports'
  },
];

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlamt5eWpoY2tkbHR0aWV1eWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNzMxNzYsImV4cCI6MjA3NDc0OTE3Nn0.iS9y0xOEbv1N7THwbmeQ2DLB5ablnUU6rDs7XDVGG3c';

const parseSchedule = (schedule: string): string => {
  const parts = schedule.split(' ');
  if (parts.length !== 5) return schedule;
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  // A cada minuto
  if (minute.startsWith('*/') && hour === '*') {
    return `A cada ${minute.replace('*/', '')} minuto(s)`;
  }
  
  // A cada X minutos em horas específicas
  if (minute.startsWith('*/')) {
    return `A cada ${minute.replace('*/', '')} minutos`;
  }
  
  // Hora específica
  if (minute !== '*' && hour !== '*') {
    const hourNum = parseInt(hour);
    const minuteNum = parseInt(minute);
    const brtHour = hourNum - 3; // UTC to BRT
    const timeStr = `${brtHour.toString().padStart(2, '0')}:${minuteNum.toString().padStart(2, '0')}`;
    
    if (dayOfWeek === '1-6') {
      return `Seg-Sáb às ${timeStr} (BRT)`;
    } else if (dayOfWeek === '*') {
      return `Diário às ${timeStr} (BRT)`;
    }
    return `${timeStr} (BRT)`;
  }
  
  // A cada hora
  if (minute === '0' && hour === '*') {
    return 'A cada hora';
  }
  
  return schedule;
};

const generateCronSQL = (job: ExpectedJob): string => {
  return `SELECT cron.schedule(
  '${job.name}',
  '${job.schedule}',
  $$
  SELECT net.http_post(
    url := 'https://wejkyyjhckdlttieuyku.supabase.co/functions/v1/${job.edgeFunction}',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${ANON_KEY}"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);`;
};

const ChannelIcon = ({ channel }: { channel: string }) => {
  switch (channel) {
    case 'whatsapp':
      return <Phone className="h-4 w-4" />;
    case 'discord':
      return <MessageSquare className="h-4 w-4" />;
    case 'email':
      return <Mail className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

const ChannelBadge = ({ channel }: { channel: string }) => {
  const config = {
    whatsapp: { label: 'WhatsApp', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
    discord: { label: 'Discord', className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30' },
    email: { label: 'E-mail', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
    system: { label: 'Sistema', className: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
  };
  
  const cfg = config[channel as keyof typeof config] || config.system;
  
  return (
    <Badge variant="outline" className={cfg.className}>
      <ChannelIcon channel={channel} />
      <span className="ml-1">{cfg.label}</span>
    </Badge>
  );
};

interface JobCardProps {
  job: ExpectedJob;
  cronJob?: CronJob;
  onExecute: (edgeFunction: string) => void;
  onCopySQL: (sql: string) => void;
  executing: string | null;
}

const JobCard = ({ job, cronJob, onExecute, onCopySQL, executing }: JobCardProps) => {
  const isConfigured = !!cronJob;
  const isActive = cronJob?.is_active ?? false;
  const successRate = cronJob && cronJob.run_count > 0 
    ? Math.round((cronJob.success_count / cronJob.run_count) * 100) 
    : null;
  
  const getStatusIcon = () => {
    if (!isConfigured) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    if (!isActive) return <XCircle className="h-4 w-4 text-red-500" />;
    if (cronJob?.last_status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  };
  
  const getStatusLabel = () => {
    if (!isConfigured) return { text: 'Não Configurado', className: 'bg-yellow-500/10 text-yellow-600' };
    if (!isActive) return { text: 'Inativo', className: 'bg-red-500/10 text-red-600' };
    if (cronJob?.last_status === 'failed') return { text: 'Falhou', className: 'bg-red-500/10 text-red-600' };
    return { text: 'Ativo', className: 'bg-green-500/10 text-green-600' };
  };
  
  const status = getStatusLabel();
  
  return (
    <Card className={`${!isConfigured ? 'border-yellow-500/30' : isActive ? 'border-green-500/20' : 'border-red-500/30'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon()}
              <span className="font-medium text-sm truncate">{job.name}</span>
              <Badge variant="secondary" className={`text-xs ${status.className}`}>
                {status.text}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              {job.description}
            </p>
            
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <code className="bg-muted px-1 py-0.5 rounded">{job.schedule}</code>
              </div>
              <span className="text-muted-foreground/50">•</span>
              <span>{parseSchedule(job.schedule)}</span>
            </div>
            
            {cronJob && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                {cronJob.last_run && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Última: {format(new Date(cronJob.last_run), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                    <span className="text-muted-foreground/50">
                      ({formatDistanceToNow(new Date(cronJob.last_run), { locale: ptBR, addSuffix: true })})
                    </span>
                  </div>
                )}
                
                {successRate !== null && cronJob.run_count > 0 && (
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    <span className={successRate >= 90 ? 'text-green-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}>
                      {successRate}% sucesso
                    </span>
                    <span className="text-muted-foreground">
                      ({cronJob.run_count} execuções)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onExecute(job.edgeFunction)}
              disabled={executing !== null}
              title="Executar agora"
            >
              {executing === job.edgeFunction ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            
            {!isConfigured && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopySQL(generateCronSQL(job))}
                title="Copiar SQL de ativação"
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export function CronJobsDashboard() {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadCronJobs = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_cron_jobs');
      
      if (error) {
        console.error('Error loading cron jobs:', error);
        // If function doesn't exist or pg_cron not installed, return empty
        setCronJobs([]);
        return;
      }
      
      setCronJobs(data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading cron jobs:', error);
      setCronJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCronJobs();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadCronJobs, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadCronJobs();
  };

  const handleExecute = async (edgeFunction: string) => {
    setExecuting(edgeFunction);
    try {
      const { error } = await supabase.functions.invoke(edgeFunction, {
        body: {}
      });
      
      if (error) throw error;
      
      toast({
        title: "Função Executada",
        description: `${edgeFunction} foi executada com sucesso.`,
      });
      
      // Refresh jobs after execution
      setTimeout(loadCronJobs, 2000);
    } catch (error: any) {
      toast({
        title: "Erro na Execução",
        description: error.message || "Erro ao executar função",
        variant: "destructive",
      });
    } finally {
      setExecuting(null);
    }
  };

  const handleCopySQL = (sql: string) => {
    navigator.clipboard.writeText(sql);
    toast({
      title: "SQL Copiado!",
      description: "Execute no SQL Editor do Supabase para ativar o cron job.",
    });
  };

  // Group jobs by channel
  const whatsappJobs = EXPECTED_CRON_JOBS.filter(j => j.channel === 'whatsapp');
  const discordJobs = EXPECTED_CRON_JOBS.filter(j => j.channel === 'discord');
  const emailJobs = EXPECTED_CRON_JOBS.filter(j => j.channel === 'email');

  const getCronJob = (name: string) => cronJobs.find(c => c.job_name === name);

  // Stats
  const configuredCount = EXPECTED_CRON_JOBS.filter(j => getCronJob(j.name)).length;
  const activeCount = cronJobs.filter(j => j.is_active).length;
  const whatsappActive = whatsappJobs.filter(j => getCronJob(j.name)?.is_active).length;
  const discordActive = discordJobs.filter(j => getCronJob(j.name)?.is_active).length;
  const emailActive = emailJobs.filter(j => getCronJob(j.name)?.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Monitoramento de Cron Jobs
          </h2>
          <p className="text-sm text-muted-foreground">
            Tarefas agendadas do sistema organizadas por canal
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Atualizado {formatDistanceToNow(lastUpdated, { locale: ptBR, addSuffix: true })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{EXPECTED_CRON_JOBS.length}</div>
            <p className="text-xs text-muted-foreground">
              {configuredCount} configurados / {EXPECTED_CRON_JOBS.length - configuredCount} pendentes
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-green-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-green-600" />
              WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{whatsappJobs.length}</div>
            <p className="text-xs text-muted-foreground">
              {whatsappActive} ativos
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-indigo-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-600" />
              Discord
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{discordJobs.length}</div>
            <p className="text-xs text-muted-foreground">
              {discordActive} ativos
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-blue-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              E-mail
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{emailJobs.length}</div>
            <p className="text-xs text-muted-foreground">
              {emailActive} ativos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp Jobs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-600 rounded">
            <Phone className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-medium">WhatsApp</h3>
          <Badge variant="secondary">{whatsappJobs.length} jobs</Badge>
        </div>
        
        <div className="grid gap-3">
          {whatsappJobs.map(job => (
            <JobCard
              key={job.name}
              job={job}
              cronJob={getCronJob(job.name)}
              onExecute={handleExecute}
              onCopySQL={handleCopySQL}
              executing={executing}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Discord Jobs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#5865F2] rounded">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-medium">Discord</h3>
          <Badge variant="secondary">{discordJobs.length} jobs</Badge>
        </div>
        
        <div className="grid gap-3">
          {discordJobs.map(job => (
            <JobCard
              key={job.name}
              job={job}
              cronJob={getCronJob(job.name)}
              onExecute={handleExecute}
              onCopySQL={handleCopySQL}
              executing={executing}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Email Jobs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded">
            <Mail className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-medium">E-mail</h3>
          <Badge variant="secondary">{emailJobs.length} jobs</Badge>
        </div>
        
        <div className="grid gap-3">
          {emailJobs.map(job => (
            <JobCard
              key={job.name}
              job={job}
              cronJob={getCronJob(job.name)}
              onExecute={handleExecute}
              onCopySQL={handleCopySQL}
              executing={executing}
            />
          ))}
        </div>
      </div>

      {/* Help Section */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Como ativar cron jobs pendentes?</p>
              <p className="text-xs text-muted-foreground">
                1. Clique no ícone de copiar ao lado do job pendente<br />
                2. Abra o SQL Editor no Supabase Dashboard<br />
                3. Cole e execute o SQL copiado<br />
                4. O job será ativado automaticamente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
