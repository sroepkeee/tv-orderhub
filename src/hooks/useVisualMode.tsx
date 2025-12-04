import { useState, useEffect, createContext, useContext, ReactNode } from "react";

export type VisualMode = "colorful" | "minimal";

interface VisualModeContextType {
  mode: VisualMode;
  toggleMode: () => void;
  isMinimal: boolean;
}

const VisualModeContext = createContext<VisualModeContextType | undefined>(undefined);

export const VisualModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<VisualMode>(() => {
    const saved = localStorage.getItem("visualMode");
    return (saved as VisualMode) || "colorful";
  });

  useEffect(() => {
    localStorage.setItem("visualMode", mode);
    
    // Apply class to document for global CSS targeting
    if (mode === "minimal") {
      document.documentElement.classList.add("minimal-mode");
    } else {
      document.documentElement.classList.remove("minimal-mode");
    }
  }, [mode]);

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
    // Fallback for when used outside provider
    return {
      mode: "colorful" as VisualMode,
      toggleMode: () => {},
      isMinimal: false
    };
  }
  return context;
};
