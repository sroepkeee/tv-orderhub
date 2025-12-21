import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  Factory,
  Truck,
  MessageSquare,
  ShoppingCart,
  Users,
  UserCog,
  Bot,
  Settings,
  LogOut,
  Moon,
  Sun,
  KeyRound,
} from "lucide-react";
import logo from "@/assets/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { state } = useSidebar();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const isCollapsed = state === "collapsed";

  // Check super admin status
  useEffect(() => {
    if (!user?.email) return;
    
    supabase
      .from('ai_agent_admins')
      .select('id')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => setIsSuperAdmin(!!data));
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
  const menuGroups: MenuGroup[] = [
    {
      id: "main",
      label: "PRINCIPAL",
      icon: LayoutDashboard,
      items: [
        { path: "/", icon: LayoutDashboard, label: "Dashboard" },
        { path: "/metrics", icon: BarChart3, label: "Indicadores" },
        { path: "/producao", icon: Factory, label: "Produção" },
      ]
    },
    {
      id: "logistics",
      label: "LOGÍSTICA",
      icon: Truck,
      items: [
        { path: "/transportadoras", icon: Truck, label: "Transportadoras" },
        { path: "/carriers-chat", icon: MessageSquare, label: "Conversas", badge: unreadConversationsCount },
        { path: "/compras", icon: ShoppingCart, label: "Compras" },
      ]
    },
    {
      id: "customers",
      label: "CLIENTES",
      icon: Users,
      items: [
        { path: "/customers", icon: Users, label: "Clientes" },
      ]
    },
  ];

  // Adicionar grupo de admin se for admin
  if (isAdmin) {
    menuGroups.push({
      id: "admin",
      label: "ADMINISTRAÇÃO",
      icon: Settings,
      adminOnly: true,
      items: [
        { path: "/admin/users", icon: UserCog, label: "Usuários", badge: pendingApprovalsCount },
        ...(isSuperAdmin ? [{ path: "/ai-agent", icon: Bot, label: "Agente IA" }] : []),
        { path: "/settings/phases", icon: Settings, label: "Fases" },
      ]
    });
  }

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header com Logo */}
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-1.5">
          <img 
            src={logo} 
            alt="Logo" 
            className="h-8 w-8 object-contain"
          />
          {!isCollapsed && (
            <span className="font-semibold text-sidebar-foreground">
              Imply OMS
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Indicadores Compactos */}
        {orders.length > 0 && (
          <>
            <SidebarMetrics orders={orders} />
            <SidebarSeparator />
          </>
        )}

        {/* Navegação Principal */}
        <NavMain groups={menuGroups} />

        <SidebarSeparator />

        {/* Configurações de Visualização */}
        {!isCollapsed && (
          <div className="px-2 py-2">
            <ViewSettingsPopover
              viewMode={viewMode}
              kanbanDensity={kanbanDensity}
              kanbanAutoDetect={kanbanAutoDetect}
              onViewModeChange={onViewModeChange || (() => {})}
              onKanbanDensityChange={onKanbanDensityChange || (() => {})}
              onKanbanAutoDetectChange={onKanbanAutoDetectChange || (() => {})}
            />
          </div>
        )}
      </SidebarContent>

      {/* Footer com User Menu */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex flex-col gap-0.5 leading-none flex-1 text-left">
                      <span className="font-medium text-xs truncate max-w-[140px]">
                        {user?.email}
                      </span>
                      <span className="text-[10px] text-sidebar-foreground/60">
                        {isAdmin ? "Administrador" : "Usuário"}
                      </span>
                    </div>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 bg-popover border border-border"
                side="top"
                align="start"
                sideOffset={8}
              >
                <DropdownMenuItem onClick={toggleTheme}>
                  {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  {isDark ? "Modo Claro" : "Modo Escuro"}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Alterar Senha
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
