import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Circle, CheckCircle2, AlertCircle, Clock, User } from 'lucide-react';
import { useReturnAuditLog } from '@/hooks/useReturnProcesses';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReturnProcessTimelineProps {
  processId: string;
}

const ACTION_LABELS: Record<string, string> = {
  process_created: 'Processo criado',
  status_changed: 'Status alterado',
  checklist_item_updated: 'Item do checklist atualizado',
  access_blocked: 'Acesso bloqueado',
  divergence_created: 'Divergência registrada',
  divergence_resolved: 'Divergência resolvida',
  shipping_created: 'Envio criado',
  shipping_updated: 'Envio atualizado',
  signature_added: 'Assinatura adicionada',
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  process_created: Circle,
  status_changed: CheckCircle2,
  divergence_created: AlertCircle,
  access_blocked: CheckCircle2,
};

export function ReturnProcessTimeline({ processId }: ReturnProcessTimelineProps) {
  const { logs, loading } = useReturnAuditLog(processId);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico do Processo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Nenhum registro encontrado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Histórico do Processo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          {/* Events */}
          <div className="space-y-6">
            {logs.map((log, index) => {
              const Icon = ACTION_ICONS[log.action] || Circle;
              const isFirst = index === 0;

              return (
                <div key={log.id} className="relative flex gap-4 pl-10">
                  {/* Icon */}
                  <div className={`absolute left-0 p-1.5 rounded-full bg-background border-2 ${
                    isFirst ? 'border-primary' : 'border-muted'
                  }`}>
                    <Icon className={`h-4 w-4 ${isFirst ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {ACTION_LABELS[log.action] || log.action}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>
                    </div>

                    {/* Details */}
                    {log.new_value && typeof log.new_value === 'object' && (
                      <div className="text-sm text-muted-foreground">
                        {log.action === 'status_changed' && (log.new_value as Record<string, unknown>).status && (
                          <span>
                            Novo status: <Badge variant="secondary">{String((log.new_value as Record<string, unknown>).status)}</Badge>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Timestamp */}
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
