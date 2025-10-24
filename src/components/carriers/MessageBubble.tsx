import { CarrierConversation } from '@/types/carriers';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck } from 'lucide-react';
import { formatCarrierMessage } from '@/lib/utils';

interface MessageBubbleProps {
  message: CarrierConversation;
}

// Função helper para processar formatação de texto
const formatText = (text: string) => {
  return text.split('\n').map((line, idx) => {
    // Detectar linhas divisórias
    if (line.includes('━━━')) {
      return <div key={idx} className="border-t border-current opacity-30 my-2" />;
    }
    
    // Processar negrito (*texto*)
    const parts = line.split(/(\*[^*]+\*)/g);
    const processedLine = parts.map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return <strong key={i}>{part.slice(1, -1)}</strong>;
      }
      return part;
    });
    
    // Aplicar indentação para linhas que começam com espaços
    const indent = line.match(/^(\s+)/)?.[1]?.length || 0;
    const paddingLeft = indent > 0 ? `${indent * 0.5}rem` : '0';
    
    return (
      <div key={idx} style={{ paddingLeft }} className={indent > 0 ? 'text-xs opacity-90' : ''}>
        {processedLine}
      </div>
    );
  });
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.message_direction === 'outbound';
  const isDelivered = !!message.delivered_at;
  const isRead = !!message.read_at;

  const { formatted, isQuote } = formatCarrierMessage(message.message_content);

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[70%] rounded-lg p-3 ${
          isOutbound
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {isQuote ? (
          <div className="text-sm whitespace-pre-wrap break-words font-medium">
            {formatText(formatted)}
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">
            {formatted}
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
