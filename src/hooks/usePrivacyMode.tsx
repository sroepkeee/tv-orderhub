import { useState, useEffect, createContext, useContext, ReactNode } from "react";

interface PrivacyModeContextType {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  maskText: (text: string | null | undefined, type?: 'name' | 'phone' | 'email' | 'address' | 'document') => string;
}

const PrivacyModeContext = createContext<PrivacyModeContextType | undefined>(undefined);

// Função utilitária para mascarar diferentes tipos de dados
const maskData = (text: string | null | undefined, type: string = 'name'): string => {
  if (!text) return '•••';
  
  switch (type) {
    case 'name':
      // "João da Silva" → "J••• da S•••"
      return text.split(' ').map(word => 
        word.length > 1 ? word[0] + '•'.repeat(Math.min(word.length - 1, 3)) : word
      ).join(' ');
      
    case 'phone':
      // "11999887766" → "11••••••66"
      const clean = text.replace(/\D/g, '');
      return clean.length > 4 ? clean.slice(0, 2) + '••••••' + clean.slice(-2) : '••••••';
      
    case 'email':
      // "joao@email.com" → "j•••@e•••.com"
      const [local, domain] = text.split('@');
      if (!domain) return '•••@•••.com';
      return (local?.[0] || '•') + '•••@' + (domain?.[0] || '•') + '•••';
      
    case 'address':
      // "Rua das Flores, 123" → "Rua •••, •••"
      return text.split(',')[0]?.split(' ').slice(0, 2).join(' ') + ', •••';
      
    case 'document':
      // "123.456.789-00" → "•••.•••.789-••"
      const digits = text.replace(/\D/g, '');
      if (digits.length === 11) return '•••.•••.' + digits.slice(6, 9) + '-••';
      if (digits.length === 14) return '••.•••.•••/' + digits.slice(8, 12) + '-••';
      return '•••••••••';
      
    default:
      return text[0] + '•'.repeat(Math.min(text.length - 1, 5));
  }
};

export const PrivacyModeProvider = ({ children }: { children: ReactNode }) => {
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("privacyMode");
      setIsPrivacyMode(saved === "true");
    } catch (e) {
      console.error("Error reading privacy mode from localStorage:", e);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("privacyMode", String(isPrivacyMode));
    } catch (e) {
      console.error("Error saving privacy mode to localStorage:", e);
    }
    // Add a class to document for potential CSS-based hiding
    document.documentElement.classList.toggle("privacy-mode", isPrivacyMode);
  }, [isPrivacyMode, isLoaded]);

  const togglePrivacyMode = () => setIsPrivacyMode(prev => !prev);
  
  const maskText = (text: string | null | undefined, type: 'name' | 'phone' | 'email' | 'address' | 'document' = 'name') => {
    if (!isPrivacyMode) return text || '';
    return maskData(text, type);
  };

  return (
    <PrivacyModeContext.Provider value={{ isPrivacyMode, togglePrivacyMode, maskText }}>
      {children}
    </PrivacyModeContext.Provider>
  );
};

export const usePrivacyMode = () => {
  const context = useContext(PrivacyModeContext);
  if (!context) {
    // Fallback para quando usado fora do provider
    return {
      isPrivacyMode: false,
      togglePrivacyMode: () => {},
      maskText: (text: string | null | undefined) => text || ''
    };
  }
  return context;
};
