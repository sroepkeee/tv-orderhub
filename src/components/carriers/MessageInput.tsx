import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Smile } from 'lucide-react';
import { MediaAttachmentPicker } from './MediaAttachmentPicker';
import { AudioRecorder } from './AudioRecorder';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  onSendMedia?: (mediaType: 'image' | 'document' | 'audio', base64: string, fileName?: string, mimeType?: string) => Promise<void>;
  carrierId?: string;
  disabled?: boolean;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:xxx;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
};

export function MessageInput({ onSendMessage, onSendMedia, carrierId, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const { toast } = useToast();

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelected = async (file: File, type: 'image' | 'document') => {
    if (!onSendMedia) {
      toast({
        title: 'Erro',
        description: 'Envio de mídia não disponível',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingMedia(true);
    try {
      const base64 = await fileToBase64(file);
      await onSendMedia(type, base64, file.name, file.type);
      toast({
        title: 'Mídia enviada',
        description: `${type === 'image' ? 'Imagem' : 'Documento'} enviado com sucesso`,
      });
    } catch (error: unknown) {
      console.error('Error sending media:', error);
      toast({
        title: 'Erro ao enviar mídia',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsSendingMedia(false);
    }
  };

  const handleAudioRecorded = async (blob: Blob, durationSeconds: number) => {
    if (!onSendMedia) {
      toast({
        title: 'Erro',
        description: 'Envio de áudio não disponível',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingMedia(true);
    try {
      const base64 = await blobToBase64(blob);
      await onSendMedia('audio', base64, `audio_${Date.now()}.webm`, blob.type);
      toast({
        title: 'Áudio enviado',
        description: `Áudio de ${durationSeconds}s enviado com sucesso`,
      });
    } catch (error: unknown) {
      console.error('Error sending audio:', error);
      toast({
        title: 'Erro ao enviar áudio',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsSendingMedia(false);
      setIsRecording(false);
    }
  };

  const handleAudioCancel = () => {
    setIsRecording(false);
  };

  // Show audio recorder when recording
  if (isRecording) {
    return (
      <div className="border-t bg-background p-4">
        <AudioRecorder
          onRecorded={handleAudioRecorded}
          onCancel={handleAudioCancel}
          disabled={disabled || isSendingMedia}
        />
      </div>
    );
  }

  return (
    <div className="border-t bg-background p-4">
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || isSendingMedia}
          className="flex-shrink-0"
        >
          <Smile className="h-5 w-5" />
        </Button>

        <MediaAttachmentPicker
          onFileSelected={handleFileSelected}
          disabled={disabled || isSendingMedia}
        />

        <Textarea
          placeholder="Digite sua mensagem..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={disabled || isSendingMedia}
          className="min-h-[44px] max-h-32 resize-none"
          rows={1}
        />

        {message.trim() ? (
          <Button
            onClick={handleSend}
            disabled={!message.trim() || disabled || isSendingMedia}
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <AudioRecorder
            onRecorded={handleAudioRecorded}
            onCancel={handleAudioCancel}
            disabled={disabled || isSendingMedia}
          />
        )}
      </div>
    </div>
  );
}
