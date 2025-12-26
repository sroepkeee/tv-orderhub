import { isHomolog, ENVIRONMENT } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { FlaskConical } from "lucide-react";

/**
 * Badge visual que indica ambiente de homologação
 * Só aparece quando VITE_ENVIRONMENT === 'homolog'
 */
const EnvironmentBadge = () => {
  if (!isHomolog) {
    return null;
  }

  return (
    <Badge 
      variant="outline" 
      className="fixed top-2 right-2 z-50 bg-amber-500/90 text-white border-amber-600 hover:bg-amber-500 shadow-lg animate-pulse"
    >
      <FlaskConical className="w-3 h-3 mr-1" />
      HOMOLOGAÇÃO
    </Badge>
  );
};

export default EnvironmentBadge;
