import React from 'react';

// Parser de menções para exibição
export const parseMentions = (text: string): React.ReactNode[] => {
  const mentionPattern = /@\[([^\]]+)\]\(([a-f0-9-]{36})\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    // Texto antes da menção
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Menção com badge
    parts.push(
      <span
        key={`mention-${match.index}`}
        className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
        onClick={() => {
          // Opcional: abrir perfil do usuário
          console.log('Clicked user:', match[2]);
        }}
      >
        @{match[1]}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Texto após última menção
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};
