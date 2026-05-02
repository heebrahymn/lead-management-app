import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Users, Clock, Send, Calendar } from "lucide-react";
import { fetchWhatsAppMessages, calculateWhatsAppAnalytics, WhatsAppMessage, PeriodFilter } from "@/lib/wati";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

export default function WhatsAppAnalytics() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const data = await fetchWhatsAppMessages(2000);
      setMessages(data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    document.title = "WhatsApp Analytics — Leadly CRM";
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Period filter state
  type PresetKey = '7' | '14' | '30' | 'custom';
  const [preset, setPreset] = useState<PresetKey>('30');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Timing section local filter
  const [timingPreset, setTimingPreset] = useState<PresetKey>('30');
  const [timingCustomStart, setTimingCustomStart] = useState<string>('');
  const [timingCustomEnd, setTimingCustomEnd] = useState<string>('');

  // Agent Performance section local filter
  const [agentPreset, setAgentPreset] = useState<PresetKey>('30');
  const [agentCustomStart, setAgentCustomStart] = useState<string>('');
  const [agentCustomEnd, setAgentCustomEnd] = useState<string>('');

  // Response Time section local filter
  const [responsePreset, setResponsePreset] = useState<PresetKey>('30');
  const [responseCustomStart, setResponseCustomStart] = useState<string>('');
  const [responseCustomEnd, setResponseCustomEnd] = useState<string>('');

  const filter = useMemo((): PeriodFilter | undefined => {
    const now = new Date();
    if (preset === 'custom') {
      if (!customStart || !customEnd) return undefined; // fall back to 30-day default
      return {
        currentStart: new Date(customStart),
        currentEnd: new Date(customEnd + 'T23:59:59'),
      };
    }
    const days = parseInt(preset, 10);
    return {
      currentStart: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
      currentEnd: now,
    };
  }, [preset, customStart, customEnd]);

  const timingFilter = useMemo((): PeriodFilter | undefined => {
    const now = new Date();
    if (timingPreset === 'custom') {
      if (!timingCustomStart || !timingCustomEnd) return undefined;
      return {
        currentStart: new Date(timingCustomStart),
        currentEnd: new Date(timingCustomEnd + 'T23:59:59'),
      };
    }
    const days = parseInt(timingPreset, 10);
    return {
      currentStart: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
      currentEnd: now,
    };
  }, [timingPreset, timingCustomStart, timingCustomEnd]);

  const agentFilter = useMemo((): PeriodFilter | undefined => {
    const now = new Date();
    if (agentPreset === 'custom') {
      if (!agentCustomStart || !agentCustomEnd) return undefined;
      return {
        currentStart: new Date(agentCustomStart),
        currentEnd: new Date(agentCustomEnd + 'T23:59:59'),
      };
    }
    const days = parseInt(agentPreset, 10);
    return {
      currentStart: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
      currentEnd: now,
    };
  }, [agentPreset, agentCustomStart, agentCustomEnd]);

  const responseFilter = useMemo((): PeriodFilter | undefined => {
    const now = new Date();
    if (responsePreset === 'custom') {
      if (!responseCustomStart || !responseCustomEnd) return undefined;
      return {
        currentStart: new Date(responseCustomStart),
        currentEnd: new Date(responseCustomEnd + 'T23:59:59'),
      };
    }
    const days = parseInt(responsePreset, 10);
    return {
      currentStart: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
      currentEnd: now,
    };
  }, [responsePreset, responseCustomStart, responseCustomEnd]);

  // We need to calculate stats separately if we want local filtering
  const stats = calculateWhatsAppAnalytics(messages, filter);
  const timingStats = calculateWhatsAppAnalytics(messages, timingFilter);
  const agentStats = calculateWhatsAppAnalytics(messages, agentFilter);
  const responseStats = calculateWhatsAppAnalytics(messages, responseFilter);

  const periodLabel = preset === 'custom'
    ? (customStart && customEnd ? `${customStart} → ${customEnd}` : 'Custom range')
    : `Current ${preset} days vs. previous ${preset} days`;

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm">Real-time performance and message tracking directly from webhooks</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50 disabled:opacity-50",
            refreshing && "cursor-not-allowed"
          )}
        >
          <Loader2 className={cn("h-4 w-4", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

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
          value={stats.leadsGeneratedCount}
          icon={<Clock className="h-4 w-4 text-yellow-500" />}
        />
      </div>

      {/* Working Hours Analysis */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-[#1E293B]">Working Hours Response Analysis</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Chats in Working Hours"
            value={stats.workingHours.chatsInWorkingHours}
          />
          <StatCard
            title="In-hours Median"
            value={`${stats.workingHours.inHoursMedian} m`}
          />
          <StatCard
            title="Out-of-hours Arrivals"
            value={stats.workingHours.outOfHoursArrivals}
          />
          <StatCard
            title="In-hours, No Reply"
            value={stats.workingHours.inHoursNoReply}
          />
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#1E293B]">Agent Performance (Working Hours)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Performance metrics ({agentPreset === 'custom' ? 'Custom' : `last ${agentPreset} days`})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['7', '30'] as const).map(d => (
              <button
                key={d}
                onClick={() => setAgentPreset(d)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  agentPreset === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
                )}
              >
                Last {d} days
              </button>
            ))}
            <button
              onClick={() => setAgentPreset('custom')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                agentPreset === 'custom'
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
              )}
            >
              <Calendar className="h-3 w-3" />
              Custom
            </button>
          </div>
        </div>

        {agentPreset === 'custom' && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <label className="whitespace-nowrap font-medium text-muted-foreground">From</label>
              <input
                type="date"
                value={agentCustomStart}
                onChange={e => setAgentCustomStart(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="whitespace-nowrap font-medium text-muted-foreground">To</label>
              <input
                type="date"
                value={agentCustomEnd}
                onChange={e => setAgentCustomEnd(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-semibold">Agent</th>
                <th className="pb-3 font-semibold">Msgs Sent</th>
                <th className="pb-3 font-semibold text-center">Avg Resp (m)</th>
                <th className="pb-3 font-semibold text-center">Chats</th>
                <th className="pb-3 font-semibold text-right">Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {agentStats.agentPerformance.length > 0 ? (
                agentStats.agentPerformance.map((row, idx) => (
                  <tr key={idx} className="group">
                    <td className="py-4 font-medium text-[#1E293B]">{row.agent}</td>
                    <td className="py-4 text-muted-foreground">{row.msgsSent}</td>
                    <td className="py-4 text-center font-semibold text-[#1E293B]">{row.avg}</td>
                    <td className="py-4 text-center text-muted-foreground">{row.chats}</td>
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No agent data for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Period-on-Period Comparison */}
      <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-soft">
        {/* Header + Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#1E293B]">Period-on-Period Comparison</h2>
            <p className="mt-1 text-sm text-muted-foreground">{periodLabel}</p>
          </div>

          {/* Preset buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {(['7', '14', '30'] as const).map(d => (
              <button
                key={d}
                onClick={() => setPreset(d)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  preset === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
                )}
              >
                Last {d} days
              </button>
            ))}
            <button
              onClick={() => setPreset('custom')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                preset === 'custom'
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
              )}
            >
              <Calendar className="h-3 w-3" />
              Custom
            </button>
          </div>
        </div>

        {/* Custom date range inputs */}
        {preset === 'custom' && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <label className="whitespace-nowrap font-medium text-muted-foreground">From</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="whitespace-nowrap font-medium text-muted-foreground">To</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}
        
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
      </div>

      {/* Chat Volume & Timing */}
      <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#1E293B]">Chat Volume &amp; Timing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Message distribution by day of week ({timingPreset === 'custom' ? 'Custom' : `last ${timingPreset} days`})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['7', '30'] as const).map(d => (
              <button
                key={d}
                onClick={() => setTimingPreset(d)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  timingPreset === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
                )}
              >
                Last {d} days
              </button>
            ))}
            <button
              onClick={() => setTimingPreset('custom')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                timingPreset === 'custom'
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
              )}
            >
              <Calendar className="h-3 w-3" />
              Custom
            </button>
          </div>
        </div>

        {timingPreset === 'custom' && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <label className="whitespace-nowrap font-medium text-muted-foreground">From</label>
              <input
                type="date"
                value={timingCustomStart}
                onChange={e => setTimingCustomStart(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="whitespace-nowrap font-medium text-muted-foreground">To</label>
              <input
                type="date"
                value={timingCustomEnd}
                onChange={e => setTimingCustomEnd(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}

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
              {timingStats.chatVolumeByDay.map((row, i) => (
                <tr key={i} className="hover:bg-muted/10">
                  <td className="px-4 py-3.5">
                    <span className={cn("font-medium", row.isWeekend ? "text-orange-500" : "text-muted-foreground")}>
                      {row.day}
                    </span>
                    {row.isWeekend && (
                      <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-600">
                        Weekend
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-green-600">{row.inbound}</td>
                  <td className="px-4 py-3.5 text-right font-medium text-blue-600">{row.outbound}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-foreground">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Response Time Breakdown */}
      <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#1E293B]">Response Time Breakdown (All Hours)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              How quickly your team responds ({responsePreset === 'custom' ? 'Custom' : `last ${responsePreset} days`})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['7', '30'] as const).map(d => (
              <button
                key={d}
                onClick={() => setResponsePreset(d)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  responsePreset === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
                )}
              >
                Last {d} days
              </button>
            ))}
            <button
              onClick={() => setResponsePreset('custom')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                responsePreset === 'custom'
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
              )}
            >
              <Calendar className="h-3 w-3" />
              Custom
            </button>
          </div>
        </div>

        {responsePreset === 'custom' && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <label className="whitespace-nowrap font-medium text-muted-foreground">From</label>
              <input
                type="date"
                value={responseCustomStart}
                onChange={e => setResponseCustomStart(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="whitespace-nowrap font-medium text-muted-foreground">To</label>
              <input
                type="date"
                value={responseCustomEnd}
                onChange={e => setResponseCustomEnd(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}

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
              {responseStats.responseTimeBreakdown.map((row, i) => {
                const diff = row.pct - row.prevPct;
                const changeLabel = row.prevPct === 0
                  ? (row.pct > 0 ? `+${row.pct}%` : '— 0%')
                  : (diff > 0 ? `+${diff}%` : diff === 0 ? '— 0%' : `${diff}%`);
                const isPositive = diff > 0;
                const isNegative = diff < 0;
                return (
                  <tr key={i} className="hover:bg-muted/10">
                    <td className="px-4 py-3.5 font-medium text-muted-foreground">{row.label}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-foreground">{row.count}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-foreground">{row.pct}%</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={cn(
                        "text-sm font-medium",
                        isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-muted-foreground"
                      )}>
                        {changeLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function KpiCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-md">
      <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-[#1E293B]">{value}</p>
    </div>
  );
}
