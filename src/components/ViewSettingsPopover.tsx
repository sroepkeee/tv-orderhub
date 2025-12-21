import React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Settings2, 
  List, 
  LayoutGrid, 
  Table2, 
  Maximize2, 
  Columns3, 
  Monitor, 
  Palette, 
  Circle,
  ChevronDown,
  Keyboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVisualMode } from "@/hooks/useVisualMode";

export type ViewMode = "list" | "kanban" | "matrix";
export type KanbanDensity = "comfortable" | "compact" | "tv";

interface ViewSettingsPopoverProps {
  viewMode: ViewMode;
  kanbanDensity: KanbanDensity;
  kanbanAutoDetect: boolean;
  kanbanSuggestedDensity?: KanbanDensity;
  onViewModeChange: (mode: ViewMode) => void;
  onKanbanDensityChange: (density: KanbanDensity) => void;
  onKanbanAutoDetectChange: (enabled: boolean) => void;
}

export const ViewSettingsPopover = ({
  viewMode,
  kanbanDensity,
  kanbanAutoDetect,
  kanbanSuggestedDensity,
  onViewModeChange,
  onKanbanDensityChange,
  onKanbanAutoDetectChange,
}: ViewSettingsPopoverProps) => {
  const { mode: visualMode, toggleMode, isMinimal } = useVisualMode();

  const getViewModeIcon = () => {
    switch (viewMode) {
      case "list": return <List className="h-4 w-4" />;
      case "kanban": return <LayoutGrid className="h-4 w-4" />;
      case "matrix": return <Table2 className="h-4 w-4" />;
    }
  };

  const getViewModeLabel = () => {
    switch (viewMode) {
      case "list": return "Lista";
      case "kanban": return "Kanban";
      case "matrix": return "Matriz";
    }
  };

  const getDensityLabel = (density: KanbanDensity) => {
    switch (density) {
      case "comfortable": return "Confortável";
      case "compact": return "Compacto";
      case "tv": return "TV";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          {getViewModeIcon()}
          <span className="hidden sm:inline">{getViewModeLabel()}</span>
          {viewMode === "kanban" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {getDensityLabel(kanbanDensity)}
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Configurações de Visualização</span>
          </div>
        </div>

        {/* View Mode Section */}
        <div className="p-3">
          <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Modo de Exibição
          </Label>
          <div className="flex gap-1 mt-2">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              className="flex-1 h-9"
              onClick={() => onViewModeChange("list")}
            >
              <List className="h-4 w-4 mr-1.5" />
              Lista
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "outline"}
              size="sm"
              className="flex-1 h-9"
              onClick={() => onViewModeChange("kanban")}
            >
              <LayoutGrid className="h-4 w-4 mr-1.5" />
              Kanban
            </Button>
            <Button
              variant={viewMode === "matrix" ? "default" : "outline"}
              size="sm"
              className="flex-1 h-9"
              onClick={() => onViewModeChange("matrix")}
            >
              <Table2 className="h-4 w-4 mr-1.5" />
              Matriz
            </Button>
          </div>
        </div>

        <Separator />

        {/* Kanban Density Section (only visible in Kanban mode) */}
        {viewMode === "kanban" && (
          <>
            <div className="p-3">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Densidade do Kanban
              </Label>
              
              {/* Auto-detect toggle */}
              <div className="flex items-center justify-between mt-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Auto-detectar</span>
                  {kanbanAutoDetect && kanbanSuggestedDensity && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      → {getDensityLabel(kanbanSuggestedDensity)}
                    </span>
                  )}
                </div>
                <Switch
                  checked={kanbanAutoDetect}
                  onCheckedChange={onKanbanAutoDetectChange}
                />
              </div>

              <div className="flex gap-1.5">
                <Button
                  variant={kanbanDensity === "comfortable" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex-1 h-12 flex-col gap-1 py-2",
                    kanbanAutoDetect && kanbanSuggestedDensity === "comfortable" && "ring-2 ring-primary/50"
                  )}
                  onClick={() => onKanbanDensityChange("comfortable")}
                >
                  <Maximize2 className="h-4 w-4" />
                  <span className="text-[10px]">Confortável</span>
                </Button>
                <Button
                  variant={kanbanDensity === "compact" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex-1 h-12 flex-col gap-1 py-2",
                    kanbanAutoDetect && kanbanSuggestedDensity === "compact" && "ring-2 ring-primary/50"
                  )}
                  onClick={() => onKanbanDensityChange("compact")}
                >
                  <Columns3 className="h-4 w-4" />
                  <span className="text-[10px]">Compacto</span>
                </Button>
                <Button
                  variant={kanbanDensity === "tv" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex-1 h-12 flex-col gap-1 py-2",
                    kanbanAutoDetect && kanbanSuggestedDensity === "tv" && "ring-2 ring-primary/50"
                  )}
                  onClick={() => onKanbanDensityChange("tv")}
                >
                  <Monitor className="h-4 w-4" />
                  <span className="text-[10px]">TV</span>
                </Button>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Visual Mode Section */}
        <div className="p-3">
          <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Aparência
          </Label>
          <div className="flex gap-1 mt-2">
            <Button
              variant={!isMinimal ? "default" : "outline"}
              size="sm"
              className="flex-1 h-9"
              onClick={() => isMinimal && toggleMode()}
            >
              <Palette className="h-4 w-4 mr-1.5" />
              Colorido
            </Button>
            <Button
              variant={isMinimal ? "default" : "outline"}
              size="sm"
              className="flex-1 h-9"
              onClick={() => !isMinimal && toggleMode()}
            >
              <Circle className="h-4 w-4 mr-1.5" />
              Minimalista
            </Button>
          </div>
        </div>

        {/* Keyboard shortcuts footer */}
        <div className="p-2 bg-muted/50 border-t">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Keyboard className="h-3 w-3" />
            <span>
              <kbd className="px-1 py-0.5 bg-background rounded text-[9px] font-mono">Ctrl</kbd>+
              <kbd className="px-1 py-0.5 bg-background rounded text-[9px] font-mono">1/2/3</kbd> densidade
              <span className="mx-1.5">•</span>
              <kbd className="px-1 py-0.5 bg-background rounded text-[9px] font-mono">Ctrl</kbd>+
              <kbd className="px-1 py-0.5 bg-background rounded text-[9px] font-mono">0</kbd> auto
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
