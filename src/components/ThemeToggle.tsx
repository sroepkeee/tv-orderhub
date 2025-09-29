import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="outline" size="lg" disabled>
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="gap-2"
    >
      {theme === "dark" ? (
        <>
          <Sun className="h-5 w-5" />
          <span className="hidden sm:inline">Modo Claro</span>
        </>
      ) : (
        <>
          <Moon className="h-5 w-5" />
          <span className="hidden sm:inline">Modo Escuro</span>
        </>
      )}
    </Button>
  );
};
