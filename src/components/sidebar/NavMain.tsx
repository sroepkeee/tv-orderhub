import { ChevronRight, LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
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
    <div className="flex flex-col px-2 py-1">
      {groups.map((group, groupIndex) => {
        const GroupIcon = group.icon;
        const hasActiveItem = group.items.some(item => location.pathname === item.path);
        
        return (
          <div key={group.id}>
            {/* Separador entre grupos (exceto o primeiro) */}
            {groupIndex > 0 && (
              <SidebarSeparator className="my-1 mx-0" />
            )}
            
            <SidebarMenu className="gap-0.5">
              {group.items.length > 4 ? (
                <Collapsible asChild defaultOpen={hasActiveItem} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={group.label} size="sm">
                        <GroupIcon className="h-3.5 w-3.5" />
                        <span className="text-xs">{group.label}</span>
                        <ChevronRight className="ml-auto h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
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
                                <Link to={item.path} className="text-xs">
                                  <span>{item.label}</span>
                                  {hasBadge && (
                                    <Badge variant="destructive" className="ml-auto h-4 px-1 text-[9px] animate-pulse">
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
                      <SidebarMenuButton asChild tooltip={item.label} isActive={isActive} size="sm">
                        <Link to={item.path}>
                          <ItemIcon className="h-3.5 w-3.5" />
                          <span className="text-xs">{item.label}</span>
                          {hasBadge && (
                            <Badge variant="destructive" className="ml-auto h-4 px-1 text-[9px] animate-pulse">
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
          </div>
        );
      })}
    </div>
  );
};

export default NavMain;
