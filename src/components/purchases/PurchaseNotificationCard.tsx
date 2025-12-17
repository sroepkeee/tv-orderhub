import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, RefreshCw, CheckCircle2, Clock, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PurchaseNotificationCardProps {
  notificationSentAt?: string;
  notificationRecipients?: string[];
  notificationCount?: number;
  onSendNotification: () => void;
  onResendNotification: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function PurchaseNotificationCard({
  notificationSentAt,
  notificationRecipients = [],
  notificationCount = 0,
  onSendNotification,
  onResendNotification,
  isLoading = false,
  disabled = false,
  disabledReason
}: PurchaseNotificationCardProps) {
  const hasBeenSent = !!notificationSentAt;

  return (
    <Card className={`border-2 ${hasBeenSent ? 'border-green-500/30 bg-green-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          📧 Status da Notificação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasBeenSent ? (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-medium text-green-700 dark:text-green-400">
                Enviado em {format(new Date(notificationSentAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Destinatários:</p>
              <div className="flex flex-wrap gap-1">
                {notificationRecipients.map((recipient, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {recipient}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                Total de envios: <strong>{notificationCount}</strong>
              </span>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onResendNotification}
                      disabled={isLoading || disabled}
                      className="gap-2"
                    >
                      {isLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Reenviar
                    </Button>
                  </TooltipTrigger>
                  {disabled && disabledReason && (
                    <TooltipContent>
                      <p>{disabledReason}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="font-medium text-orange-700 dark:text-orange-400">
                Notificação ainda não enviada
              </span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Ao enviar para aprovação, um e-mail será enviado automaticamente para as equipes de Compras e SSM.
            </p>

            <div className="pt-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onSendNotification}
                      disabled={isLoading || disabled}
                      className="w-full gap-2 bg-orange-500 hover:bg-orange-600"
                    >
                      {isLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Enviar Notificação Agora
                    </Button>
                  </TooltipTrigger>
                  {disabled && disabledReason && (
                    <TooltipContent>
                      <p>{disabledReason}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
