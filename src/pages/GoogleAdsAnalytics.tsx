import { useEffect, useState, useMemo } from "react";
import { useDateFilter, PresetKey } from "@/hooks/useDateFilter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Target, Eye, MousePointerClick, TrendingUp, 
  TrendingDown, Percent, Activity, Coins, RefreshCcw, Calendar 
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

// --- TYPES ---
type CampaignMetric = {
  id: string;
  date: string;
  campaign_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
};

type CampaignAggregated = {
  name: string;
  status: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cpa: number;
};

// --- COMPONENTS ---
function KpiCard({ title, value, subtitle, icon, highlight = false }: { title: string, value: string | number, subtitle?: string, icon: React.ReactNode, highlight?: boolean }) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all duration-300 hover:shadow-md",
      highlight ? "border-primary/20 bg-primary/5" : "border-border bg-card"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold tracking-tight text-foreground">{value}</h3>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export default function GoogleAdsAnalytics() {
  const globalFilter = useDateFilter('7');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [rawData, setRawData] = useState<CampaignMetric[]>([]);

  useEffect(() => {
    document.title = "Google Ads Analytics — Carbon Car Care CRM";
  }, []);

  const fetchMetrics = async () => {
    setIsRefreshing(true);
    setIsLoading(true);
    try {
      let query = supabase
        .from("google_ads_metrics")
        .select("*")
        .order("date", { ascending: true });

      if (globalFilter.filter) {
        const startStr = globalFilter.filter.currentStart.toISOString().split('T')[0];
        const endStr = globalFilter.filter.currentEnd.toISOString().split('T')[0];
        query = query.gte("date", startStr).lte("date", endStr);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching google ads metrics", error);
      } else {
        setRawData(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [globalFilter.filter]);

  // --- DATA TRANSFORMATIONS ---
  const { campaignData, dailyData, globalStats } = useMemo(() => {
    // 1. Aggregate by Campaign
    const campaignMap = new Map<string, CampaignAggregated>();
    
    // 2. Aggregate by Date for the Area Chart
    const dailyMap = new Map<string, { date: string; spend: number; conversions: number }>();

    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalConversions = 0;

    rawData.forEach(row => {
      // Global stats
      totalSpend += Number(row.spend);
      totalClicks += Number(row.clicks);
      totalImpressions += Number(row.impressions);
      totalConversions += Number(row.conversions);

      // Campaign stats
      const c = campaignMap.get(row.campaign_name) || {
        name: row.campaign_name,
        status: "Active",
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        cpa: 0
      };
      c.spend += Number(row.spend);
      c.clicks += Number(row.clicks);
      c.impressions += Number(row.impressions);
      c.conversions += Number(row.conversions);
      campaignMap.set(row.campaign_name, c);

      // Daily stats
      const dateKey = row.date; // e.g. "2026-07-01"
      const d = dailyMap.get(dateKey) || { date: dateKey, spend: 0, conversions: 0 };
      d.spend += Number(row.spend);
      d.conversions += Number(row.conversions);
      dailyMap.set(dateKey, d);
    });

    // Calculate CPA
    campaignMap.forEach(c => {
       c.cpa = c.conversions > 0 ? (c.spend / c.conversions) : 0;
    });

    const campaigns = Array.from(campaignMap.values()).sort((a, b) => b.spend - a.spend);
    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate global rates
    const cpc = totalClicks > 0 ? (totalSpend / totalClicks) : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpa = totalConversions > 0 ? (totalSpend / totalConversions) : 0;
    const cvr = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    return {
      campaignData: campaigns,
      dailyData: daily,
      globalStats: {
        totalSpend, impressions: totalImpressions, clicks: totalClicks, conversions: totalConversions,
        cpc: cpc.toFixed(2), ctr: ctr.toFixed(2), cpa, cvr: cvr.toFixed(2)
      }
    };
  }, [rawData]);

  const activeCampaign = selectedCampaign 
    ? campaignData.find(c => c.name === selectedCampaign) 
    : null;

  const displayStats = activeCampaign ? {
    totalSpend: activeCampaign.spend,
    impressions: activeCampaign.impressions,
    clicks: activeCampaign.clicks,
    conversions: activeCampaign.conversions,
    cpc: activeCampaign.clicks > 0 ? (activeCampaign.spend / activeCampaign.clicks).toFixed(2) : "0.00",
    ctr: activeCampaign.impressions > 0 ? ((activeCampaign.clicks / activeCampaign.impressions) * 100).toFixed(2) : "0.00",
    cpa: activeCampaign.cpa,
    cvr: activeCampaign.clicks > 0 ? ((activeCampaign.conversions / activeCampaign.clicks) * 100).toFixed(2) : "0.00"
  } : globalStats;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Google Ads Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor campaign performance, spend, and conversion metrics.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1.5 shadow-sm">
            {(['7', '14', '28', '30'] as PresetKey[]).map(d => (
              <Button
                key={d}
                variant={globalFilter.preset === d ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs px-3"
                onClick={() => {
                  globalFilter.setPreset(d);
                  setSelectedCampaign(null); // Reset selection on filter change
                }}
              >
                Last {d} days
              </Button>
            ))}
            <Button
              variant={globalFilter.preset === 'custom' ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs px-3 gap-1.5"
              onClick={() => {
                globalFilter.setPreset('custom');
                setSelectedCampaign(null);
              }}
            >
              <Calendar className="h-3.5 w-3.5" /> Custom
            </Button>
          </div>

          <Button
            onClick={fetchMetrics}
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            disabled={isRefreshing}
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      {/* Notice removed since we are now live */}

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

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
            <p>Loading analytics...</p>
          </div>
        </div>
      ) : rawData.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Target className="h-8 w-8 text-muted-foreground" />
            <p>No campaign data found for this period.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Top KPIs */}
          <div className="mb-8">
            {selectedCampaign && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">Viewing metrics for campaign:</span>
                  <span className="text-sm font-bold text-foreground">{selectedCampaign}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)} className="h-8 text-xs">
                  Clear Selection
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                title="Total Spend"
                value={`AED ${Number(displayStats.totalSpend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<Coins className="h-4 w-4 text-primary" />}
                highlight
              />
              <KpiCard
                title="Total Conversions"
                value={Number(displayStats.conversions).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                icon={<Target className="h-4 w-4 text-green-500" />}
                highlight
              />
              <KpiCard
                title="Cost Per Acquisition (CPA)"
                value={`AED ${Number(displayStats.cpa).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<TrendingDown className="h-4 w-4 text-blue-500" />}
              />
            </div>
          </div>

          {/* Secondary KPIs */}
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              title="Impressions"
              value={Number(displayStats.impressions).toLocaleString()}
              icon={<Eye className="h-4 w-4 text-gray-500" />}
            />
            <KpiCard
              title="Clicks"
              value={Number(displayStats.clicks).toLocaleString()}
              icon={<MousePointerClick className="h-4 w-4 text-gray-500" />}
            />
            <KpiCard
              title="Click-Through Rate"
              value={`${displayStats.ctr}%`}
              icon={<Percent className="h-4 w-4 text-gray-500" />}
            />
            <KpiCard
              title="Conversion Rate"
              value={`${displayStats.cvr}%`}
              icon={<Activity className="h-4 w-4 text-gray-500" />}
            />
            <KpiCard
              title="Cost Per Click (CPC)"
              value={`AED ${displayStats.cpc}`}
              icon={<Coins className="h-4 w-4 text-gray-500" />}
            />
          </div>

          {/* Charts Section */}
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-6 text-lg font-bold tracking-tight">Spend vs. Conversions (Daily)</h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Area yAxisId="left" type="monotone" dataKey="spend" name="Spend (AED)" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
                    <Area yAxisId="right" type="monotone" dataKey="conversions" name="Conversions" stroke="#10b981" strokeWidth={2} fillOpacity={0} fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-6 text-lg font-bold tracking-tight">Campaign Performance (Conversions)</h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={campaignData} 
                    layout="vertical" 
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    onClick={(state) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        const clickedCampaign = state.activePayload[0].payload.name;
                        setSelectedCampaign(clickedCampaign === selectedCampaign ? null : clickedCampaign);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={120} />
                    <Tooltip 
                      cursor={{fill: '#f3f4f6'}}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar 
                      dataKey="conversions" 
                      name="Conversions" 
                      fill="#10b981" 
                      radius={[0, 4, 4, 0]} 
                      barSize={20} 
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Campaigns Table */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-bold tracking-tight">Campaign Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-6 py-3 text-left font-medium text-foreground">Campaign Name</th>
                    <th className="px-6 py-3 text-left font-medium text-foreground">Status</th>
                    <th className="px-6 py-3 text-right font-medium text-foreground">Spend</th>
                    <th className="px-6 py-3 text-right font-medium text-foreground">Clicks</th>
                    <th className="px-6 py-3 text-right font-medium text-foreground">Conversions</th>
                    <th className="px-6 py-3 text-right font-medium text-foreground">CPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campaignData.map((campaign, i) => (
                    <tr 
                      key={i} 
                      onClick={() => setSelectedCampaign(campaign.name === selectedCampaign ? null : campaign.name)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/50",
                        selectedCampaign === campaign.name ? "bg-primary/5" : ""
                      )}
                    >
                      <td className="px-6 py-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            selectedCampaign === campaign.name ? "bg-primary" : "bg-transparent"
                          )} />
                          {campaign.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          campaign.status === 'Active' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        )}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground">AED {campaign.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{campaign.clicks.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-semibold text-foreground">{campaign.conversions.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">AED {campaign.cpa.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
