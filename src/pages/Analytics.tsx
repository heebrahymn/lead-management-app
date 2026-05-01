import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, LeadStatus, STATUSES, STATUS_DOT, SOURCE_LABEL } from "@/lib/leads";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
    document.title = "Analytics — Leadly CRM";
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("leads").select("*");
      setLeads((data ?? []) as Lead[]);
      setLoading(false);
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
      const src = l.source ? SOURCE_LABEL[l.source] : "Unknown";
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
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deep dive into your lead performance.
        </p>
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

      <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-semibold">Pipeline summary</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUSES.map((s) => (
            <div key={s.value} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s.value])} />
                {s.label}
              </div>
              <div className="mt-1 text-xl font-semibold">{counts[s.value]}</div>
            </div>
          ))}
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
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4">
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
