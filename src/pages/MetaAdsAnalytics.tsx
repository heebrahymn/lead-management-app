import { useEffect, useState, useMemo } from "react";
import { useDateFilter, PresetKey } from "@/hooks/useDateFilter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Megaphone, Eye, MousePointerClick, TrendingDown, 
  Percent, Activity, Coins, RefreshCcw, Calendar, Users, MessageCircle 
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
type MetaAdMetric = {
  id: string;
  date: string;
  campaign_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  whatsapp_clicks: number;
  reach: number;
  cpm: number;
};

type CampaignAggregated = {
  name: string;
  status: string;
  spend: number;
  clicks: number;
  impressions: number;
  whatsapp_clicks: number;
  reach: number;
  costPerWaClick: number;
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

export default function MetaAdsAnalytics() {
  const globalFilter = useDateFilter('7');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [rawData, setRawData] = useState<MetaAdMetric[]>([]);

  useEffect(() => {
    document.title = "Meta Ads Analytics — Carbon Car Care CRM";
  }, []);

  const fetchMetrics = async () => {
    setIsRefreshing(true);
    setIsLoading(true);
    try {
      let query = supabase
        .from("meta_ads_metrics")
        .select("*")
        .order("date", { ascending: true });

      if (globalFilter.filter) {
        const startStr = globalFilter.filter.currentStart.toISOString().split('T')[0];
        const endStr = globalFilter.filter.currentEnd.toISOString().split('T')[0];
        query = query.gte("date", startStr).lte("date", endStr);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching meta ads metrics", error);
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
    const campaignMap = new Map<string, CampaignAggregated>();
    const dailyMap = new Map<string, { date: string; spend: number; whatsapp_clicks: number }>();

    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalWaClicks = 0;
    let totalReach = 0;

    rawData.forEach(row => {
      totalSpend += Number(row.spend);
      totalClicks += Number(row.clicks);
      totalImpressions += Number(row.impressions);
      totalWaClicks += Number(row.whatsapp_clicks);
      totalReach += Number(row.reach);

      // Campaign stats
      const c = campaignMap.get(row.campaign_name) || {
        name: row.campaign_name,
        status: "Active",
        spend: 0,
        clicks: 0,
        impressions: 0,
        whatsapp_clicks: 0,
        reach: 0,
        costPerWaClick: 0,
      };
      c.spend += Number(row.spend);
      c.clicks += Number(row.clicks);
      c.impressions += Number(row.impressions);
      c.whatsapp_clicks += Number(row.whatsapp_clicks);
      c.reach += Number(row.reach);
      campaignMap.set(row.campaign_name, c);

      // Daily stats
      const dateKey = row.date;
      const d = dailyMap.get(dateKey) || { date: dateKey, spend: 0, whatsapp_clicks: 0 };
      d.spend += Number(row.spend);
      d.whatsapp_clicks += Number(row.whatsapp_clicks);
      dailyMap.set(dateKey, d);
    });

    // Calculate Cost Per WA Click
    campaignMap.forEach(c => {
      c.costPerWaClick = c.whatsapp_clicks > 0 ? (c.spend / c.whatsapp_clicks) : 0;
    });

    const campaigns = Array.from(campaignMap.values()).sort((a, b) => b.spend - a.spend);
    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    const cpc = totalClicks > 0 ? (totalSpend / totalClicks) : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const costPerWaClick = totalWaClicks > 0 ? (totalSpend / totalWaClicks) : 0;
    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

    return {
      campaignData: campaigns,
      dailyData: daily,
      globalStats: {
        totalSpend, impressions: totalImpressions, clicks: totalClicks, 
        whatsappClicks: totalWaClicks, reach: totalReach,
        cpc: cpc.toFixed(2), ctr: ctr.toFixed(2), costPerWaClick, cpm: cpm.toFixed(2),
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
    whatsappClicks: activeCampaign.whatsapp_clicks,
    reach: activeCampaign.reach,
    cpc: activeCampaign.clicks > 0 ? (activeCampaign.spend / activeCampaign.clicks).toFixed(2) : "0.00",
    ctr: activeCampaign.impressions > 0 ? ((activeCampaign.clicks / activeCampaign.impressions) * 100).toFixed(2) : "0.00",
    costPerWaClick: activeCampaign.costPerWaClick,
    cpm: activeCampaign.impressions > 0 ? ((activeCampaign.spend / activeCampaign.impressions) * 1000).toFixed(2) : "0.00",
  } : globalStats;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meta Ads Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor campaign performance, spend, and WhatsApp click metrics.
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
                  setSelectedCampaign(null);
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
            <Megaphone className="h-8 w-8 text-muted-foreground" />
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
                title="WhatsApp Clicks"
                value={Number(displayStats.whatsappClicks).toLocaleString()}
                subtitle="People who clicked to message"
                icon={<MessageCircle className="h-4 w-4 text-green-500" />}
                highlight
              />
              <KpiCard
                title="Cost Per WhatsApp Click"
                value={`AED ${Number(displayStats.costPerWaClick).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtitle="Your true cost per lead"
                icon={<TrendingDown className="h-4 w-4 text-blue-500" />}
                highlight
              />
            </div>
          </div>

          {/* Secondary KPIs */}
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Impressions"
              value={Number(displayStats.impressions).toLocaleString()}
              icon={<Eye className="h-4 w-4 text-gray-500" />}
            />
            <KpiCard
              title="Reach"
              value={Number(displayStats.reach).toLocaleString()}
              subtitle="Unique users"
              icon={<Users className="h-4 w-4 text-gray-500" />}
            />
            <KpiCard
              title="Link Clicks"
              value={Number(displayStats.clicks).toLocaleString()}
              icon={<MousePointerClick className="h-4 w-4 text-gray-500" />}
            />
            <KpiCard
              title="CTR"
              value={`${displayStats.ctr}%`}
              icon={<Percent className="h-4 w-4 text-gray-500" />}
            />
          </div>

          {/* Charts Section */}
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-6 text-lg font-bold tracking-tight">Spend vs. WhatsApp Clicks (Daily)</h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMetaSpend" x1="0" y1="0" x2="0" y2="1">
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
                    <Area yAxisId="left" type="monotone" dataKey="spend" name="Spend (AED)" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorMetaSpend)" />
                    <Area yAxisId="right" type="monotone" dataKey="whatsapp_clicks" name="WhatsApp Clicks" stroke="#25D366" strokeWidth={2} fillOpacity={0} fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-6 text-lg font-bold tracking-tight">Campaign Performance (WhatsApp Clicks)</h2>
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
                      dataKey="whatsapp_clicks" 
                      name="WhatsApp Clicks" 
                      fill="#25D366" 
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
                    <th className="px-6 py-3 text-right font-medium text-foreground">WA Clicks</th>
                    <th className="px-6 py-3 text-right font-medium text-foreground">Cost/WA Click</th>
                    <th className="px-6 py-3 text-right font-medium text-foreground">Impressions</th>
                    <th className="px-6 py-3 text-right font-medium text-foreground">Reach</th>
                    <th className="px-6 py-3 text-right font-medium text-foreground">Link Clicks</th>
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
                      <td className="px-6 py-4 text-right font-semibold text-foreground">{campaign.whatsapp_clicks.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">AED {campaign.costPerWaClick.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{campaign.impressions.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{campaign.reach.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{campaign.clicks.toLocaleString()}</td>
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
