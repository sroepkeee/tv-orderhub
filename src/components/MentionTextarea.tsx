import React, { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useMentionUsers } from '@/hooks/useMentionUsers';
import { cn } from '@/lib/utils';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const MentionTextarea = ({
  value,
  onChange,
  placeholder,
  disabled,
  className
}: MentionTextareaProps) => {
  const { users, searchUsers } = useMentionUsers();
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
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute bottom-full mb-2 w-full max-h-60 overflow-y-auto z-50 shadow-lg">
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
