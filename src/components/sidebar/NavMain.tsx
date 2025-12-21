import { ChevronRight, LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
  badge?: number | null;
}

export interface MenuGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  adminOnly?: boolean;
}

interface NavMainProps {
  groups: MenuGroup[];
}

const NavMain = ({ groups }: NavMainProps) => {
  const location = useLocation();

  return (
    <>
      {groups.map((group) => {
        const GroupIcon = group.icon;
        const hasActiveItem = group.items.some(item => location.pathname === item.path);
        
        return (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.length > 4 ? (
                <Collapsible asChild defaultOpen={hasActiveItem} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={group.label}>
                        <GroupIcon className="h-4 w-4" />
                        <span>{group.label}</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {group.items.map((item) => {
                          const isActive = location.pathname === item.path;
                          const hasBadge = item.badge && item.badge > 0;
                          
                          return (
                            <SidebarMenuSubItem key={item.path}>
                              <SidebarMenuSubButton asChild isActive={isActive}>
                                <Link to={item.path}>
                                  <span>{item.label}</span>
                                  {hasBadge && (
                                    <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px] animate-pulse">
                                      {item.badge}
                                    </Badge>
                                  )}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : (
                group.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = location.pathname === item.path;
                  const hasBadge = item.badge && item.badge > 0;
                  
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild tooltip={item.label} isActive={isActive}>
                        <Link to={item.path}>
                          <ItemIcon className="h-4 w-4" />
                          <span>{item.label}</span>
                          {hasBadge && (
                            <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px] animate-pulse">
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroup>
        );
      })}
    </>
  );
};

export default NavMain;
