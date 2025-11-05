import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

type RealtimeStatus = 'synced' | 'updating' | 'disconnected';

interface RealtimeIndicatorProps {
  status: RealtimeStatus;
  lastUpdateTime: Date | null;
}

export const RealtimeIndicator = ({ status, lastUpdateTime }: RealtimeIndicatorProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'synced':
        return {
          icon: Wifi,
          label: 'Sincronizado',
          color: 'bg-green-500/10 text-green-600 border-green-500/20',
          iconColor: 'text-green-600'
        };
      case 'updating':
        return {
          icon: RefreshCw,
          label: 'Atualizando',
          color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
          iconColor: 'text-yellow-600 animate-spin'
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          label: 'Desconectado',
          color: 'bg-red-500/10 text-red-600 border-red-500/20',
          iconColor: 'text-red-600'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatLastUpdate = () => {
    if (!lastUpdateTime) return 'Nunca';
    
    const now = new Date();
    const diff = now.getTime() - lastUpdateTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (seconds < 10) return 'Agora mesmo';
    if (seconds < 60) return `${seconds}s atrás`;
    if (minutes < 60) return `${minutes}min atrás`;
    return lastUpdateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${config.color} flex items-center gap-1.5 px-2 py-1 cursor-help transition-all`}
          >
            <Icon className={`h-3 w-3 ${config.iconColor}`} />
            <span className="text-xs font-medium">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-medium">{config.label}</p>
          <p className="text-muted-foreground mt-0.5">
            Última atualização: {formatLastUpdate()}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
