import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageCircle, Users, Clock, Send, Calendar, RefreshCcw } from "lucide-react";
import { fetchWhatsAppMessages, calculateWhatsAppAnalytics } from "@/lib/wati";
import { useDateFilter, PresetKey } from "@/hooks/useDateFilter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function WhatsAppAnalytics() {
  // Single Global Filter for all sections
  const globalFilter = useDateFilter('7');

  const { data: messages = [], isLoading: messagesLoading, isRefetching, refetch } = useQuery({
    queryKey: ["whatsapp-messages"],
    queryFn: () => fetchWhatsAppMessages(5000),
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads-for-wa-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, source, created_at");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    document.title = "WhatsApp Analytics — Carbon Car Care CRM";
  }, []);

  const isLoading = messagesLoading || leadsLoading;

  // Calculate all stats based on the single global filter
  const stats = calculateWhatsAppAnalytics(messages, globalFilter.filter);

  // Synchronize leads count with main analytics definition
  const sourcedLeadsCount = leads.filter(l => {
    const source = l.source as string | null;
    const isWaSource = source?.toLowerCase().includes("whatsapp") || source === "WA";
    if (!isWaSource) return false;
    
    // If 'All time' or no filter yet, just return true based on source
    if (!globalFilter.filter) return true;

    const createdAt = new Date(l.created_at);
    const start = globalFilter.filter.currentStart;
    const end = globalFilter.filter.currentEnd;
    return createdAt >= start && createdAt <= end;
  }).length;

  const periodLabel = globalFilter.preset === 'custom'
    ? (globalFilter.customStart && globalFilter.customEnd ? `${globalFilter.customStart} → ${globalFilter.customEnd}` : 'Custom range')
    : `Current ${globalFilter.preset} days vs. previous ${globalFilter.preset} days`;

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight brand-gradient-text inline-block">WhatsApp Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm">Real-time performance and message tracking directly from webhooks</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Global Date Filter UI */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1.5 shadow-sm">
            {(['7', '14'] as PresetKey[]).map(d => (
              <Button
                key={d}
                variant={globalFilter.preset === d ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs px-3"
                onClick={() => globalFilter.setPreset(d)}
              >
                Last {d} days
              </Button>
            ))}
            <Button
              variant={globalFilter.preset === 'custom' ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs px-3 gap-1.5"
              onClick={() => globalFilter.setPreset('custom')}
            >
              <Calendar className="h-3.5 w-3.5" /> Custom
            </Button>
          </div>

          <Button
            onClick={() => refetch()}
            disabled={isRefetching}
            variant="outline"
            size="sm"
            className="h-9 gap-2"
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
            {isRefetching ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {globalFilter.preset === 'custom' && (
        <div className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-sm">
            <label className="font-semibold text-muted-foreground">From</label>
            <input
              type="date"
              value={globalFilter.customStart}
              onChange={e => globalFilter.setCustomStart(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="font-semibold text-muted-foreground">To</label>
            <input
              type="date"
              value={globalFilter.customEnd}
              onChange={e => globalFilter.setCustomEnd(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Messages"
          value={stats.totalMessages}
          icon={<MessageCircle className="h-4 w-4 text-primary" />}
        />
        <KpiCard
          title="Inbound Messages"
          value={stats.totalInbound}
          icon={<Users className="h-4 w-4 text-green-500" />}
        />
        <KpiCard
          title="Outbound Messages"
          value={stats.totalOutbound}
          icon={<Send className="h-4 w-4 text-blue-500" />}
        />
        <KpiCard
          title="Leads Sourced via WA"
          value={sourcedLeadsCount}
          icon={<Clock className="h-4 w-4 text-yellow-500" />}
        />
      </div>

      {/* Working Hours Analysis */}
      <div className="mb-8 premium-card p-6">
        <h2 className="mb-5 text-lg font-bold tracking-tight">Working Hours Response Analysis</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Chats in Working Hours" value={stats.workingHours.chatsInWorkingHours} />
          <StatCard title="In-hours Median" value={`${stats.workingHours.inHoursMedian} m`} />
          <StatCard title="Out-of-hours Arrivals" value={stats.workingHours.outOfHoursArrivals} />
          <StatCard title="In-hours, No Reply" value={stats.workingHours.inHoursNoReply} />
        </div>
      </div>

      {/* Period-on-Period Comparison */}
      <AnalyticsSection
        title="Period-on-Period Comparison"
        description={periodLabel}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium text-foreground">Metric</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">Current Period</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">Previous Period</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.periodComparison.map((row, i) => (
                <tr key={i} className="hover:bg-muted/10">
                  <td className="px-4 py-3.5 font-medium text-muted-foreground">{row.metric}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-foreground">{row.current}</td>
                  <td className="px-4 py-3.5 text-right text-muted-foreground">{row.prev}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={cn(
                      "text-sm font-medium",
                      row.change.startsWith("+") && row.change !== "+0%" ? "text-green-600" :
                        row.change.startsWith("-") && row.change !== "- 0%" ? "text-red-600" :
                          "text-muted-foreground"
                    )}>
                      {row.change}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AnalyticsSection>

      {/* Agent Response time Table */}
      <AnalyticsSection
        title="Agent Response time (Working Hours)"
        description="Performance metrics for the selected period"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-semibold">Agent</th>
                <th className="pb-3 font-semibold">Msgs Sent</th>
                <th className="pb-3 font-semibold text-center">Chats</th>
                <th className="pb-3 font-semibold text-center whitespace-nowrap">≤ 5m</th>
                <th className="pb-3 font-semibold text-center whitespace-nowrap">5-15m</th>
                <th className="pb-3 font-semibold text-center whitespace-nowrap">15-30m</th>
                <th className="pb-3 font-semibold text-center whitespace-nowrap">30-60m</th>
                <th className="pb-3 font-semibold text-center whitespace-nowrap">&gt; 60m</th>
                <th className="pb-3 font-semibold text-right">Assessment</th>
                <th className="pb-3 font-semibold text-right">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stats.agentPerformance.length > 0 ? (
                stats.agentPerformance.map((row, idx) => (
                  <tr key={idx} className="group hover:bg-muted/30 transition-colors">
                    <td className="py-4 font-medium text-[#1E293B]">{row.agent}</td>
                    <td className="py-4 text-muted-foreground">{row.msgsSent}</td>
                    <td className="py-4 text-center text-muted-foreground">{row.chats}</td>
                    <td className="py-4 text-center text-muted-foreground">
                      {row.buckets?.[0] > 0 ? (
                        <span className="font-bold text-green-600">{row.buckets[0]}</span>
                      ) : "—"}
                    </td>
                    <td className="py-4 text-center text-muted-foreground">
                      {row.buckets?.[1] > 0 ? row.buckets[1] : "—"}
                    </td>
                    <td className="py-4 text-center text-muted-foreground">
                      {row.buckets?.[2] > 0 ? row.buckets[2] : "—"}
                    </td>
                    <td className="py-4 text-center text-muted-foreground">
                      {row.buckets?.[3] > 0 ? row.buckets[3] : "—"}
                    </td>
                    <td className="py-4 text-center text-muted-foreground">
                      {row.buckets?.[4] > 0 ? (
                        <span className="font-bold text-red-500">{row.buckets[4]}</span>
                      ) : "—"}
                    </td>
                    <td className="py-4 text-right">
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        row.assessment === "Top Tier" ? "bg-green-100 text-green-700" :
                          row.assessment === "Good" ? "bg-blue-100 text-blue-700" :
                            row.assessment === "Need Improvement" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-700"
                      )}>
                        {row.assessment}
                      </span>
                    </td>
                    <td className="py-4 text-right text-xs text-muted-foreground italic">
                      {row.rationale}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">No agent data for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AnalyticsSection>

      {/* Chat Volume & Timing */}
      <AnalyticsSection
        title="Chat Volume & Timing"
        description="Message distribution by day of week"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium text-foreground">Day</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">Inbound</th>
                <th className="px-4 py-3 text-right font-bold text-foreground">Outbound</th>
                <th className="px-4 py-3 text-right font-bold text-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.chatVolumeByDay.map((row, i) => (
                <tr key={i} className="hover:bg-muted/10">
                  <td className="px-4 py-3.5">
                    <span className={cn("font-medium", row.isWeekend ? "text-orange-500" : "text-muted-foreground")}>{row.day}</span>
                    {row.isWeekend && <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-600">Weekend</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-green-600">{row.inbound}</td>
                  <td className="px-4 py-3.5 text-right font-medium text-blue-600">{row.outbound}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-foreground">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AnalyticsSection>

      {/* Response Time Breakdown */}
      <AnalyticsSection
        title="Response Time Breakdown (All Hours)"
        description="How quickly your team responds"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium text-foreground">Response Time</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">Count</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">% of Responded</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">vs Previous Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.responseTimeBreakdown.map((row, i) => {
                const diff = row.pct - row.prevPct;
                const changeLabel = row.prevPct === 0 ? (row.pct > 0 ? `+${row.pct}%` : '— 0%') : (diff > 0 ? `+${diff}%` : diff === 0 ? '— 0%' : `${diff}%`);
                return (
                  <tr key={i} className="hover:bg-muted/10">
                    <td className="px-4 py-3.5 font-medium text-muted-foreground">{row.label}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-foreground">{row.count}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-foreground">{row.pct}%</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={cn("text-sm font-medium", diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-muted-foreground")}>{changeLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AnalyticsSection>
    </div>
  );
}

interface SectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function AnalyticsSection({ title, description, children }: SectionProps) {
  return (
    <div className="mb-8 premium-card p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 premium-card p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shadow-sm">{icon}</div>
      <div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80">{title}</p>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="premium-card p-5 bg-muted/20">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  );
}
