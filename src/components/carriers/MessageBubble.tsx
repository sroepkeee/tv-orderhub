import { useState } from 'react';
import { CarrierConversation, WhatsAppMedia } from '@/types/carriers';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Trash2, Bot, FileText, Download, Image as ImageIcon } from 'lucide-react';
import { formatCarrierMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AudioPlayer } from './AudioPlayer';
import { ImagePreviewModal } from './ImagePreviewModal';

interface MessageBubbleProps {
  message: CarrierConversation;
  onDelete?: (id: string) => void;
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

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function MessageBubble({ message, onDelete }: MessageBubbleProps) {
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<WhatsAppMedia | null>(null);
  
  const isOutbound = message.message_direction === 'outbound';
  const isDelivered = !!message.delivered_at;
  const isRead = !!message.read_at;

  const { formatted, isQuote } = formatCarrierMessage(message.message_content);
  const senderLabel = isOutbound ? 'Você' : (message.carrier?.name || 'Transportadora');

  // Get media from message if available
  const media = message.media?.[0] || null;
  const hasMedia = message.has_media && media;

  const handleImageClick = (mediaItem: WhatsAppMedia) => {
    setSelectedMedia(mediaItem);
    setImageModalOpen(true);
  };

  const handleDownload = (mediaItem: WhatsAppMedia) => {
    if (mediaItem.base64_data) {
      const link = document.createElement('a');
      link.href = `data:${mediaItem.mime_type || 'application/octet-stream'};base64,${mediaItem.base64_data}`;
      link.download = mediaItem.file_name || 'arquivo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getAudioSource = (mediaItem: WhatsAppMedia): string => {
    if (mediaItem.base64_data) {
      return `data:${mediaItem.mime_type || 'audio/ogg'};base64,${mediaItem.base64_data}`;
    }
    return '';
  };

  const getImageSource = (mediaItem: WhatsAppMedia): string => {
    if (mediaItem.thumbnail_base64) {
      return `data:image/jpeg;base64,${mediaItem.thumbnail_base64}`;
    }
    if (mediaItem.base64_data) {
      return `data:${mediaItem.mime_type || 'image/jpeg'};base64,${mediaItem.base64_data}`;
    }
    return '';
  };

  return (
    <>
      <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-3 group`}>
        <div
          className={`max-w-[70%] rounded-xl p-3 shadow-md relative ${
            isOutbound
              ? 'bg-[#dcf8c6] dark:bg-green-900/40 text-foreground rounded-br-none'
              : 'bg-white dark:bg-slate-800 text-foreground rounded-bl-none border border-border'
          }`}
        >
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-md hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(message.id)} 
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          <div className={`text-xs font-semibold mb-1.5 ${
            isOutbound ? 'text-green-700 dark:text-green-300' : 'text-blue-600 dark:text-blue-400'
          }`}>
            {senderLabel}
          </div>

          {/* Media Content */}
          {hasMedia && media.media_type === 'image' && (
            <div className="relative mb-2">
              <img
                src={getImageSource(media)}
                alt={media.file_name || 'Imagem'}
                className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => handleImageClick(media)}
              />
              {media.ai_analysis && (
                <Badge 
                  variant="secondary" 
                  className="absolute top-2 right-2 bg-purple-500/90 text-white text-xs"
                >
                  <Bot className="h-3 w-3 mr-1" />
                  IA
                </Badge>
              )}
              {media.caption && (
                <p className="text-sm mt-1 opacity-90">{media.caption}</p>
              )}
            </div>
          )}

          {hasMedia && media.media_type === 'audio' && (
            <div className="mb-2">
              <AudioPlayer 
                src={getAudioSource(media)} 
                duration={media.duration_seconds}
              />
            </div>
          )}

          {hasMedia && (media.media_type === 'document' || media.media_type === 'video' || media.media_type === 'sticker') && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-2">
              <div className="h-10 w-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                {media.media_type === 'document' ? (
                  <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                ) : media.media_type === 'sticker' ? (
                  <ImageIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                ) : (
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {media.file_name || 'Documento'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(media.file_size_bytes)}
                  {media.mime_type && ` • ${media.mime_type.split('/')[1]?.toUpperCase()}`}
                </p>
              </div>
              <Button 
                size="icon" 
                variant="ghost"
                onClick={() => handleDownload(media)}
                className="flex-shrink-0"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Text Content */}
          {formatted && !message.has_media && (
            isQuote ? (
              <div className="text-sm whitespace-pre-wrap break-words font-medium leading-relaxed">
                {formatText(formatted)}
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                {formatted}
              </p>
            )
          )}

          {/* Caption for media messages */}
          {message.has_media && formatted && !media?.caption && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {formatted.replace(/^\[(Imagem|Documento|Áudio|Vídeo|Sticker)\]\s*/i, '')}
            </p>
          )}
          
          <div className="flex items-center justify-end gap-1 mt-2 text-xs opacity-70">
            <span>
              {format(new Date(message.sent_at), 'HH:mm', { locale: ptBR })}
            </span>
            
            {isOutbound && (
              <span className="ml-1">
                {isRead ? (
                  <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                ) : isDelivered ? (
                  <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      <ImagePreviewModal
        open={imageModalOpen}
        onOpenChange={setImageModalOpen}
        media={selectedMedia}
      />
    </>
  );
}
