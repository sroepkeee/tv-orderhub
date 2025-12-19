import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Phone, User, CheckCircle, XCircle, Loader2, Crown, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface ManagerProfile {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string | null;
  is_manager: boolean;
  is_active: boolean;
}

export function ManagerRecipientsManager() {
  const [managers, setManagers] = useState<ManagerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadManagers();
  }, []);

  const loadManagers = async () => {
    setLoading(true);
    try {
      // Load profiles where is_manager = true
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, whatsapp, is_manager, is_active')
        .eq('is_manager', true)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setManagers(data || []);
    } catch (error) {
      console.error('Error loading managers:', error);
      toast.error('Erro ao carregar gestores');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, isManager: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_manager: isManager })
        .eq('id', id);

      if (error) throw error;

      if (!isManager) {
        // Remove from list when deactivating
        setManagers(prev => prev.filter(m => m.id !== id));
      } else {
        setManagers(prev => prev.map(m => 
          m.id === id ? { ...m, is_manager: isManager } : m
        ));
      }
      toast.success(isManager ? 'Gestor ativado' : 'Gestor removido');
    } catch (error) {
      console.error('Error toggling manager:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleUpdateWhatsApp = async (id: string, whatsapp: string) => {
    const formatted = whatsapp.replace(/\D/g, '');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ whatsapp: formatted || null })
        .eq('id', id);

      if (error) throw error;

      setManagers(prev => prev.map(m => 
        m.id === id ? { ...m, whatsapp: formatted } : m
      ));
      toast.success('WhatsApp atualizado');
    } catch (error) {
      console.error('Error updating whatsapp:', error);
      toast.error('Erro ao atualizar WhatsApp');
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return 'Não informado';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-5 w-5 text-amber-500" />
              Gestores Cadastrados
            </CardTitle>
            <CardDescription>
              Usuários marcados como gestores podem interagir com o agente via WhatsApp
            </CardDescription>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate('/admin/users')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Gerenciar Usuários
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {managers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum gestor cadastrado</p>
            <p className="text-sm mb-4">
              Marque usuários como gestores na tela de Administração de Usuários
            </p>
            <Button variant="outline" onClick={() => navigate('/admin/users')}>
              Ir para Gestão de Usuários
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {managers.map((manager) => (
              <div 
                key={manager.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-amber-500/10">
                    <Crown className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {manager.full_name || 'Usuário'}
                      </span>
                      {manager.is_active ? (
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
                    <div className="text-sm text-muted-foreground">
                      {manager.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Phone className="h-3 w-3" />
                      <Input
                        placeholder="5551999999999"
                        value={manager.whatsapp || ''}
                        onChange={(e) => {
                          setManagers(prev => prev.map(m => 
                            m.id === manager.id ? { ...m, whatsapp: e.target.value } : m
                          ));
                        }}
                        onBlur={(e) => handleUpdateWhatsApp(manager.id, e.target.value)}
                        className="h-7 w-40 text-xs"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Gestor</span>
                  <Switch
                    checked={manager.is_manager}
                    onCheckedChange={(checked) => handleToggleActive(manager.id, checked)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>💡 Dica:</strong> Para adicionar novos gestores, vá para{' '}
            <button 
              onClick={() => navigate('/admin/users')}
              className="underline hover:no-underline"
            >
              Administração → Usuários
            </button>
            {' '}e marque o campo "Gestor" do usuário desejado.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
