import { LayoutDashboard, Users, Settings, LogOut, BarChart3, ShieldCheck, MessageCircle, Activity, Target, Megaphone } from "lucide-react";
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
  { title: "Google Ads Analytics", url: "/google-ads", icon: Target },
  { title: "Meta Ads Analytics", url: "/meta-ads", icon: Megaphone },
  { title: "Audit Trail", url: "/activity-logs", icon: Activity },
];

const settingsItem: NavItem = { title: "Settings", url: "/settings", icon: Settings };
const usersItem: NavItem = { title: "Users", url: "/users", icon: ShieldCheck };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { isSuperadmin, isOperator } = useRoles();
  
  // Filter base items for operator
  const filteredBaseItems = isOperator 
    ? baseItems.filter(item => ["Overview", "Leads Management", "Lead Analytics"].includes(item.title))
    : baseItems;

  const items: NavItem[] = [
    ...filteredBaseItems,
    ...(isSuperadmin ? [usersItem] : []),
    settingsItem,
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          {!collapsed ? (
            <img src="/logo-light.png" alt="Carbon Car Care" className="h-8 w-auto" />
          ) : (
            <img src="/logo-square.jpg" alt="C" className="h-8 w-8 rounded-md object-cover" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/50 font-bold text-[10px] uppercase tracking-widest">Workspace</SidebarGroupLabel>
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
                        active && "bg-[#152653] text-[#ffe863] shadow-md"
                      )}
                    >
                      <NavLink 
                        to={item.url} 
                        end={item.end} 
                        className={cn(
                          "group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200",
                          active 
                            ? "font-bold text-[#ffe863]" 
                            : "text-white hover:text-[#eacc1b] hover:bg-white/5"
                        )}
                      >
                        <item.icon className={cn(
                          "h-[1.1rem] w-[1.1rem] transition-colors duration-200", 
                          active ? "text-[#ffe863]" : "text-white group-hover:text-[#eacc1b]"
                        )} />
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
              <span className="truncate text-xs text-white/80 font-medium">{user?.email}</span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-[#eacc1b] transition-colors"
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
