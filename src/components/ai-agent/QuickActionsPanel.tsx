import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Send, 
  Loader2, 
  FileText, 
  AlertTriangle, 
  Timer, 
  Layers, 
  BarChart3,
  Users,
  CheckCircle2,
  PieChart,
  MessageSquare,
  Clock,
  Phone,
  Hash
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useOrganizationId } from "@/hooks/useOrganizationId";

interface ReportType {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
  borderColor: string;
}

interface DiscordWebhook {
  id: string;
  channel_name: string;
  is_active: boolean;
  receive_visual_reports: boolean;
}

const REPORT_TYPES: ReportType[] = [
  { 
    id: 'full', 
    label: 'Relatório Completo', 
    icon: FileText, 
    description: 'Todas as métricas e gráficos',
    color: 'bg-indigo-500/10 text-indigo-600',
    borderColor: 'border-indigo-500/30 hover:border-indigo-500/50'
  },
  { 
    id: 'summary', 
    label: 'Resumo Rápido', 
    icon: Layers, 
    description: 'Contagem por fase e SLA',
    color: 'bg-blue-500/10 text-blue-600',
    borderColor: 'border-blue-500/30 hover:border-blue-500/50'
  },
  { 
    id: 'urgent', 
    label: 'Pedidos Urgentes', 
    icon: AlertTriangle, 
    description: 'Entrega hoje/amanhã',
    color: 'bg-red-500/10 text-red-600',
    borderColor: 'border-red-500/30 hover:border-red-500/50'
  },
  { 
    id: 'delayed', 
    label: 'Pedidos Atrasados', 
    icon: Timer, 
    description: 'Top atrasados com detalhes',
    color: 'bg-amber-500/10 text-amber-600',
    borderColor: 'border-amber-500/30 hover:border-amber-500/50'
  },
  { 
    id: 'phase_summary', 
    label: 'Resumo por Fase', 
    icon: BarChart3, 
    description: 'Distribuição no Kanban',
    color: 'bg-purple-500/10 text-purple-600',
    borderColor: 'border-purple-500/30 hover:border-purple-500/50'
  },
];

interface QuickActionsPanelProps {
  className?: string;
}

