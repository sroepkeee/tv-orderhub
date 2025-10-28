import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MentionTextarea } from './MentionTextarea';
import { parseMentions } from '@/lib/mentionUtils';
import { MessageSquare, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface OrderCommentsProps {
  orderId: string;
}

export const OrderComments = ({ orderId }: OrderCommentsProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadComments();
  }, [orderId]);

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('order_comments')
      .select(`
        *,
        profiles!order_comments_user_id_fkey(full_name, email),
        mention_tags(
          mentioned_user_id,
          profiles!mention_tags_mentioned_user_id_fkey(full_name)
        )
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setComments(data);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('order_comments')
        .insert({
          order_id: orderId,
          user_id: user.id,
          comment: newComment
        });

      if (error) throw error;

      toast({
        title: 'Comentário adicionado!',
        description: 'Usuários mencionados foram notificados.',
      });

      setNewComment('');
      loadComments();
    } catch (error) {
      toast({
        title: 'Erro ao adicionar comentário',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comentários e Menções
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Novo comentário */}
        <div className="space-y-2">
          <MentionTextarea
            value={newComment}
            onChange={setNewComment}
            placeholder="Adicione um comentário... Use @ para mencionar usuários"
            className="min-h-[100px]"
            disabled={loading}
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim() || loading}
              size="sm"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar comentário
            </Button>
          </div>
        </div>

        {/* Lista de comentários */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum comentário ainda</p>
              <p className="text-xs mt-1">Seja o primeiro a comentar!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 pb-4 border-b last:border-0">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {comment.profiles?.full_name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {comment.profiles?.full_name || 'Usuário'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR
                      })}
                    </span>
                  </div>
                  
                  <div className="text-sm whitespace-pre-wrap">
                    {parseMentions(comment.comment)}
                  </div>
                  
                  {comment.mention_tags && comment.mention_tags.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <span>Mencionou:</span>
                      {comment.mention_tags.map((tag: any, idx: number) => (
                        <span key={idx} className="font-medium">
                          {tag.profiles?.full_name}
                          {idx < comment.mention_tags.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
