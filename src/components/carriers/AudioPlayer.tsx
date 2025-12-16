import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

interface AudioPlayerProps {
  src: string;
  duration?: number;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function AudioPlayer({ src, duration: initialDuration }: AudioPlayerProps) {
  const { isPlaying, currentTime, duration, progress, toggle, seek, setAudioSource } = useAudioPlayer();

  useEffect(() => {
    if (src) {
      setAudioSource(src);
    }
  }, [src, setAudioSource]);

  const displayDuration = duration || initialDuration || 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * displayDuration;
    seek(newTime);
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg min-w-[200px]">
      <Button 
        size="icon" 
        variant="ghost" 
        className="h-8 w-8 flex-shrink-0"
        onClick={toggle}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      
      <div 
        className="flex-1 h-2 bg-muted rounded-full cursor-pointer relative overflow-hidden"
        onClick={handleProgressClick}
      >
        <div 
          className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <span className="text-xs text-muted-foreground flex-shrink-0 min-w-[36px] text-right">
        {formatTime(isPlaying ? currentTime : displayDuration)}
      </span>
    </div>
  );
}
