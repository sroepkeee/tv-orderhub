import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, BarChart3, Factory, Truck, MessageSquare, ShoppingCart, Users, UserCog, Bot, Settings, LogOut, Moon, Sun, KeyRound, FolderOpen } from "lucide-react";
import logo from "@/assets/logo.png";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail, SidebarSeparator, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import NavMain, { MenuGroup } from "./NavMain";
import SidebarMetrics from "./SidebarMetrics";
import { ViewSettingsPopover } from "@/components/ViewSettingsPopover";
import { Order } from "@/components/Dashboard";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { KanbanDensity } from "@/hooks/useKanbanDensity";
import { ViewMode } from "@/components/ViewControls";
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  orders?: Order[];
  unreadConversationsCount?: number;
  pendingApprovalsCount?: number;
  // View settings
  viewMode?: ViewMode;
  kanbanDensity?: KanbanDensity;
  kanbanAutoDetect?: boolean;
  onViewModeChange?: (mode: ViewMode) => void;
  onKanbanDensityChange?: (density: KanbanDensity) => void;
  onKanbanAutoDetectChange?: (enabled: boolean) => void;
}
const AppSidebar = ({
  orders = [],
  unreadConversationsCount = 0,
  pendingApprovalsCount = 0,
  viewMode = "kanban",
  kanbanDensity = "comfortable",
  kanbanAutoDetect = true,
  onViewModeChange,
  onKanbanDensityChange,
  onKanbanAutoDetectChange,
  ...props
}: AppSidebarProps) => {
  const {
    user,
    signOut
  } = useAuth();
  const {
    isAdmin
  } = useAdminAuth();
  const {
    state
  } = useSidebar();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const isCollapsed = state === "collapsed";

  // Check super admin status
  useEffect(() => {
    if (!user?.email) return;
    supabase.from('ai_agent_admins').select('id').eq('email', user.email).eq('is_active', true).maybeSingle().then(({
      data
    }) => setIsSuperAdmin(!!data));
  }, [user?.email]);
  useEffect(() => {
    const root = window.document.documentElement;
    setIsDark(root.classList.contains("dark"));
  }, []);
  const toggleTheme = () => {
    const root = window.document.documentElement;
    root.classList.toggle("dark");
    setIsDark(!isDark);
  };
  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/auth");
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso."
      });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  // Grupos de menu
  const menuGroups: MenuGroup[] = [{
    id: "main",
    label: "PRINCIPAL",
    icon: LayoutDashboard,
    items: [{
      path: "/",
      icon: LayoutDashboard,
      label: "Kanban"
    }, {
      path: "/metrics",
      icon: BarChart3,
      label: "Indicadores"
    }, {
      path: "/producao",
      icon: Factory,
      label: "Produção"
    }, {
      path: "/files",
      icon: FolderOpen,
      label: "Arquivos"
    }]
  }, {
    id: "logistics",
    label: "LOGÍSTICA",
    icon: Truck,
    items: [{
      path: "/transportadoras",
      icon: Truck,
      label: "Transportadoras"
    }, {
      path: "/carriers-chat",
      icon: MessageSquare,
      label: "Conversas",
      badge: unreadConversationsCount
    }, {
      path: "/compras",
      icon: ShoppingCart,
      label: "Compras"
    }]
  }, {
    id: "customers",
    label: "CLIENTES",
    icon: Users,
    items: [{
      path: "/customers",
      icon: Users,
      label: "Clientes"
    }]
  }];

  // Adicionar grupo de admin se for admin
  if (isAdmin) {
    menuGroups.push({
      id: "admin",
      label: "ADMINISTRAÇÃO",
      icon: Settings,
      adminOnly: true,
      items: [{
        path: "/admin/users",
        icon: UserCog,
        label: "Usuários",
        badge: pendingApprovalsCount
      }, ...(isSuperAdmin ? [{
        path: "/ai-agent",
        icon: Bot,
        label: "Agente IA"
      }] : []), {
        path: "/settings/phases",
        icon: Settings,
        label: "Fases"
      }]
    });
  }
  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "??";
  return <Sidebar collapsible="icon" {...props}>
      {/* Header compacto com Logo */}
      <SidebarHeader className="border-b border-sidebar-border p-1.5 bg-popover">
        <Link to="/" className="flex items-center justify-center px-1">
          <img src={logo} alt="Logo" className="h-10 w-10 object-contain" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="bg-popover">
        {/* Indicadores Compactos */}
        {orders.length > 0 && <>
            <SidebarMetrics orders={orders} />
            <SidebarSeparator />
          </>}

        {/* Navegação Principal */}
        <NavMain groups={menuGroups} />

      </SidebarContent>

      {/* Footer compacto com User Menu */}
      <SidebarFooter className="border-t border-sidebar-border p-1.5 bg-popover">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="sm" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-7">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[9px]">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && <div className="flex items-center gap-1 flex-1 text-left min-w-0">
                      <span className="font-medium text-[10px] truncate flex-1">
                        {user?.email?.split('@')[0]}
                      </span>
                      <span className="text-[9px] text-sidebar-foreground/60 shrink-0">
                        {isAdmin ? "Admin" : "User"}
                      </span>
                    </div>}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 bg-popover border border-border" side="top" align="start" sideOffset={4}>
                <DropdownMenuItem onClick={toggleTheme} className="text-xs">
                  {isDark ? <Sun className="mr-2 h-3.5 w-3.5" /> : <Moon className="mr-2 h-3.5 w-3.5" />}
                  {isDark ? "Modo Claro" : "Modo Escuro"}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs">
                  <KeyRound className="mr-2 h-3.5 w-3.5" />
                  Alterar Senha
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive text-xs">
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>;
};
export default AppSidebar;