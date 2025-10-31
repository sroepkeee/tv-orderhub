import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface UploadImageOptions {
  orderId?: string;
  commentId?: string;
  file: File;
}

export const useImageUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const uploadImage = async ({ orderId, commentId, file }: UploadImageOptions): Promise<string | null> => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar autenticado',
        variant: 'destructive'
      });
      return null;
    }

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Apenas imagens podem ser coladas',
        variant: 'destructive'
      });
      return null;
    }

    // Validar tamanho (max 5MB para imagens coladas)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: 'Erro',
        description: 'Imagem muito grande. Tamanho máximo: 5MB',
        variant: 'destructive'
      });
      return null;
    }

    setUploading(true);

    try {
      // Gerar nome único para o arquivo
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 9);
      const extension = file.name.split('.').pop() || 'png';
      const fileName = `comment-image-${timestamp}-${randomStr}.${extension}`;
      const filePath = `${user.id}/${fileName}`;

      // 1. Upload para Storage
      const { error: uploadError } = await supabase.storage
        .from('order-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 2. Obter URL pública
      const { data: publicUrlData } = supabase.storage
        .from('order-attachments')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // 3. Salvar metadados na tabela order_attachments
      const { error: dbError } = await supabase
        .from('order_attachments')
        .insert({
          order_id: orderId || null,
          comment_id: commentId || null,
          file_name: file.name || fileName,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id
        });

      if (dbError) throw dbError;

      toast({
        title: '✅ Imagem anexada',
        description: 'A imagem foi adicionada ao comentário',
        duration: 2000
      });

      return publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro ao anexar imagem',
        description: 'Tente novamente',
        variant: 'destructive'
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadImage, uploading };
};
