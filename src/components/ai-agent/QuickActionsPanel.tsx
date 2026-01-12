import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Send, 
  Loader2, 
  FileText, 
  AlertTriangle, 
  Timer, 
  Layers, 
  BarChart3,
  Users,
  CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ReportType {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
  borderColor: string;
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
  const [sendingReport, setSendingReport] = useState<string | null>(null);
  const [showReportOptions, setShowReportOptions] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);
  const [reportOptions, setReportOptions] = useState({
    includeChart: true,
    includeAllCharts: false,
    testMode: false,
  });
  const [lastSentReports, setLastSentReports] = useState<Record<string, boolean>>({});

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
        }
      });
      
      if (error) throw error;
      
      setLastSentReports(prev => ({ ...prev, [selectedReportType.id]: true }));
      
      toast({
        title: "Relatório Enviado!",
        description: `${selectedReportType.label} enviado para ${data?.sentCount || 0} gestor(es). ${data?.errorCount > 0 ? `${data.errorCount} erro(s).` : ''}`,
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
