import React from 'react';

interface MarkdownImageProps {
  src: string;
  alt: string;
}

const MarkdownImage: React.FC<MarkdownImageProps> = ({ src, alt }) => (
  <img 
    src={src} 
    alt={alt}
    className="max-w-full max-h-96 rounded-lg border my-2 cursor-pointer hover:opacity-90 transition-opacity"
    onClick={() => window.open(src, '_blank')}
    loading="lazy"
  />
);

export const renderCommentWithImages = (text: string): React.ReactNode[] => {
  const elements: React.ReactNode[] = [];
  
  // Regex para markdown de imagens: ![alt](url)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = imageRegex.exec(text)) !== null) {
    // Texto antes da imagem
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index);
      elements.push(
        <span key={`text-${key}`} className="whitespace-pre-wrap">
          {textBefore}
        </span>
      );
      key++;
    }

    // Renderizar imagem
    const alt = match[1] || 'Imagem';
    const src = match[2];
    elements.push(<MarkdownImage key={`img-${key}`} src={src} alt={alt} />);
    key++;

    lastIndex = match.index + match[0].length;
  }

  // Texto restante após última imagem
  if (lastIndex < text.length) {
    elements.push(
      <span key={`text-${key}`} className="whitespace-pre-wrap">
        {text.substring(lastIndex)}
      </span>
    );
  }

  return elements.length > 0 ? elements : [
    <span key="default" className="whitespace-pre-wrap">{text}</span>
  ];
};
