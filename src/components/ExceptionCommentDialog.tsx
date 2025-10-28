import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MentionTextarea } from "./MentionTextarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2 } from "lucide-react";

interface ExceptionCommentDialogProps {
  open: boolean;
  onConfirm: (comment: string, responsible: string) => void;
  onCancel: () => void;
  saving?: boolean;
}

export const ExceptionCommentDialog = ({
  open,
  onConfirm,
  onCancel,
  saving = false
}: ExceptionCommentDialogProps) => {
  const [comment, setComment] = useState("");
  const [responsible, setResponsible] = useState("");

  const handleConfirm = () => {
    if (comment.trim() && responsible.trim()) {
      onConfirm(comment, responsible);
      setComment("");
      setResponsible("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" />
            Registrar Exceção no Processo
          </DialogTitle>
          <DialogDescription>
            Para marcar este pedido como "Exceção", é obrigatório registrar o que aconteceu e quem será o responsável pela validação/correção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="exception-comment" className="text-sm font-medium">
              O que aconteceu? <span className="text-red-500">*</span>
            </Label>
            <MentionTextarea
              value={comment}
              onChange={setComment}
              placeholder="Descreva o problema... Use @ para mencionar usuários responsáveis"
              className="min-h-[120px]"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Seja específico sobre o problema para facilitar o rastreamento
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsible" className="text-sm font-medium">
              Responsável pela validação/correção <span className="text-red-500">*</span>
            </Label>
            <Input
              id="responsible"
              placeholder="Nome do responsável"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Indique quem deve validar e corrigir se necessário
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!comment.trim() || !responsible.trim() || saving}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              "Confirmar Exceção"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
