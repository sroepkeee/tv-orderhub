import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Bell, BellOff, UserCog, MessageSquare, Crown, CheckCircle, AlertCircle } from 'lucide-react';

interface PhaseManager {
  id: string;
  phase_key: string;
  user_id: string;
  whatsapp: string;
  is_active: boolean;
  receive_new_orders: boolean;
  receive_urgent_alerts: boolean;
  receive_daily_summary: boolean;
  notification_priority: number;
  profiles?: {
    full_name: string;
    email: string;
    whatsapp?: string;
  };
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  whatsapp?: string;
}

interface PhaseConfig {
  id: string;
  phase_key: string;
  display_name: string;
  order_index: number;
  manager_user_id: string | null;
  manager_profile?: {
    id: string;
    full_name: string;
    email: string;
    whatsapp?: string;
  };
}

export function PhaseManagersConfig() {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [managers, setManagers] = useState<PhaseManager[]>([]);
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedPhase, setSelectedPhase] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [receiveNewOrders, setReceiveNewOrders] = useState(true);
  const [receiveUrgentAlerts, setReceiveUrgentAlerts] = useState(true);
  const [receiveDailySummary, setReceiveDailySummary] = useState(false);
  const [whatsappWarning, setWhatsappWarning] = useState('');

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
  }, [organizationId]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadPhases(), loadManagers(), loadProfiles()]);
    setLoading(false);
  };

  const loadPhases = async () => {
    const { data, error } = await supabase
      .from('phase_config')
      .select('id, phase_key, display_name, order_index, manager_user_id')
      .eq('organization_id', organizationId)
      .order('order_index');

    if (error) {
      console.error('Erro ao carregar fases:', error);
      return;
    }

    // Buscar perfis dos gestores principais
    const managerIds = data?.filter(p => p.manager_user_id).map(p => p.manager_user_id) || [];
    
    if (managerIds.length > 0) {
      const { data: managerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, whatsapp')
        .in('id', managerIds);

      const phasesWithManagers = data?.map(phase => ({
        ...phase,
        manager_profile: managerProfiles?.find(p => p.id === phase.manager_user_id)
      })) || [];

      setPhases(phasesWithManagers);
    } else {
      setPhases(data || []);
    }
  };

  const loadManagers = async () => {
    const { data, error } = await supabase
      .from('phase_managers')
      .select(`
        *,
        profiles:user_id (full_name, email, whatsapp)
      `)
      .eq('organization_id', organizationId)
      .order('phase_key');

    if (error) {
      console.error('Erro ao carregar gestores:', error);
      toast.error('Erro ao carregar gestores');
    } else {
      setManagers(data || []);
    }
  };

  const loadProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, whatsapp')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      console.error('Erro ao carregar perfis:', error);
    } else {
      setProfiles(data || []);
    }
  };

  const handleAddManager = async () => {
    if (!selectedUser || !selectedPhase || !whatsapp) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const normalizedWhatsapp = whatsapp.replace(/\D/g, '');
    
    // Validação de WhatsApp mínimo
    if (normalizedWhatsapp.length < 10) {
      toast.error('WhatsApp deve ter pelo menos 10 dígitos (DDD + número)');
      return;
    }

    const { error } = await supabase
      .from('phase_managers')
      .insert({
        phase_key: selectedPhase,
        user_id: selectedUser,
        whatsapp: normalizedWhatsapp,
        organization_id: organizationId,
        receive_new_orders: receiveNewOrders,
        receive_urgent_alerts: receiveUrgentAlerts,
        receive_daily_summary: receiveDailySummary
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('Este usuário já é gestor desta fase');
      } else {
        console.error('Erro ao adicionar gestor:', error);
        toast.error('Erro ao adicionar gestor');
      }
    } else {
      toast.success('Gestor adicionado com sucesso');
      setIsDialogOpen(false);
      resetForm();
      loadManagers();
    }
  };

  const handleToggleActive = async (manager: PhaseManager) => {
    const { error } = await supabase
      .from('phase_managers')
      .update({ is_active: !manager.is_active })
      .eq('id', manager.id);

    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      toast.success(manager.is_active ? 'Gestor desativado' : 'Gestor ativado');
      loadManagers();
    }
  };

  const handleTogglePreference = async (manager: PhaseManager, field: 'receive_new_orders' | 'receive_urgent_alerts' | 'receive_daily_summary') => {
    const { error } = await supabase
      .from('phase_managers')
      .update({ [field]: !manager[field] })
      .eq('id', manager.id);

    if (error) {
      toast.error('Erro ao atualizar preferência');
    } else {
      loadManagers();
    }
  };

  const handleDeleteManager = async (id: string) => {
    if (!confirm('Remover este gestor da fase?')) return;

    const { error } = await supabase
      .from('phase_managers')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao remover gestor');
    } else {
      toast.success('Gestor removido');
      loadManagers();
    }
  };

  const resetForm = () => {
    setSelectedUser('');
    setSelectedPhase('');
    setWhatsapp('');
    setWhatsappWarning('');
    setReceiveNewOrders(true);
    setReceiveUrgentAlerts(true);
    setReceiveDailySummary(false);
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUser(userId);
    const profile = profiles.find(p => p.id === userId);
    if (profile?.whatsapp) {
      setWhatsapp(profile.whatsapp);
      setWhatsappWarning('');
    } else {
      setWhatsapp('');
      setWhatsappWarning('Este usuário não tem WhatsApp cadastrado no perfil');
    }
  };

  // Helper para verificar se WhatsApp é válido
  const isValidWhatsapp = (phone: string | undefined | null) => {
    if (!phone) return false;
    const normalized = phone.replace(/\D/g, '');
    return normalized.length >= 10;
  };

  // Agrupar por fase dinâmica
  const managersByPhase = phases.map(phase => ({
    ...phase,
    managers: managers.filter(m => m.phase_key === phase.phase_key),
    isPrimaryManager: (userId: string) => phase.manager_user_id === userId
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Gestores por Fase
            </CardTitle>
            <CardDescription>
              Configure quais gestores receberão notificações WhatsApp para cada fase do processo
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Gestor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Gestor de Fase</DialogTitle>
                <DialogDescription>
                  O gestor receberá notificações WhatsApp quando pedidos entrarem nesta fase
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Fase *</Label>
                  <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a fase" />
                    </SelectTrigger>
                    <SelectContent>
                      {phases.map(phase => (
                        <SelectItem key={phase.phase_key} value={phase.phase_key}>
                          <span className="flex items-center gap-2">
                            <span>{phase.display_name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Usuário *</Label>
                  <Select value={selectedUser} onValueChange={handleUserSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(profile => (
                        <SelectItem key={profile.id} value={profile.id}>
                          <span className="flex items-center gap-2">
                            {isValidWhatsapp(profile.whatsapp) ? (
                              <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                            )}
                            <span>{profile.full_name || profile.email}</span>
                            {profile.whatsapp && (
                              <span className="text-xs text-muted-foreground">
                                ({profile.whatsapp})
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {whatsappWarning && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {whatsappWarning}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>WhatsApp *</Label>
                  <Input
                    placeholder="51999999999"
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Apenas números, com DDD
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <Label className="text-sm font-medium">Preferências de Notificação</Label>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-sm">Novos pedidos</span>
                      <p className="text-xs text-muted-foreground">Quando um pedido entra na fase</p>
                    </div>
                    <Switch checked={receiveNewOrders} onCheckedChange={setReceiveNewOrders} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-sm">Alertas urgentes</span>
                      <p className="text-xs text-muted-foreground">Pedidos com prazo crítico</p>
                    </div>
                    <Switch checked={receiveUrgentAlerts} onCheckedChange={setReceiveUrgentAlerts} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-sm">Resumo diário</span>
                      <p className="text-xs text-muted-foreground">Relatório consolidado do dia</p>
                    </div>
                    <Switch checked={receiveDailySummary} onCheckedChange={setReceiveDailySummary} />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddManager}>
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : phases.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Nenhuma fase configurada</p>
            <p className="text-sm text-muted-foreground/70">
              Configure fases em "Configuração de Fases" primeiro
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {managersByPhase.map(phase => {
              const hasMainManager = phase.manager_user_id && phase.manager_profile;
              const additionalManagers = phase.managers.filter(m => m.user_id !== phase.manager_user_id);
              const hasAnyManager = hasMainManager || phase.managers.length > 0;

              return (
                <div key={phase.phase_key} className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-medium">{phase.display_name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {phase.phase_key}
                    </Badge>
                    {hasMainManager && (
                      <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                        <Crown className="h-3 w-3 mr-1" />
                        Gestor Principal
                      </Badge>
                    )}
                  </div>

                  {!hasAnyManager ? (
                    <p className="text-sm text-muted-foreground py-2">
                      Nenhum gestor configurado para esta fase
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Gestor</TableHead>
                          <TableHead>WhatsApp</TableHead>
                          <TableHead className="text-center">Novos</TableHead>
                          <TableHead className="text-center">Urgentes</TableHead>
                          <TableHead className="text-center">Resumo</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Gestor Principal de phase_config */}
                        {hasMainManager && !phase.managers.some(m => m.user_id === phase.manager_user_id) && (
                          <TableRow className="bg-amber-500/5">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Crown className="h-4 w-4 text-amber-500" />
                                <div>
                                  <p className="font-medium">{phase.manager_profile?.full_name || 'N/A'}</p>
                                  <p className="text-xs text-muted-foreground">{phase.manager_profile?.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {isValidWhatsapp(phase.manager_profile?.whatsapp) ? (
                                phase.manager_profile?.whatsapp
                              ) : (
                                <span className="flex items-center gap-1 text-destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  {phase.manager_profile?.whatsapp || 'Não configurado'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                              Definido em "Fases do Workflow" - adicione abaixo para configurar notificações
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        )}

                        {/* Gestores de phase_managers */}
                        {phase.managers.map(manager => (
                          <TableRow 
                            key={manager.id} 
                            className={`${!manager.is_active ? 'opacity-50' : ''} ${phase.isPrimaryManager(manager.user_id) ? 'bg-amber-500/5' : ''}`}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {phase.isPrimaryManager(manager.user_id) && (
                                  <Crown className="h-4 w-4 text-amber-500" />
                                )}
                                <div>
                                  <p className="font-medium">{manager.profiles?.full_name || 'N/A'}</p>
                                  <p className="text-xs text-muted-foreground">{manager.profiles?.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {isValidWhatsapp(manager.whatsapp) ? (
                                manager.whatsapp
                              ) : isValidWhatsapp(manager.profiles?.whatsapp) ? (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  {manager.profiles?.whatsapp}
                                  <span className="text-xs">(perfil)</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  Não configurado
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={manager.receive_new_orders}
                                onCheckedChange={() => handleTogglePreference(manager, 'receive_new_orders')}
                                disabled={!manager.is_active}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={manager.receive_urgent_alerts}
                                onCheckedChange={() => handleTogglePreference(manager, 'receive_urgent_alerts')}
                                disabled={!manager.is_active}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={manager.receive_daily_summary}
                                onCheckedChange={() => handleTogglePreference(manager, 'receive_daily_summary')}
                                disabled={!manager.is_active}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleActive(manager)}
                              >
                                {manager.is_active ? (
                                  <Bell className="h-4 w-4 text-green-500" />
                                ) : (
                                  <BellOff className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteManager(manager.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
