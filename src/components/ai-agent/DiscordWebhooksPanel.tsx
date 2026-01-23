import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Plus, Trash2, TestTube2, Hash, Bell, Loader2, RefreshCw, 
  AlertTriangle, Settings2, ExternalLink, Siren, FileBarChart,
  CheckCircle2, XCircle, MessageSquare, Zap, TrendingUp
} from "lucide-react";

interface DiscordWebhook {
  id: string;
  channel_name: string;
  webhook_url: string;
  is_active: boolean;
  receive_smart_alerts: boolean;
  receive_status_changes: boolean;
  receive_phase_notifications: boolean;
  receive_purchase_alerts: boolean;
  receive_ai_customer_notifications: boolean;
  receive_ai_handoff_alerts: boolean;
  receive_freight_quotes: boolean;
  receive_delivery_confirmations: boolean;
  receive_daily_reports: boolean;
  receive_visual_reports: boolean;
  min_priority: number;
  enable_role_mentions: boolean;
  enable_digest: boolean;
  enable_auto_threads: boolean;
  created_at: string;
}

type WebhookTemplate = 'emergencial' | 'operacional' | 'relatorios' | 'custom';

const WEBHOOK_TEMPLATES: Record<WebhookTemplate, { 
  label: string; 
  icon: React.ReactNode;
  description: string;
  color: string;
  config: Partial<DiscordWebhook>;
}> = {
  emergencial: {
    label: 'Emergencial',
    icon: <Siren className="h-5 w-5" />,
    description: 'Apenas alertas críticos (P1) - ideal para plantão',
    color: 'text-red-500 bg-red-500/10 border-red-500/30',
    config: {
      min_priority: 1,
      receive_smart_alerts: true,
      receive_status_changes: false,
      receive_phase_notifications: false,
      receive_purchase_alerts: false,
      receive_ai_customer_notifications: false,
      receive_ai_handoff_alerts: true,
      receive_freight_quotes: false,
      receive_delivery_confirmations: false,
      receive_daily_reports: false,
      receive_visual_reports: false,
    }
  },
  operacional: {
    label: 'Operacional',
    icon: <Zap className="h-5 w-5" />,
    description: 'Todas as notificações do sistema - canal principal',
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    config: {
      min_priority: 3,
      receive_smart_alerts: true,
      receive_status_changes: true,
      receive_phase_notifications: true,
      receive_purchase_alerts: true,
      receive_ai_customer_notifications: true,
      receive_ai_handoff_alerts: true,
      receive_freight_quotes: true,
      receive_delivery_confirmations: true,
      receive_daily_reports: true,
      receive_visual_reports: true,
    }
  },
  relatorios: {
    label: 'Relatórios',
    icon: <FileBarChart className="h-5 w-5" />,
    description: 'Apenas relatórios e métricas - ideal para gestores',
    color: 'text-green-500 bg-green-500/10 border-green-500/30',
    config: {
      min_priority: 3,
      receive_smart_alerts: false,
      receive_status_changes: false,
      receive_phase_notifications: false,
      receive_purchase_alerts: false,
      receive_ai_customer_notifications: false,
      receive_ai_handoff_alerts: false,
      receive_freight_quotes: false,
      receive_delivery_confirmations: false,
      receive_daily_reports: true,
      receive_visual_reports: true,
    }
  },
  custom: {
    label: 'Personalizado',
    icon: <Settings2 className="h-5 w-5" />,
    description: 'Configuração manual completa',
    color: 'text-muted-foreground bg-muted/50 border-border',
    config: {
      min_priority: 3,
      receive_smart_alerts: false,
      receive_status_changes: false,
      receive_phase_notifications: false,
      receive_purchase_alerts: false,
      receive_ai_customer_notifications: false,
      receive_ai_handoff_alerts: false,
      receive_freight_quotes: false,
      receive_delivery_confirmations: false,
      receive_daily_reports: false,
      receive_visual_reports: false,
    }
  }
};

// Discord icon SVG component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

