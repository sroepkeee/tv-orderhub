import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Mail, User, Phone, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomerWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  existingWhatsapp?: string;
  existingContactPerson?: string;
  onSaved?: (data: { contact_person: string | null; whatsapp: string | null }) => void;
}

export function CustomerWhatsAppDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  existingWhatsapp,
  existingContactPerson,
  onSaved
}: CustomerWhatsAppDialogProps) {
  const [contactPerson, setContactPerson] = useState(existingContactPerson || "");
  const [whatsapp, setWhatsapp] = useState(existingWhatsapp || "");
  const [email, setEmail] = useState("");
  const [preferredChannel, setPreferredChannel] = useState("whatsapp");
  const [optInWhatsapp, setOptInWhatsapp] = useState(true);
  const [optInEmail, setOptInEmail] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar dados existentes ao abrir o dialog
  useEffect(() => {
    if (open && customerId) {
      loadExistingData();
    }
  }, [open, customerId]);

  // Atualizar estados quando props mudarem
  useEffect(() => {
    if (existingWhatsapp) setWhatsapp(existingWhatsapp);
    if (existingContactPerson) setContactPerson(existingContactPerson);
  }, [existingWhatsapp, existingContactPerson]);

  const loadExistingData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_contacts')
        .select('contact_person, whatsapp, email, preferred_channel, opt_in_whatsapp, opt_in_email')
        .eq('id', customerId)
        .maybeSingle();

      if (error) {
        console.warn('Erro ao carregar contato existente:', error);
        return;
      }

      if (data) {
        setContactPerson(data.contact_person || existingContactPerson || "");
        setWhatsapp(data.whatsapp || existingWhatsapp || "");
        setEmail(data.email || "");
        setPreferredChannel(data.preferred_channel || "whatsapp");
        setOptInWhatsapp(data.opt_in_whatsapp ?? true);
        setOptInEmail(data.opt_in_email ?? true);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!whatsapp && !email) {
      toast.error("Informe pelo menos um canal de contato");
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        contact_person: contactPerson || null,
        whatsapp: whatsapp || null,
        email: email || null,
        preferred_channel: preferredChannel,
        opt_in_whatsapp: optInWhatsapp,
        opt_in_email: optInEmail
      };

      // Primeiro tentar update
      const { data: updateResult, error: updateError } = await supabase
        .from('customer_contacts')
        .update(updateData)
        .eq('id', customerId)
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;

      // Se update não afetou nenhum registro, o ID não existe na tabela customer_contacts
      // Nesse caso, informar ao usuário
      if (!updateResult) {
        console.warn('Registro não encontrado para customerId:', customerId);
        toast.error("Cliente não encontrado. Verifique se o cadastro existe.");
        return;
      }

      toast.success("Contato de notificação cadastrado com sucesso!");
      
      // Notificar o componente pai sobre o salvamento
      if (onSaved) {
        onSaved({
          contact_person: contactPerson || null,
          whatsapp: whatsapp || null
        });
      }
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar contato:', error);
      toast.error("Erro ao salvar contato: " + (error.message || "Erro desconhecido"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Cadastrar Contato para Notificações
          </DialogTitle>
          <DialogDescription>
            Cadastre o WhatsApp do responsável que receberá atualizações sobre os pedidos do cliente <strong>{customerName}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Carregando dados...
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nome do Responsável
              </Label>
              <Input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Nome de quem receberá as notificações"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-600" />
                WhatsApp *
              </Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                E-mail (opcional)
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Canal Preferido</Label>
              <Select value={preferredChannel} onValueChange={setPreferredChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                      WhatsApp
                    </div>
                  </SelectItem>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-600" />
                      E-mail
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm text-muted-foreground">Consentimento (Opt-in)</Label>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Aceita receber WhatsApp</span>
                </div>
                <Switch checked={optInWhatsapp} onCheckedChange={setOptInWhatsapp} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Aceita receber E-mail</span>
                </div>
                <Switch checked={optInEmail} onCheckedChange={setOptInEmail} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip}>
            Pular por agora
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isSaving ? "Salvando..." : "Salvar Contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
