import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lead, LeadStatus, STATUSES, STATUS_DOT } from "@/lib/leads";
import { Loader2, TrendingUp, Users, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, subDays, startOfDay } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { StatusBadge } from "@/components/StatusBadge";

export default function Overview() {
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Overview — Carbon Car Care CRM";
  }, []);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Lead[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("overview-leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { counts, pipelineValue } = useMemo(() => {
    const c: Record<LeadStatus, number> = {
      new: 0, interested: 0, no_response: 0, converted: 0, lost: 0, closed: 0,
    };
    let total = 0;
    leads.forEach((l) => {
      if (c[l.status] !== undefined) {
        c[l.status]++;
      }
      total += Number(l.deal_value || 0);
    });
    return { counts: c, pipelineValue: total };
  }, [leads]);

  const conversionRate = leads.length
    ? Math.round((counts.converted / leads.length) * 100)
    : 0;

  const trend = useMemo(() => {
    const days = 14;
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = startOfDay(subDays(new Date(), days - 1 - i));
      return { date: d, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: 0 };
    });
    leads.forEach((l) => {
      const d = startOfDay(new Date(l.created_at)).getTime();
      const b = buckets.find((x) => x.date.getTime() === d);
      if (b) b.count++;
    });
    return buckets;
  }, [leads]);

  const pieData = STATUSES.map((s) => ({
    name: s.label,
    value: counts[s.value],
    status: s.value,
  })).filter((d) => d.value > 0);

  const recent = leads.slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight brand-gradient-text inline-block">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A snapshot of your pipeline performance.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Users} label="Total leads" value={leads.length} tint="primary" />
        <KpiCard icon={TrendingUp} label="Conversion value" value={`£${pipelineValue.toLocaleString()}`} tint="amber" />
        <KpiCard icon={CheckCircle2} label="Converted" value={counts.converted} tint="green" />
        <KpiCard icon={TrendingUp} label="Conversion rate" value={`${conversionRate}%`} tint="primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trend chart */}
        <div className="premium-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">New leads</h2>
              <p className="text-xs text-muted-foreground">Last 14 days</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#leadsFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline breakdown */}
        <div className="premium-card p-6">
          <h2 className="text-sm font-semibold">Pipeline</h2>
          <p className="text-xs text-muted-foreground">Leads by status</p>
          {pieData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          ) : (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={40} outerRadius={64} paddingAngle={2}>
                      {pieData.map((d) => (
                        <Cell key={d.status} fill={`hsl(var(--status-${d.status.replace("_", "-")}-fg))`} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {STATUSES.map((s) => (
                  <li key={s.value} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s.value])} />
                      {s.label}
                    </span>
                    <span className="font-medium tabular-nums">{counts[s.value]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-6 premium-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Recent leads</h2>
            <p className="text-xs text-muted-foreground">Most recently updated</p>
          </div>
          <Link
            to="/leads"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No leads yet. Add one from the Leads page.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-5 py-3">
                <Link to={`/leads/${l.id}`} className="min-w-0 flex-1 hover:underline">
                  <div className="font-medium">{l.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {l.email ?? l.phone ?? "No contact info"}
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  <StatusBadge status={l.status} />
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {formatDistanceToNow(new Date(l.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tint: "primary" | "green" | "amber";
}) {
  const tintMap = {
    primary: "bg-primary-muted text-primary",
    green: "bg-status-converted-bg text-status-converted-fg",
    amber: "bg-status-no-response-bg text-status-no-response-fg",
  };
  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80">{label}</span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shadow-sm", tintMap[tint])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
