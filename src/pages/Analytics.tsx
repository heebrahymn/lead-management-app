import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, LeadStatus, STATUSES, STATUS_DOT, ManagedUser } from "@/lib/leads";
import { Loader2, Activity, Calendar, User, MessageSquare, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

export default function Analytics() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Analytics — Carbon Car Care CRM";
  }, []);

  useEffect(() => {
    (async () => {
      try {
        let allLeads: Lead[] = [];
        const CHUNK_SIZE = 1000;
        
        while (true) {
          const { data, error } = await supabase
            .from("leads")
            .select("*")
            .range(allLeads.length, allLeads.length + CHUNK_SIZE - 1);
            
          if (error) throw error;
          if (!data || data.length === 0) break;
          
          allLeads = [...allLeads, ...(data as Lead[])];
          if (data.length < CHUNK_SIZE) break;
        }
        
        setLeads(allLeads);
      } catch (err) {
        console.error("Error fetching analytical data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = useMemo(() => {
    const c: Record<LeadStatus, number> = {
      new: 0, interested: 0, no_response: 0, converted: 0, lost: 0, closed: 0,
    };
    leads.forEach((l) => c[l.status]++);
    return c;
  }, [leads]);

  const sourceData = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => {
      const src = l.source?.trim() || "Unknown";
      map.set(src, (map.get(src) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [leads]);

  const statusData = STATUSES.map((s) => ({ name: s.label, value: counts[s.value], status: s.value }));

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight brand-gradient-text inline-block">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deep dive into your lead performance.
        </p>
      </div>

      <div className="mb-6 premium-card p-6">
        <h2 className="text-sm font-semibold mb-4 uppercase tracking-widest text-muted-foreground/80">Pipeline summary</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {STATUSES.map((s) => (
            <div key={s.value} className="rounded-xl border border-border/50 bg-muted/10 p-4 transition-colors hover:bg-muted/20">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s.value])} />
                {s.label}
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight">{counts[s.value]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Leads by status" description="Distribution across pipeline">
          <BarChart data={statusData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {statusData.map((d) => (
                <Cell key={d.status} fill={`hsl(var(--status-${d.status.replace("_", "-")}-fg))`} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Leads by source" description="Where your leads come from">
          {sourceData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No source data
            </div>
          ) : (
            <BarChart data={sourceData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ChartCard>
      </div>

      <div className="mt-6">
        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Recent System Activity
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Live log of changes made across the workspace</p>
            </div>
            <Link to="/activity-logs" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              View All History
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          
          <ActivityWidget />
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactElement;
}) {
  return (
    <div className="premium-card p-6">
      <div className="mb-6">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ActivityWidget() {
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", { body: { action: "list" } });
      if (error) throw error;
      return (data?.users || []) as ManagedUser[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, ManagedUser>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  if (isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg border-border">
        No operational activities detected yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log: any) => {
        const operator = log.user_id ? userMap.get(log.user_id) : null;
        const isLeads = log.table_name === 'leads';
        const data = log.new_data || log.old_data || {};
        
        return (
          <div key={log.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/10 border border-border/40 text-sm">
            <div className="p-2 bg-background rounded-full border border-border shadow-sm">
              {isLeads ? <User className="h-3.5 w-3.5 text-blue-500" /> : <MessageSquare className="h-3.5 w-3.5 text-violet-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground truncate">
                  {operator?.full_name || "System user"}
                </span>
                <span className="text-muted-foreground text-xs">•</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </span>
              </div>
              <div className="text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                <Badge variant="outline" className={cn(
                  "px-1 py-0 h-4 text-[9px] uppercase tracking-wider",
                  log.action_type === 'INSERT' && "text-emerald-600 border-emerald-600/30 bg-emerald-600/5",
                  log.action_type === 'UPDATE' && "text-amber-600 border-amber-600/30 bg-amber-600/5",
                  log.action_type === 'DELETE' && "text-rose-600 border-rose-600/30 bg-rose-600/5"
                )}>
                  {log.action_type === 'INSERT' ? 'Created' : log.action_type === 'UPDATE' ? 'Modified' : 'Removed'}
                </Badge>
                <span>
                  {isLeads ? `lead "${data.name || 'Unnamed'}"` : `a note context`}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
