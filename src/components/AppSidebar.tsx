import { LayoutDashboard, Users, Settings, LogOut, BarChart3, ShieldCheck, MessageCircle } from "lucide-react";
import { useRoles } from "@/hooks/useRole";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const baseItems: NavItem[] = [
  { title: "Overview", url: "/", icon: LayoutDashboard, end: true },
  { title: "Leads Management", url: "/leads", icon: Users },
  { title: "Lead Analytics", url: "/analytics", icon: BarChart3 },
  { title: "WhatsApp Analytics", url: "/whatsapp-analytics", icon: MessageCircle },
];

const settingsItem: NavItem = { title: "Settings", url: "/settings", icon: Settings };
const usersItem: NavItem = { title: "Users", url: "/users", icon: ShieldCheck };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { isSuperadmin } = useRoles();
  const items: NavItem[] = [
    ...baseItems,
    ...(isSuperadmin ? [usersItem] : []),
    settingsItem,
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          {!collapsed ? (
            <img src="/logo.png" alt="Carbon Car Care" className="h-6 w-auto" />
          ) : (
            <img src="/logo-square.jpg" alt="C" className="h-7 w-7 rounded-md object-cover" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={active} 
                      tooltip={item.title}
                      className={cn(
                        "transition-all duration-300",
                        active && "bg-primary/5 text-primary shadow-sm"
                      )}
                    >
                      <NavLink 
                        to={item.url} 
                        end={item.end} 
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg",
                          active ? "font-semibold" : "text-muted-foreground/80 hover:text-foreground"
                        )}
                      >
                        <item.icon className={cn("h-[1.1rem] w-[1.1rem]", active ? "text-primary" : "text-muted-foreground/60")} />
                        <span className="text-sm tracking-tight">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className={cn("flex items-center gap-2 px-2 py-1.5", collapsed && "justify-center")}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-muted text-xs font-semibold text-primary">
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
              <span className="truncate text-xs text-sidebar-foreground">{user?.email}</span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
