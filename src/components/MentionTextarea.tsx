import React, { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useMentionUsers } from '@/hooks/useMentionUsers';
import { useImageUpload } from '@/hooks/useImageUpload';
import { cn } from '@/lib/utils';
import { ImagePlus, Loader2 } from 'lucide-react';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  orderId?: string;
  commentId?: string;
  onImageUploadStart?: () => void;
  onImageUploadEnd?: () => void;
}

export const MentionTextarea = ({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  orderId,
  commentId,
  onImageUploadStart,
  onImageUploadEnd
}: MentionTextareaProps) => {
  const { users, searchUsers } = useMentionUsers();
  const { uploadImage, uploading } = useImageUpload();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState(users);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detectar @ e buscar usuários
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);
    setCursorPosition(cursorPos);

    // Verificar se há @ antes do cursor
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      
      // Verificar se não há espaço após @
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setSuggestions(searchUsers(textAfterAt));
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }
    
    setShowSuggestions(false);
  };

  // Inserir menção
  const insertMention = (user: { id: string; full_name: string }) => {
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    // Formato: @[Nome](user-id)
    const mentionText = `@[${user.full_name}](${user.id}) `;
    const newValue = 
      textBeforeCursor.substring(0, lastAtSymbol) + 
      mentionText + 
      textAfterCursor;
    
    onChange(newValue);
    setShowSuggestions(false);
    
    // Refocar textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = lastAtSymbol + mentionText.length;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handler para Paste (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // Procurar por imagens no clipboard
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.startsWith('image/')) {
        e.preventDefault(); // Prevenir paste padrão
        
        const file = item.getAsFile();
        if (!file) continue;

        // Notificar início do upload
        onImageUploadStart?.();

        // Fazer upload
        const imageUrl = await uploadImage({
          orderId,
          commentId,
          file
        });

        // Notificar fim do upload
        onImageUploadEnd?.();

        if (imageUrl) {
          // Inserir markdown da imagem na posição do cursor
          const textarea = textareaRef.current;
          if (!textarea) return;

          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const textBefore = value.substring(0, start);
          const textAfter = value.substring(end);
          
          const imageName = file.name.split('.')[0] || 'Imagem';
          const imageMarkdown = `\n![${imageName}](${imageUrl})\n`;
          const newValue = textBefore + imageMarkdown + textAfter;
          
          onChange(newValue);
          
          // Reposicionar cursor após a imagem
          setTimeout(() => {
            const newCursorPos = start + imageMarkdown.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
          }, 0);
        }
        
        break; // Apenas primeira imagem
      }
    }
  };

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      insertMention(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled || uploading}
        className={className}
      />
      
      {/* Dica visual */}
      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground flex items-center gap-1 pointer-events-none">
        <ImagePlus className="h-3 w-3" />
        <span>Ctrl+V para colar imagem</span>
      </div>

      {/* Indicador de upload */}
      {uploading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-md">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Anexando imagem...</span>
          </div>
        </div>
      )}
      
      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute top-full mt-2 w-full max-h-60 overflow-y-auto z-50 shadow-lg">
          <div className="p-2 space-y-1">
            {suggestions.map((user, index) => (
              <div
                key={user.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                  index === selectedIndex 
                    ? "bg-accent" 
                    : "hover:bg-accent/50"
                )}
                onClick={() => insertMention(user)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {user.full_name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {user.full_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                </div>
                {user.department && (
                  <Badge variant="outline" className="text-xs">
                    {user.department}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
