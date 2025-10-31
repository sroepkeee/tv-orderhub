import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MentionTextarea } from './MentionTextarea';
import { parseMentionsToReact } from '@/lib/mentionUtils';
import { renderCommentWithImages } from '@/lib/markdownRenderer';
import { MessageSquare, Send, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface OrderCommentsProps {
  orderId: string;
}

interface CommentProfile {
  full_name: string;
  email: string;
}

interface MentionTag {
  mentioned_user_id: string;
  profiles?: {
    full_name: string;
  };
}

interface Comment {
  id: string;
  order_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  profiles?: CommentProfile;
  mention_tags?: MentionTag[];
  isOptimistic?: boolean;
}

export const OrderComments = ({ orderId }: OrderCommentsProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadComments();
    
    // Real-time subscription
    const channel = supabase
      .channel('order-comments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_comments',
          filter: `order_id=eq.${orderId}`
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const loadComments = async () => {
    try {
      setError(null);
      
      // 1. Buscar comentários
      const { data: commentsData, error: commentsError } = await supabase
        .from('order_comments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;
      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        setLoading(false);
        return;
      }

      // 2. Buscar perfis dos autores
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(
        profilesData?.map(p => [p.id, p]) || []
      );

      // 3. Buscar mention_tags
      const commentIds = commentsData.map(c => c.id);
      const { data: mentionsData, error: mentionsError } = await supabase
        .from('mention_tags')
        .select('comment_id, mentioned_user_id')
        .in('comment_id', commentIds);

      if (mentionsError) throw mentionsError;

      // 4. Buscar perfis dos mencionados
      const mentionedUserIds = [...new Set(mentionsData?.map(m => m.mentioned_user_id) || [])];
      let mentionedProfilesMap = new Map();
      
      if (mentionedUserIds.length > 0) {
        const { data: mentionedProfilesData, error: mentionedProfilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', mentionedUserIds);

        if (mentionedProfilesError) throw mentionedProfilesError;

        mentionedProfilesMap = new Map(
          mentionedProfilesData?.map(p => [p.id, p]) || []
        );
      }

      // 5. Combinar tudo
      const enrichedComments: Comment[] = commentsData.map(comment => ({
        ...comment,
        profiles: profilesMap.get(comment.user_id),
        mention_tags: mentionsData
          ?.filter(m => m.comment_id === comment.id)
          .map(m => ({
            mentioned_user_id: m.mentioned_user_id,
            profiles: mentionedProfilesMap.get(m.mentioned_user_id)
          })) || []
      }));

      setComments(enrichedComments);
    } catch (err) {
      console.error('Erro ao carregar comentários:', err);
      setError('Não foi possível carregar os comentários');
      toast({
        title: 'Erro ao carregar comentários',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;

    // UI Otimista - adicionar comentário temporário
    const optimisticComment: Comment = {
      id: `temp-${Date.now()}`,
      order_id: orderId,
      user_id: user.id,
      comment: newComment,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: {
        full_name: user.user_metadata?.full_name || user.email || 'Você',
        email: user.email || ''
      },
      mention_tags: [],
      isOptimistic: true
    };

    setComments(prev => [optimisticComment, ...prev]);
    const commentText = newComment;
    setNewComment('');
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('order_comments')
        .insert({
          order_id: orderId,
          user_id: user.id,
          comment: commentText
        });

      if (error) throw error;

      toast({
        title: 'Comentário adicionado!',
        description: 'Usuários mencionados foram notificados.',
      });

      // Recarregar para obter as mention_tags criadas pelo trigger
      await loadComments();
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      
      // Remover comentário otimista em caso de erro
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      setNewComment(commentText);
      
      toast({
        title: 'Erro ao adicionar comentário',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
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
            placeholder="Adicione um comentário... Use @ para mencionar usuários ou cole imagens com Ctrl+V"
            className="min-h-[100px]"
            disabled={submitting}
            orderId={orderId}
            onImageUploadStart={() => setSubmitting(true)}
            onImageUploadEnd={() => setSubmitting(false)}
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim() || submitting}
              size="sm"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? 'Enviando...' : 'Enviar comentário'}
            </Button>
          </div>
        </div>

        {/* Lista de comentários */}
        <div className="space-y-4">
          {loading ? (
            // Skeleton loader
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 pb-4 border-b">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            // Estado de erro
            <div className="text-center text-muted-foreground py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive opacity-50" />
              <p className="font-medium">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadComments}
                className="mt-3"
              >
                Tentar novamente
              </Button>
            </div>
          ) : comments.length === 0 ? (
            // Sem comentários
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum comentário ainda</p>
              <p className="text-xs mt-1">Seja o primeiro a comentar!</p>
            </div>
          ) : (
            // Lista de comentários
            comments.map((comment) => (
              <div 
                key={comment.id} 
                className={`flex gap-3 pb-4 border-b last:border-0 ${
                  comment.isOptimistic ? 'opacity-60' : ''
                }`}
              >
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
                    {comment.isOptimistic && (
                      <span className="text-xs text-muted-foreground italic">
                        (enviando...)
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm">
                    {renderCommentWithImages(comment.comment).map((element, idx) => {
                      if (typeof element === 'object' && element && 'props' in element && typeof element.props?.children === 'string') {
                        return <React.Fragment key={idx}>{parseMentionsToReact(element.props.children)}</React.Fragment>;
                      }
                      return <React.Fragment key={idx}>{element}</React.Fragment>;
                    })}
                  </div>
                  
                  {comment.mention_tags && comment.mention_tags.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <span>Mencionou:</span>
                      {comment.mention_tags.map((tag, idx) => (
                        <span key={idx} className="font-medium">
                          {tag.profiles?.full_name}
                          {idx < comment.mention_tags!.length - 1 && ', '}
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
