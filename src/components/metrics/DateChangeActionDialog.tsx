import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DateChangeActionDialogProps {
  change: any;
  actionType: 'followup' | 'stalling' | 'note';
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DateChangeActionDialog({
  change,
  actionType,
  open,
  onClose,
  onSuccess,
}: DateChangeActionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [contactMethod, setContactMethod] = useState("phone");
  const [response, setResponse] = useState("");
  const [justification, setJustification] = useState("");
  const [action, setAction] = useState("escalated");
  const [notes, setNotes] = useState(change.notes || "");
  const [weeklyFollowup, setWeeklyFollowup] = useState(false);

  const handleFollowup = async () => {
    if (!response.trim()) {
      toast.error("Por favor, descreva a resposta recebida");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("delivery_date_changes")
        .update({
          factory_contacted_at: new Date().toISOString(),
          factory_response: `[${contactMethod.toUpperCase()}] ${response}`,
          notes: weeklyFollowup 
            ? `${notes}\n\n[Acompanhamento semanal ativado]` 
            : notes
        })
        .eq("id", change.id);

      if (error) throw error;

      toast.success("Cobrança registrada com sucesso!");
      onSuccess();
    } catch (error) {
      console.error("Error updating followup:", error);
      toast.error("Erro ao registrar cobrança");
    } finally {
      setLoading(false);
    }
  };

  const handleStalling = async () => {
    if (!justification.trim()) {
      toast.error("Por favor, justifique a classificação como enrolação");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("delivery_date_changes")
        .update({
          marked_as_stalling: true,
          notes: `${notes}\n\n[ENROLAÇÃO] ${justification}\nAção tomada: ${action}`
        })
        .eq("id", change.id);

      if (error) throw error;

      toast.success("Mudança marcada como enrolação");
      onSuccess();
    } catch (error) {
      console.error("Error marking as stalling:", error);
      toast.error("Erro ao marcar como enrolação");
    } finally {
      setLoading(false);
    }
  };

  const handleNote = async () => {
    if (!notes.trim()) {
      toast.error("Por favor, adicione uma nota");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("delivery_date_changes")
        .update({ notes })
        .eq("id", change.id);

      if (error) throw error;

      toast.success("Nota adicionada com sucesso!");
      onSuccess();
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Erro ao adicionar nota");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (actionType === 'followup') handleFollowup();
    else if (actionType === 'stalling') handleStalling();
    else handleNote();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {actionType === 'followup' && '📞 Cobrar Prazo da Fábrica'}
            {actionType === 'stalling' && '🚩 Marcar como Enrolação'}
            {actionType === 'note' && '💬 Adicionar Nota'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info do pedido */}
          <div className="bg-muted p-3 rounded-md text-sm">
            <div><strong>Pedido:</strong> {change.order_number}</div>
            <div><strong>Cliente:</strong> {change.customer_name}</div>
            <div><strong>Atraso:</strong> +{change.days_delayed} dias</div>
          </div>

          {actionType === 'followup' && (
            <>
              <div>
                <Label>Meio de contato utilizado</Label>
                <select
                  value={contactMethod}
                  onChange={(e) => setContactMethod(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                >
                  <option value="phone">Telefone</option>
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="system">Sistema</option>
                </select>
              </div>

              <div>
                <Label>Resposta da fábrica</Label>
                <Textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Descreva a resposta recebida..."
                  className="mt-1"
                  rows={4}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="weekly"
                  checked={weeklyFollowup}
                  onCheckedChange={(checked) => setWeeklyFollowup(checked as boolean)}
                />
                <Label htmlFor="weekly" className="text-sm font-normal">
                  Marcar para acompanhamento semanal
                </Label>
              </div>
            </>
          )}

          {actionType === 'stalling' && (
            <>
              <Alert variant="default" className="bg-destructive/10 border-destructive/20">
                <p className="text-sm">
                  Esta mudança será marcada como "enrolação" para rastreamento futuro.
                </p>
              </Alert>

              <div>
                <Label>Justificativa</Label>
                <Textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Por que considerar isso uma enrolação?"
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label>Ação tomada</Label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                >
                  <option value="escalated">Escalado para gerência</option>
                  <option value="supplier_change">Mudança de fornecedor solicitada</option>
                  <option value="client_notified">Cliente notificado</option>
                  <option value="documented">Apenas documentado</option>
                </select>
              </div>
            </>
          )}

          {actionType === 'note' && (
            <div>
              <Label>Observações sobre esta mudança</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexto adicional, decisões tomadas, etc."
                className="mt-1"
                rows={5}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
