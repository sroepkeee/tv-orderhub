import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/sidebar/AppSidebar";
import { Order } from "@/components/Dashboard";
import { KanbanDensity } from "@/hooks/useKanbanDensity";
import { ViewMode } from "@/components/ViewControls";
import EnvironmentBadge from "@/components/EnvironmentBadge";

interface MainLayoutProps {
  children: React.ReactNode;
  orders?: Order[];
  unreadConversationsCount?: number;
  pendingApprovalsCount?: number;
  // View settings props
  viewMode?: ViewMode;
  kanbanDensity?: KanbanDensity;
  kanbanAutoDetect?: boolean;
  onViewModeChange?: (mode: ViewMode) => void;
  onKanbanDensityChange?: (density: KanbanDensity) => void;
  onKanbanAutoDetectChange?: (enabled: boolean) => void;
}

const MainLayout = ({ 
  children, 
  orders = [],
  unreadConversationsCount = 0,
  pendingApprovalsCount = 0,
  viewMode,
  kanbanDensity,
  kanbanAutoDetect,
  onViewModeChange,
  onKanbanDensityChange,
  onKanbanAutoDetectChange,
}: MainLayoutProps) => {
  return (
    <SidebarProvider>
      <EnvironmentBadge />
      <div className="flex min-h-screen w-full">
        <AppSidebar
          orders={orders}
          unreadConversationsCount={unreadConversationsCount}
          pendingApprovalsCount={pendingApprovalsCount}
          viewMode={viewMode}
          kanbanDensity={kanbanDensity}
          kanbanAutoDetect={kanbanAutoDetect}
          onViewModeChange={onViewModeChange}
          onKanbanDensityChange={onKanbanDensityChange}
          onKanbanAutoDetectChange={onKanbanAutoDetectChange}
        />
        <SidebarInset className="flex-1">
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
