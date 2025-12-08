import { useState, useEffect, createContext, useContext, ReactNode } from "react";

export type VisualMode = "colorful" | "minimal";

interface VisualModeContextType {
  mode: VisualMode;
  toggleMode: () => void;
  isMinimal: boolean;
}

const VisualModeContext = createContext<VisualModeContextType | undefined>(undefined);

export const VisualModeProvider = ({ children }: { children: ReactNode }) => {
  // Inicializar com default seguro, sem acessar localStorage durante SSR
  const [mode, setMode] = useState<VisualMode>("colorful");
  const [isLoaded, setIsLoaded] = useState(false);

  // Carregar do localStorage apenas no cliente após montagem
  useEffect(() => {
    try {
      const saved = localStorage.getItem("visualMode");
      if (saved === "colorful" || saved === "minimal") {
        setMode(saved);
      }
    } catch (e) {
      // Ignorar erros de localStorage
    }
    setIsLoaded(true);
  }, []);

  // Salvar no localStorage e aplicar classe ao DOM
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      localStorage.setItem("visualMode", mode);
    } catch (e) {
      // Ignorar erros de localStorage
    }
    
    // Aplicar classe ao document de forma segura
    document.documentElement.classList.toggle("minimal-mode", mode === "minimal");
  }, [mode, isLoaded]);

  const toggleMode = () => {
    setMode(prev => prev === "colorful" ? "minimal" : "colorful");
  };

  return (
    <VisualModeContext.Provider value={{ mode, toggleMode, isMinimal: mode === "minimal" }}>
      {children}
    </VisualModeContext.Provider>
  );
};

export const useVisualMode = () => {
  const context = useContext(VisualModeContext);
  if (!context) {
    // Fallback para quando usado fora do provider
    return {
      mode: "colorful" as VisualMode,
      toggleMode: () => {},
      isMinimal: false
    };
  }
  return context;
};
