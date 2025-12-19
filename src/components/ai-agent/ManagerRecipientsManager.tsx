import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { 
  Users, Plus, Trash2, Phone, User, CheckCircle, XCircle, Edit2, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Recipient {
  id: string;
  user_id: string;
  whatsapp: string;
  is_active: boolean;
  report_types: string[];
  preferred_time: string | null;
  created_at: string;
  profile?: {
    full_name: string;
    email: string;
  };
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export function ManagerRecipientsManager() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newRecipient, setNewRecipient] = useState({
    user_id: '',
    whatsapp: '',
    is_active: true,
    report_types: ['daily', 'alerts']
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load recipients
      const { data: recipientsData, error: recipientsError } = await supabase
        .from('management_report_recipients')
        .select('*')
        .order('created_at', { ascending: false });

      if (recipientsError) throw recipientsError;

      // Load profiles for display names
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Merge recipient data with profile info
      const enrichedRecipients = (recipientsData || []).map(r => ({
        ...r,
        profile: profilesData?.find(p => p.id === r.user_id)
      }));

      setRecipients(enrichedRecipients);
      setProfiles(profilesData || []);
    } catch (error) {
      console.error('Error loading recipients:', error);
      toast.error('Erro ao carregar destinatários');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipient = async () => {
    if (!newRecipient.user_id || !newRecipient.whatsapp) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Format WhatsApp number
    const formattedWhatsapp = newRecipient.whatsapp.replace(/\D/g, '');
    if (formattedWhatsapp.length < 10) {
      toast.error('Número de WhatsApp inválido');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('management_report_recipients')
        .insert({
          user_id: newRecipient.user_id,
          whatsapp: formattedWhatsapp,
          is_active: newRecipient.is_active,
          report_types: newRecipient.report_types
        });

      if (error) throw error;

      toast.success('Destinatário adicionado com sucesso!');
      setShowAddDialog(false);
      setNewRecipient({ user_id: '', whatsapp: '', is_active: true, report_types: ['daily', 'alerts'] });
      loadData();
    } catch (error: any) {
      console.error('Error adding recipient:', error);
      if (error.code === '23505') {
        toast.error('Este usuário já está cadastrado como destinatário');
      } else {
        toast.error('Erro ao adicionar destinatário');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('management_report_recipients')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      setRecipients(prev => prev.map(r => 
        r.id === id ? { ...r, is_active: isActive } : r
      ));
      toast.success(isActive ? 'Destinatário ativado' : 'Destinatário desativado');
    } catch (error) {
      console.error('Error toggling recipient:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este destinatário?')) return;

    try {
      const { error } = await supabase
        .from('management_report_recipients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRecipients(prev => prev.filter(r => r.id !== id));
      toast.success('Destinatário removido');
    } catch (error) {
      console.error('Error deleting recipient:', error);
      toast.error('Erro ao remover destinatário');
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-purple-500" />
                Gestores Cadastrados
              </CardTitle>
              <CardDescription>
                Números de WhatsApp que podem interagir com o agente gerencial
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum gestor cadastrado</p>
              <p className="text-sm">Adicione gestores para que possam usar o agente via WhatsApp</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recipients.map((recipient) => (
                <div 
                  key={recipient.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${recipient.is_active ? 'bg-green-500/10' : 'bg-muted'}`}>
                      <User className={`h-4 w-4 ${recipient.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {recipient.profile?.full_name || 'Usuário'}
                        </span>
                        {recipient.is_active ? (
                          <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {formatPhone(recipient.whatsapp)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={recipient.is_active}
                      onCheckedChange={(checked) => handleToggleActive(recipient.id, checked)}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(recipient.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Gestor</DialogTitle>
            <DialogDescription>
              Cadastre um gestor para interagir com o agente via WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Usuário *</Label>
              <select
                className="w-full p-2 rounded-md border bg-background"
                value={newRecipient.user_id}
                onChange={(e) => setNewRecipient({ ...newRecipient, user_id: e.target.value })}
              >
                <option value="">Selecione um usuário...</option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name} ({profile.email})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label>WhatsApp *</Label>
              <Input
                placeholder="5511999999999"
                value={newRecipient.whatsapp}
                onChange={(e) => setNewRecipient({ ...newRecipient, whatsapp: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Formato: código do país + DDD + número (ex: 5511999999999)
              </p>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <span className="text-sm font-medium">Ativo</span>
                <p className="text-xs text-muted-foreground">
                  Pode interagir com o agente
                </p>
              </div>
              <Switch
                checked={newRecipient.is_active}
                onCheckedChange={(checked) => setNewRecipient({ ...newRecipient, is_active: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddRecipient} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Adicionar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
