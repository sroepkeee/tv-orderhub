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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, TestTube2, Hash, Bell, AlertTriangle, Package, Loader2, RefreshCw, Bot, Truck, FileText, Users } from "lucide-react";

interface DiscordWebhook {
  id: string;
  channel_name: string;
  webhook_url: string;
  is_active: boolean;
  // Operacional
  receive_smart_alerts: boolean;
  receive_status_changes: boolean;
  receive_phase_notifications: boolean;
  receive_purchase_alerts: boolean;
  // IA
  receive_ai_customer_notifications: boolean;
  receive_ai_handoff_alerts: boolean;
  receive_freight_quotes: boolean;
  receive_delivery_confirmations: boolean;
  receive_daily_reports: boolean;
  min_priority: number;
  created_at: string;
}

export function DiscordWebhooksConfig() {
  const { organizationId } = useOrganizationId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);

  // Fetch webhooks
  const { data: webhooks, isLoading, refetch } = useQuery({
    queryKey: ["discord-webhooks", organizationId],
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
      const { error } = await supabase.from("discord_webhooks").insert({
        organization_id: organizationId,
        channel_name: newChannelName,
        webhook_url: newWebhookUrl,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webhook Discord adicionado!");
      setIsAddDialogOpen(false);
      setNewChannelName("");
      setNewWebhookUrl("");
      queryClient.invalidateQueries({ queryKey: ["discord-webhooks"] });
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
      queryClient.invalidateQueries({ queryKey: ["discord-webhooks"] });
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
      queryClient.invalidateQueries({ queryKey: ["discord-webhooks"] });
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
          title: "Teste de Conexão",
          message: `✅ Webhook configurado com sucesso!\n\nCanal: **#${webhook.channel_name}**\nData: ${new Date().toLocaleString("pt-BR")}`,
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

  // Count enabled notification types for badge
  const countEnabledTypes = (webhook: DiscordWebhook): number => {
    return [
      webhook.receive_smart_alerts,
      webhook.receive_status_changes,
      webhook.receive_phase_notifications,
      webhook.receive_purchase_alerts,
      webhook.receive_ai_customer_notifications,
      webhook.receive_ai_handoff_alerts,
      webhook.receive_freight_quotes,
      webhook.receive_delivery_confirmations,
      webhook.receive_daily_reports,
    ].filter(Boolean).length;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#5865F2]/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#5865F2]" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>
            <div>
              <CardTitle>Integração Discord</CardTitle>
              <CardDescription>
                Configure webhooks para receber notificações em canais do Discord
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Webhook
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Webhook Discord</DialogTitle>
                  <DialogDescription>
                    Configure um novo webhook para receber notificações em um canal do Discord.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome do Canal</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="alertas-criticos"
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>URL do Webhook</Label>
                    <Input
                      placeholder="https://discord.com/api/webhooks/..."
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      No Discord: Configurações do Canal → Integrações → Webhooks → Novo Webhook
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => addMutation.mutate()}
                    disabled={!newChannelName || !newWebhookUrl || addMutation.isPending}
                  >
                    {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Adicionar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !webhooks?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum webhook configurado</p>
            <p className="text-sm">Adicione um webhook para começar a receber notificações no Discord</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Tipos de Notificação</TableHead>
                  <TableHead>Prioridade Mín.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{webhook.channel_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {countEnabledTypes(webhook)} tipos ativos
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={String(webhook.min_priority)}
                        onValueChange={(v) =>
                          updateMutation.mutate({
                            id: webhook.id,
                            updates: { min_priority: Number(v) },
                          })
                        }
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Crítico</SelectItem>
                          <SelectItem value="2">Alto</SelectItem>
                          <SelectItem value="3">Normal</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={webhook.is_active}
                        onCheckedChange={(checked) =>
                          updateMutation.mutate({
                            id: webhook.id,
                            updates: { is_active: checked },
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testWebhook(webhook)}
                          disabled={testingId === webhook.id}
                        >
                          {testingId === webhook.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <TestTube2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Notification Type Toggles - Organized by Category */}
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">#{webhook.channel_name}</span>
                  </div>

                  {/* Operacional */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      Operacional
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pl-6">
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={webhook.receive_smart_alerts}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({
                              id: webhook.id,
                              updates: { receive_smart_alerts: checked },
                            })
                          }
                        />
                        Alertas Inteligentes
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={webhook.receive_phase_notifications}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({
                              id: webhook.id,
                              updates: { receive_phase_notifications: checked },
                            })
                          }
                        />
                        Mudança de Fase
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={webhook.receive_purchase_alerts}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({
                              id: webhook.id,
                              updates: { receive_purchase_alerts: checked },
                            })
                          }
                        />
                        Compras
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={webhook.receive_status_changes}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({
                              id: webhook.id,
                              updates: { receive_status_changes: checked },
                            })
                          }
                        />
                        Status
                      </label>
                    </div>
                  </div>

                  {/* IA - Clientes */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Users className="h-4 w-4" />
                      IA - Clientes
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pl-6">
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={webhook.receive_ai_customer_notifications}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({
                              id: webhook.id,
                              updates: { receive_ai_customer_notifications: checked },
                            })
                          }
                        />
                        Notificações
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={webhook.receive_delivery_confirmations}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({
                              id: webhook.id,
                              updates: { receive_delivery_confirmations: checked },
                            })
                          }
                        />
                        Confirmação Entrega
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={webhook.receive_ai_handoff_alerts}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({
                              id: webhook.id,
                              updates: { receive_ai_handoff_alerts: checked },
                            })
                          }
                        />
                        Handoff Humano
                      </label>
                    </div>
                  </div>

                  {/* IA - Logística */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Truck className="h-4 w-4" />
                      IA - Logística
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pl-6">
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={webhook.receive_freight_quotes}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({
                              id: webhook.id,
                              updates: { receive_freight_quotes: checked },
                            })
                          }
                        />
                        Cotações de Frete
                      </label>
                    </div>
                  </div>

                  {/* Relatórios */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      Relatórios
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pl-6">
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={webhook.receive_daily_reports}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({
                              id: webhook.id,
                              updates: { receive_daily_reports: checked },
                            })
                          }
                        />
                        Relatório Diário
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Como configurar um Webhook no Discord</h4>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Abra as configurações do canal no Discord</li>
            <li>Vá em "Integrações" → "Webhooks"</li>
            <li>Clique em "Novo Webhook" e dê um nome</li>
            <li>Copie a URL do Webhook e cole acima</li>
          </ol>
          <div className="mt-3 text-xs text-muted-foreground">
            <strong>Categorias de Notificação:</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li><strong>Operacional:</strong> Alertas internos, mudanças de fase e status</li>
              <li><strong>IA - Clientes:</strong> Mensagens enviadas a clientes, confirmações de entrega</li>
              <li><strong>IA - Logística:</strong> Cotações de frete enviadas</li>
              <li><strong>Relatórios:</strong> Relatórios gerenciais diários</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}