export function DiscordWebhooksPanel() {
  const { organizationId } = useOrganizationId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WebhookTemplate | null>(null);
  const [newChannelName, setNewChannelName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);

  // Fetch webhooks
  const { data: webhooks, isLoading, refetch } = useQuery({
    queryKey: ["discord-webhooks-panel", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discord_webhooks")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DiscordWebhook[];
    },
    enabled: !!organizationId,
  });

  // Add webhook
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) return;
      
      const templateConfig = WEBHOOK_TEMPLATES[selectedTemplate].config;
      
      const { error } = await supabase.from("discord_webhooks").insert({
        organization_id: organizationId,
        channel_name: newChannelName,
        webhook_url: newWebhookUrl,
        created_by: user?.id,
        ...templateConfig,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webhook Discord adicionado!", {
        description: `Canal #${newChannelName} configurado com template ${selectedTemplate}`,
      });
      setIsAddDialogOpen(false);
      setNewChannelName("");
      setNewWebhookUrl("");
      setSelectedTemplate(null);
      queryClient.invalidateQueries({ queryKey: ["discord-webhooks-panel"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao adicionar webhook", { description: err.message });
    },
  });

  // Update webhook
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DiscordWebhook> }) => {
      const { error } = await supabase
        .from("discord_webhooks")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webhook atualizado!");
      queryClient.invalidateQueries({ queryKey: ["discord-webhooks-panel"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar", { description: err.message });
    },
  });

  // Delete webhook
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("discord_webhooks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webhook removido!");
      queryClient.invalidateQueries({ queryKey: ["discord-webhooks-panel"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao remover", { description: err.message });
    },
  });

  // Test webhook
  const testWebhook = async (webhook: DiscordWebhook) => {
    setTestingId(webhook.id);
    try {
      const { data, error } = await supabase.functions.invoke("discord-notify", {
        body: {
          notificationType: "smart_alert",
          priority: 3,
          title: "🔔 Teste de Conexão",
          message: `Webhook **#${webhook.channel_name}** funcionando!\n\n📅 ${new Date().toLocaleString("pt-BR")}`,
          organizationId,
        },
      });

      if (error) throw error;

      if (data?.sent > 0) {
        toast.success("Mensagem de teste enviada!", {
          description: `Verifique o canal #${webhook.channel_name}`,
        });
      } else {
        toast.warning("Nenhuma mensagem enviada", {
          description: "Verifique se o webhook está ativo",
        });
      }
    } catch (err: any) {
      toast.error("Erro ao testar webhook", { description: err.message });
    } finally {
      setTestingId(null);
    }
  };

  // Determine webhook type based on config
  const getWebhookType = (webhook: DiscordWebhook): WebhookTemplate => {
    if (webhook.min_priority === 1 && webhook.receive_smart_alerts && !webhook.receive_daily_reports) {
      return 'emergencial';
    }
    if (webhook.receive_daily_reports && !webhook.receive_smart_alerts && !webhook.receive_status_changes) {
      return 'relatorios';
    }
    const enabledCount = [
      webhook.receive_smart_alerts,
      webhook.receive_status_changes,
      webhook.receive_phase_notifications,
      webhook.receive_daily_reports,
      webhook.receive_visual_reports,
    ].filter(Boolean).length;
    
    if (enabledCount >= 4) return 'operacional';
    return 'custom';
  };

  // Get priority label and color
  const getPriorityInfo = (priority: number) => {
    switch (priority) {
      case 1: return { label: 'Crítico', color: 'bg-red-500 text-white' };
      case 2: return { label: 'Alto', color: 'bg-orange-500 text-white' };
      default: return { label: 'Normal', color: 'bg-blue-500 text-white' };
    }
  };

  // Count enabled notification types
  const getEnabledFlags = (webhook: DiscordWebhook) => {
    const flags = [];
    if (webhook.receive_smart_alerts) flags.push('Alertas');
    if (webhook.receive_status_changes) flags.push('Status');
    if (webhook.receive_phase_notifications) flags.push('Fases');
    if (webhook.receive_daily_reports) flags.push('Relatórios');
    if (webhook.receive_visual_reports) flags.push('Gráficos');
    if (webhook.receive_purchase_alerts) flags.push('Compras');
    if (webhook.receive_ai_handoff_alerts) flags.push('Handoff IA');
    return flags;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#5865F2]/10">
              <DiscordIcon className="h-6 w-6 text-[#5865F2]" />
            </div>
            <div>
              <CardTitle>Discord Webhooks</CardTitle>
              <CardDescription>
                Gerencie os grupos de disparo de notificações
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Webhook
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !webhooks?.length ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <DiscordIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum webhook configurado</p>
            <p className="text-sm mb-4">Adicione webhooks para receber notificações no Discord</p>
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Primeiro Webhook
            </Button>
          </div>
        ) : (
          <>
            {/* Webhook Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {webhooks.map((webhook) => {
                const webhookType = getWebhookType(webhook);
                const template = WEBHOOK_TEMPLATES[webhookType];
                const priorityInfo = getPriorityInfo(webhook.min_priority);
                const enabledFlags = getEnabledFlags(webhook);

                return (
                  <Card key={webhook.id} className={`relative overflow-hidden border-2 ${webhook.is_active ? '' : 'opacity-60'}`}>
                    {/* Type indicator stripe */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${
                      webhookType === 'emergencial' ? 'bg-red-500' :
                      webhookType === 'operacional' ? 'bg-blue-500' :
                      webhookType === 'relatorios' ? 'bg-green-500' : 'bg-muted'
                    }`} />
                    
                    <CardHeader className="pb-2 pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg border ${template.color}`}>
                            {template.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">{webhook.channel_name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{template.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={priorityInfo.color} variant="secondary">
                            {priorityInfo.label}
                          </Badge>
                          <Switch
                            checked={webhook.is_active}
                            onCheckedChange={(checked) =>
                              updateMutation.mutate({
                                id: webhook.id,
                                updates: { is_active: checked },
                              })
                            }
                          />
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-2 space-y-3">
                      {/* Status indicator */}
                      <div className="flex items-center gap-2 text-sm">
                        {webhook.is_active ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={webhook.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                          {webhook.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      
                      {/* Enabled notifications */}
                      <div className="flex flex-wrap gap-1">
                        {enabledFlags.slice(0, 4).map((flag) => (
                          <Badge key={flag} variant="outline" className="text-xs">
                            {flag}
                          </Badge>
                        ))}
                        {enabledFlags.length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{enabledFlags.length - 4}
                          </Badge>
                        )}
                        {enabledFlags.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">
                            Nenhuma notificação habilitada
                          </span>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => testWebhook(webhook)}
                            disabled={testingId === webhook.id || !webhook.is_active}
                          >
                            {testingId === webhook.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <TestTube2 className="h-4 w-4" />
                            )}
                            <span className="ml-1">Testar</span>
                          </Button>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open('/admin', '_blank')}
                            title="Configurações avançadas"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(webhook.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Notification Matrix Summary */}
            <Separator className="my-6" />
            
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Matriz de Gatilhos
              </h4>
              <div className="rounded-lg border overflow-hidden">
                <ScrollArea className="w-full">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Gatilho</th>
                        {webhooks.map((w) => (
                          <th key={w.id} className="text-center p-2 font-medium min-w-[100px]">
                            <div className="flex items-center justify-center gap-1">
                              <Hash className="h-3 w-3" />
                              <span className="truncate max-w-[80px]">{w.channel_name}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'receive_smart_alerts', label: 'Smart Alerts', icon: <AlertTriangle className="h-3 w-3" /> },
                        { key: 'receive_status_changes', label: 'Mudança de Status', icon: <MessageSquare className="h-3 w-3" /> },
                        { key: 'receive_phase_notifications', label: 'Notif. de Fase', icon: <Bell className="h-3 w-3" /> },
                        { key: 'receive_daily_reports', label: 'Relatórios Diários', icon: <FileBarChart className="h-3 w-3" /> },
                        { key: 'receive_visual_reports', label: 'Relatórios Visuais', icon: <TrendingUp className="h-3 w-3" /> },
                        { key: 'receive_ai_handoff_alerts', label: 'Handoff IA', icon: <Zap className="h-3 w-3" /> },
                      ].map((row) => (
                        <tr key={row.key} className="border-t">
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {row.icon}
                              <span>{row.label}</span>
                            </div>
                          </td>
                          {webhooks.map((w) => (
                            <td key={w.id} className="text-center p-2">
                              {(w as any)[row.key] ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </div>

            {/* Link to advanced settings */}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open('/admin', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Gerenciamento Avançado
              </Button>
            </div>
          </>
        )}
      </CardContent>

      {/* Add Webhook Dialog with Templates */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Webhook Discord</DialogTitle>
            <DialogDescription>
              Escolha um template e configure o canal para receber notificações.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Template Selection */}
            <div className="space-y-3">
              <Label>Escolha um template</Label>
              <div className="grid gap-2">
                {(Object.entries(WEBHOOK_TEMPLATES) as [WebhookTemplate, typeof WEBHOOK_TEMPLATES[WebhookTemplate]][]).map(([key, template]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTemplate(key)}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                      selectedTemplate === key
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${template.color}`}>
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{template.label}</p>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    </div>
                    {selectedTemplate === key && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {selectedTemplate && (
              <>
                <Separator />
                
                {/* Channel Name */}
                <div className="space-y-2">
                  <Label>Nome do Canal</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={
                        selectedTemplate === 'emergencial' ? 'alertas-emergenciais' :
                        selectedTemplate === 'operacional' ? 'pedidos-ssm' :
                        selectedTemplate === 'relatorios' ? 'relatorios-gestores' :
                        'meu-canal'
                      }
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Webhook URL */}
                <div className="space-y-2">
                  <Label>URL do Webhook</Label>
                  <Input
                    placeholder="https://discord.com/api/webhooks/..."
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Discord → Configurações do Canal → Integrações → Webhooks → Novo Webhook
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false);
              setSelectedTemplate(null);
              setNewChannelName("");
              setNewWebhookUrl("");
            }}>
              Cancelar
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!selectedTemplate || !newChannelName || !newWebhookUrl || addMutation.isPending}
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
