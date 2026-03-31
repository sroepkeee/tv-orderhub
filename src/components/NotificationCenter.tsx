import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, CheckCheck, Trash2, Settings, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { parseMentions } from '@/lib/mentionUtils';

export const NotificationCenter = () => {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    isRetrying,
    retryCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestNotificationPermission,
    refreshNotifications
  } = useNotifications();
  
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = async (notification: any) => {
    await markAsRead(notification.id);
    setOpen(false);
    navigate('/');
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('openOrder', {
          detail: { 
            orderId: notification.order_id,
            commentId: notification.comment_id
          }
        })
      );
    }, 100);
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    toast({
      title: granted ? 'Notificações ativadas!' : 'Permissão negada',
      description: granted 
        ? 'Você receberá notificações quando for mencionado.'
        : 'Ative as notificações nas configurações do navegador.',
      variant: granted ? 'default' : 'destructive',
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-[420px] p-0" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="p-3 border-b flex items-center justify-between sticky top-0 bg-popover z-10">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notificações</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs h-7 px-2"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Marcar todas
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRequestPermission}
              title="Ativar notificações desktop"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Lista de notificações com scroll fixo */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 52px)' }}>
          {loading ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <p className="text-sm text-muted-foreground">
                  {isRetrying ? `Reconectando... (tentativa ${retryCount}/3)` : 'Carregando...'}
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 text-destructive" />
              <p className="text-sm font-medium mb-1">Erro ao carregar</p>
              <p className="text-xs text-muted-foreground mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={refreshNotifications}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Tentar novamente
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'px-3 py-3 hover:bg-accent cursor-pointer transition-colors border-b last:border-b-0',
                    !notification.is_read && 'bg-primary/5'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-2">
                    {/* Indicador de não lida */}
                    <div className="pt-1.5 shrink-0">
                      <div className={cn(
                        'h-2 w-2 rounded-full',
                        !notification.is_read ? 'bg-primary' : 'bg-transparent'
                      )} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm font-medium truncate">
                          {notification.title}
                        </span>
                        {notification.type === 'mention' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-primary/30 text-primary">
                            Menção
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                        {parseMentions(notification.message)}
                      </p>
                      
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="truncate max-w-[120px]">
                          {notification.metadata?.author_name || 'Usuário'}
                        </span>
                        <span>•</span>
                        <span>#{notification.metadata?.order_number?.slice(0, 8)}</span>
                        <span>•</span>
                        <span className="shrink-0">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </span>
                      </div>
                    </div>
                    
                    {/* Ações sempre visíveis */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          title="Confirmar leitura"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
