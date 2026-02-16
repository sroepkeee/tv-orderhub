import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Mail, MessageCircle, Loader2, Copy, Check, ExternalLink, Share2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [role, setRole] = useState("member");
  const [sendViaEmail, setSendViaEmail] = useState(true);
  const [sendViaWhatsApp, setSendViaWhatsApp] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState("");
  const [invitedName, setInvitedName] = useState("");

  const resetForm = () => {
    setEmail("");
    setName("");
    setWhatsapp("");
    setRole("member");
    setSendViaEmail(true);
    setSendViaWhatsApp(false);
    setInviteUrl(null);
    setCopied(false);
    setInvitedEmail("");
    setInvitedName("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Email é obrigatório");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const response = await supabase.functions.invoke('send-organization-invite', {
        body: {
          email,
          name: name || undefined,
          whatsapp: whatsapp || undefined,
          role,
          sendViaEmail,
          sendViaWhatsApp: sendViaWhatsApp && !!whatsapp,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao enviar convite');
      }

      const data = response.data;
      
      if (data.error) {
        throw new Error(data.error);
      }

      setInviteUrl(data.invite.invite_url);
      setInvitedEmail(email);
      setInvitedName(name);
      
      // Check delivery status
      const delivery = data.delivery;
      if (delivery?.email_sent) {
        toast.success(`Convite enviado por email para ${email}`);
      } else if (sendViaEmail && delivery?.email_error) {
        toast.warning(`Convite criado, mas email falhou. Compartilhe o link abaixo.`, {
          description: 'Verifique a configuração do Resend (domínio verificado)',
          duration: 8000,
        });
        console.warn('Email delivery error:', delivery.email_error);
      }
      
      if (delivery?.whatsapp_sent) {
        toast.success('Convite enviado via WhatsApp');
      } else if (sendViaWhatsApp && whatsapp && delivery?.whatsapp_error) {
        toast.warning('WhatsApp falhou. Compartilhe o link abaixo.');
      }
      
      if (!delivery?.email_sent && !delivery?.whatsapp_sent) {
        toast.success("Convite criado! Compartilhe o link com o usuário.");
      }

      onSuccess?.();
    } catch (error: any) {
      console.error('Error sending invite:', error);
      toast.error(error.message || "Erro ao enviar convite");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (inviteUrl) {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareViaWhatsApp = () => {
    if (inviteUrl) {
      const message = `Olá${invitedName ? ` ${invitedName}` : ''}! 👋\n\nVocê foi convidado para participar do V.I.V.O.\n\nClique no link abaixo para criar sua conta:\n${inviteUrl}\n\n_Válido por 7 dias._`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  const openInviteLink = () => {
    if (inviteUrl) {
      window.open(inviteUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Convidar Usuário
          </DialogTitle>
          <DialogDescription>
            Envie um convite para adicionar novos membros à organização
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium text-primary mb-1">✅ Convite criado com sucesso!</p>
              <p className="text-xs text-muted-foreground">
                Convite para <strong>{invitedEmail}</strong>
              </p>
            </div>

            {/* Link do convite */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Link de acesso:</Label>
              <div className="flex gap-2">
                <Input 
                  value={inviteUrl} 
                  readOnly 
                  className="text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                  title="Copiar link"
                >
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Botões de compartilhamento */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Share2 className="h-3.5 w-3.5" />
                Compartilhar convite:
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={shareViaWhatsApp}
                >
                  <MessageCircle className="h-4 w-4 text-primary" />
                  Enviar via WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={openInviteLink}
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir Link
                </Button>
              </div>
            </div>

            <Separator />

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => { resetForm(); }}>
                Novo Convite
              </Button>
              <Button onClick={handleClose}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nome (opcional)</Label>
              <Input
                id="invite-name"
                placeholder="Nome do usuário"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="usuario@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-whatsapp">WhatsApp (opcional)</Label>
              <Input
                id="invite-whatsapp"
                type="tel"
                placeholder="5551999999999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Formato: código do país + DDD + número
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Nível de Acesso</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro - Acesso padrão</SelectItem>
                  <SelectItem value="viewer">Visualizador - Apenas leitura</SelectItem>
                  <SelectItem value="admin">Admin - Acesso administrativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium">Enviar convite via:</Label>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-email"
                  checked={sendViaEmail}
                  onCheckedChange={(checked) => setSendViaEmail(checked as boolean)}
                />
                <label
                  htmlFor="send-email"
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-whatsapp"
                  checked={sendViaWhatsApp}
                  onCheckedChange={(checked) => setSendViaWhatsApp(checked as boolean)}
                  disabled={!whatsapp}
                />
                <label
                  htmlFor="send-whatsapp"
                  className={`flex items-center gap-2 text-sm cursor-pointer ${!whatsapp ? 'opacity-50' : ''}`}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                  {!whatsapp && <span className="text-xs text-muted-foreground">(preencha o número)</span>}
                </label>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Enviar Convite
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}