export function QuickActionsPanel({ className }: QuickActionsPanelProps) {
  const { organizationId } = useOrganizationId();
  const [sendingReport, setSendingReport] = useState<string | null>(null);
  const [showReportOptions, setShowReportOptions] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);
  const [reportOptions, setReportOptions] = useState({
    includeChart: true,
    includeAllCharts: false,
    testMode: false,
    sendToDiscord: false,
  });
  const [lastSentReports, setLastSentReports] = useState<Record<string, boolean>>({});
  const [sendingDiscord, setSendingDiscord] = useState(false);
  const [discordSent, setDiscordSent] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>("all");

  // Fetch Discord webhooks for the select
  const { data: discordWebhooks } = useQuery({
    queryKey: ["discord-webhooks-quick", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discord_webhooks")
        .select("id, channel_name, is_active, receive_visual_reports")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("channel_name");

      if (error) throw error;
      return data as DiscordWebhook[];
    },
    enabled: !!organizationId,
  });

  const sendDiscordVisualReport = async () => {
    setSendingDiscord(true);
    try {
      const body: Record<string, string> = {};
      
      // Se selecionou um webhook específico, passa o ID
      if (selectedWebhookId && selectedWebhookId !== "all") {
        body.targetWebhookId = selectedWebhookId;
      }
      
      if (organizationId) {
        body.organizationId = organizationId;
      }
      
      const { data, error } = await supabase.functions.invoke('discord-send-chart-report', {
        body
      });
      
      if (error) throw error;
      
      setDiscordSent(true);
      
      const targetName = selectedWebhookId === "all" 
        ? `${data?.sent || 0} canal(is)` 
        : `#${discordWebhooks?.find(w => w.id === selectedWebhookId)?.channel_name || 'canal'}`;
      
      toast({
        title: "Relatório Discord Enviado!",
        description: `Enviado para ${targetName} com ${data?.embedCount || 8} embeds e gráficos.`,
      });
    } catch (error: any) {
      console.error('Error sending Discord report:', error);
      toast({
        title: "Erro ao Enviar para Discord",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSendingDiscord(false);
    }
  };

  const openReportOptions = (reportType: ReportType) => {
    setSelectedReportType(reportType);
    setShowReportOptions(true);
  };

  const sendReport = async () => {
    if (!selectedReportType) return;
    
    setSendingReport(selectedReportType.id);
    try {
      const { data, error } = await supabase.functions.invoke('daily-management-report', {
        body: {
          reportType: selectedReportType.id,
          includeChart: reportOptions.includeChart,
          includeAllCharts: reportOptions.includeAllCharts,
          testMode: reportOptions.testMode,
          sendToDiscord: reportOptions.sendToDiscord,
        }
      });
      
      if (error) throw error;
      
      setLastSentReports(prev => ({ ...prev, [selectedReportType.id]: true }));
      
      const channels = ['WhatsApp'];
      if (reportOptions.sendToDiscord) channels.push('Discord');
      
      toast({
        title: "Relatório Enviado!",
        description: `${selectedReportType.label} enviado para ${data?.queuedCount || data?.sentCount || 0} gestor(es) via ${channels.join(' + ')}. ${data?.errorCount > 0 ? `${data.errorCount} erro(s).` : ''}`,
      });
    } catch (error: any) {
      console.error('Error sending report:', error);
      toast({
        title: "Erro ao Enviar",
        description: error.message || "Erro desconhecido ao enviar relatório",
        variant: "destructive",
      });
    } finally {
      setSendingReport(null);
      setShowReportOptions(false);
    }
  };

  const sendQuickReport = async (reportType: ReportType) => {
    setSendingReport(reportType.id);
    try {
      const { data, error } = await supabase.functions.invoke('daily-management-report', {
        body: {
          reportType: reportType.id,
          includeChart: true,
          includeAllCharts: false,
          testMode: false,
        }
      });
      
      if (error) throw error;
      
      setLastSentReports(prev => ({ ...prev, [reportType.id]: true }));
      
      toast({
        title: "Relatório Enviado!",
        description: `${reportType.label} enviado para ${data?.sentCount || 0} gestor(es).`,
      });
    } catch (error: any) {
      console.error('Error sending report:', error);
      toast({
        title: "Erro ao Enviar",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSendingReport(null);
    }
  };

  return (
    <>
      <Card className={cn("border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5 text-indigo-500" />
            Ações Rápidas
          </CardTitle>
          <CardDescription>Dispare relatórios e notificações manualmente para os gestores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* WhatsApp Section Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-green-500 rounded">
              <Phone className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-medium text-sm">WhatsApp - Relatórios para Gestores</span>
              <p className="text-xs text-muted-foreground">
                Envia relatórios para gestores cadastrados via WhatsApp
              </p>
            </div>
          </div>

          {/* Report Type Buttons Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {REPORT_TYPES.map((reportType) => {
              const Icon = reportType.icon;
              const isSending = sendingReport === reportType.id;
              const wasSent = lastSentReports[reportType.id];
              
              return (
                <button
                  key={reportType.id}
                  onClick={() => openReportOptions(reportType)}
                  disabled={sendingReport !== null}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    "hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed",
                    reportType.borderColor,
                    "bg-background"
                  )}
                >
                  <div className={cn("p-3 rounded-full", reportType.color)}>
                    {isSending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : wasSent ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">{reportType.label}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {reportType.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick send info */}
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              📅 Envio automático: configurável em Agendamentos
            </p>
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              Gestores ativos
            </Badge>
          </div>

          <Separator className="my-4" />

          {/* Discord Visual Reports Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#5865F2] rounded">
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-medium text-sm">Relatórios Discord</span>
                  <p className="text-xs text-muted-foreground">
                    Relatório visual com gráficos de SLA
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs bg-[#5865F2]/10 text-[#5865F2]">
                <Clock className="h-3 w-3 mr-1" />
                8h diário
              </Badge>
            </div>

            {/* Webhook Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Enviar para:</Label>
              <Select value={selectedWebhookId} onValueChange={setSelectedWebhookId}>
                <SelectTrigger className="h-9 border-[#5865F2]/30">
                  <SelectValue placeholder="Selecione o canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <span>Todos os webhooks ativos</span>
                    </div>
                  </SelectItem>
                  {discordWebhooks?.filter(w => w.receive_visual_reports).map((webhook) => (
                    <SelectItem key={webhook.id} value={webhook.id}>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span>{webhook.channel_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                  {discordWebhooks?.filter(w => !w.receive_visual_reports).length ? (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground border-t mt-1 pt-1">
                        Webhooks sem relatórios visuais:
                      </div>
                      {discordWebhooks?.filter(w => !w.receive_visual_reports).map((webhook) => (
                        <SelectItem key={webhook.id} value={webhook.id}>
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-muted-foreground opacity-50" />
                            <span className="opacity-75">{webhook.channel_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={sendDiscordVisualReport}
                disabled={sendingDiscord || sendingReport !== null}
                className="flex-1 border-[#5865F2]/30 hover:border-[#5865F2]/50 hover:bg-[#5865F2]/5"
              >
                {sendingDiscord ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : discordSent ? (
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                ) : (
                  <PieChart className="h-4 w-4 mr-2" />
                )}
                Relatório Visual Completo
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={sendDiscordVisualReport}
                disabled={sendingDiscord || sendingReport !== null}
                className="hover:bg-[#5865F2]/10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              💡 Inclui 8 embeds: Resumo, Alertas, Saúde, Fases, Top Pedidos, Tendências e gráficos visuais.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Report Options Dialog */}
      <Dialog open={showReportOptions} onOpenChange={setShowReportOptions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedReportType && (
                <>
                  <selectedReportType.icon className="h-5 w-5" />
                  {selectedReportType.label}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedReportType?.description}. O relatório será enviado para todos os gestores cadastrados.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="includeChart">Incluir gráfico de distribuição</Label>
              <Switch 
                id="includeChart" 
                checked={reportOptions.includeChart}
                onCheckedChange={(v) => setReportOptions({...reportOptions, includeChart: v})}
              />
            </div>
            
            {selectedReportType?.id === 'full' && (
              <div className="flex items-center justify-between">
                <Label htmlFor="includeAllCharts">Incluir todos os gráficos (tendência + SLA)</Label>
                <Switch 
                  id="includeAllCharts" 
                  checked={reportOptions.includeAllCharts}
                  onCheckedChange={(v) => setReportOptions({...reportOptions, includeAllCharts: v})}
                />
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <Label htmlFor="testMode">Modo de teste (não salva logs)</Label>
              <Switch 
                id="testMode" 
                checked={reportOptions.testMode}
                onCheckedChange={(v) => setReportOptions({...reportOptions, testMode: v})}
              />
            </div>

            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#5865F2] rounded">
                  <MessageSquare className="h-3 w-3 text-white" />
                </div>
                <Label htmlFor="sendToDiscord">Enviar também para Discord</Label>
              </div>
              <Switch 
                id="sendToDiscord" 
                checked={reportOptions.sendToDiscord}
                onCheckedChange={(v) => setReportOptions({...reportOptions, sendToDiscord: v})}
              />
            </div>
            
            {reportOptions.sendToDiscord && (
              <p className="text-xs text-muted-foreground pl-6">
                📊 Envia relatório visual com 8 embeds e gráficos para o Discord
              </p>
            )}
            
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                Gestores com <code className="text-xs bg-muted px-1 rounded">is_active = true</code> e WhatsApp configurado receberão o relatório.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowReportOptions(false)}>
              Cancelar
            </Button>
            <Button 
              variant="secondary"
              onClick={() => selectedReportType && sendQuickReport(selectedReportType)}
              disabled={sendingReport !== null}
            >
              Envio Rápido
            </Button>
            <Button onClick={sendReport} disabled={sendingReport !== null}>
              {sendingReport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar com Opções
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
