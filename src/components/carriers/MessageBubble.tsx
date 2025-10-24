import { CarrierConversation } from '@/types/carriers';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  message: CarrierConversation;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.message_direction === 'outbound';
  const isDelivered = !!message.delivered_at;
  const isRead = !!message.read_at;

  // Tentar detectar e formatar JSON
  const formatContent = (content: string) => {
    try {
      // Tentar parsear como JSON
      const parsed = JSON.parse(content);
      return {
        isJson: true,
        content: JSON.stringify(parsed, null, 2)
      };
    } catch {
      // Se não for JSON, retornar como texto normal
      return {
        isJson: false,
        content
      };
    }
  };

  const { isJson, content } = formatContent(message.message_content);

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[70%] rounded-lg p-3 ${
          isOutbound
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {isJson ? (
          <pre className="text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto">
            <code>{content}</code>
          </pre>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">
            {content}
          </p>
        )}
        
        <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
          isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground'
        }`}>
          <span>
            {format(new Date(message.sent_at), 'HH:mm', { locale: ptBR })}
          </span>
          
          {isOutbound && (
            <span className="ml-1">
              {isRead ? (
                <CheckCheck className="h-3 w-3 text-blue-400" />
              ) : isDelivered ? (
                <CheckCheck className="h-3 w-3" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
