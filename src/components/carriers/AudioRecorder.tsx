import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Send, X } from 'lucide-react';

interface AudioRecorderProps {
  onRecorded: (blob: Blob, durationSeconds: number) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function AudioRecorder({ onRecorded, onCancel, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecorded(audioBlob, duration);
      setAudioBlob(null);
      setDuration(0);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    setAudioBlob(null);
    setDuration(0);
    onCancel();
  };

  // If not recording and no audio recorded, show just the mic button
  if (!isRecording && !audioBlob) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={startRecording}
        disabled={disabled}
        className="flex-shrink-0"
        title="Gravar áudio"
      >
        <Mic className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-1 bg-muted/50 rounded-lg px-3 py-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCancel}
        className="h-8 w-8 text-destructive hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>

      {isRecording && (
        <>
          <span className="animate-pulse text-destructive text-lg">●</span>
          <span className="text-sm font-medium flex-1">
            Gravando... {formatDuration(duration)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={stopRecording}
            className="h-8 w-8"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        </>
      )}

      {!isRecording && audioBlob && (
        <>
          <span className="text-sm flex-1">
            Áudio gravado ({formatDuration(duration)})
          </span>
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            className="h-8 w-8"
          >
            <Send className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
