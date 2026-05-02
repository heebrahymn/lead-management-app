import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppMessage {
  id: string;
  wati_message_id: string | null;
  lead_id: string | null;
  sender_name: string | null;
  wa_id: string;
  message_text: string | null;
  message_type: string | null;
  direction: 'inbound' | 'outbound';
  status: string | null;
  operator_name: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchWhatsAppMessages(limit: number = 1000): Promise<WhatsAppMessage[]> {
  console.log("Fetching messages from Supabase...", { limit });
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase Error (whatsapp_messages):", error);
    return [];
  }

  console.log("Supabase Success:", { 
    count: data?.length || 0,
    first: data?.[0] ? { id: data[0].id, created_at: data[0].created_at } : null
  });
  
  return (data || []) as unknown as WhatsAppMessage[];
}

export function computePeriodStats(messages: WhatsAppMessage[]) {
  let totalInbound = 0;
  let totalOutbound = 0;
  let chatsInWorkingHours = 0;
  let outOfHoursArrivals = 0;
  let inHoursNoReply = 0;
  let totalNoReply = 0;
  let weekendMessages = 0;
  
  const inHoursResponseTimes: number[] = [];
  const overallResponseTimes: number[] = [];
  const messagesByContact: Record<string, WhatsAppMessage[]> = {};
  const uniqueChats = new Set<string>();
  // Track inbound message IDs that arrived during working hours
  const workingHourMsgIds = new Set<string>();

  messages.forEach(msg => {
    uniqueChats.add(msg.wa_id);
    
    if (!messagesByContact[msg.wa_id]) {
      messagesByContact[msg.wa_id] = [];
    }
    messagesByContact[msg.wa_id].push(msg);

    const date = new Date(msg.created_at);
    const day = date.getDay();
    const hour = date.getHours();
    
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) weekendMessages++;

    if (msg.direction === 'inbound') {
      totalInbound++;
      const isWorkingHour = !isWeekend && hour >= 9 && hour < 17;
      if (isWorkingHour) {
        chatsInWorkingHours++;
        workingHourMsgIds.add(msg.id);
      } else {
        outOfHoursArrivals++;
      }
    } else {
      totalOutbound++;
    }
  });

  const agentStatsMap: Record<string, { name: string, msgsSent: number, responseTimes: number[], chats: Set<string> }> = {};

  Object.values(messagesByContact).forEach(contactMessages => {
    contactMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    let lastInbound: WhatsAppMessage | null = null;
    
    contactMessages.forEach(msg => {
      if (msg.direction === 'inbound') {
        if (lastInbound) {
          totalNoReply++;
          if (workingHourMsgIds.has(lastInbound.id)) inHoursNoReply++;
        }
        lastInbound = msg;
      } else if (msg.direction === 'outbound') {
        const opName = msg.operator_name || 'System / Auto-reply';
        if (!agentStatsMap[opName]) {
          agentStatsMap[opName] = { name: opName, msgsSent: 0, responseTimes: [], chats: new Set() };
        }
        agentStatsMap[opName].msgsSent++;
        agentStatsMap[opName].chats.add(msg.wa_id);

        if (lastInbound) {
          const responseTimeMs = new Date(msg.created_at).getTime() - new Date(lastInbound.created_at).getTime();
          const mins = Math.round(responseTimeMs / 60000);
          overallResponseTimes.push(mins);
          
          // Attribute response time to agent
          agentStatsMap[opName].responseTimes.push(mins);

          if (workingHourMsgIds.has(lastInbound.id)) {
            inHoursResponseTimes.push(mins);
          }
          lastInbound = null;
        }
      }
    });
    
    if (lastInbound) {
      totalNoReply++;
      if (workingHourMsgIds.has(lastInbound.id)) inHoursNoReply++;
    }
  });

  const calcMedian = (arr: number[]) => {
    if (arr.length === 0) return 0;
    arr.sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
  };

  const totalMessages = totalInbound + totalOutbound;

  // Response time buckets
  const bucketLabels = ['<= 5 mins', '5–15 mins', '15–30 mins', '30–60 mins', '> 60 mins'];
  const buckets = [0, 0, 0, 0, 0];
  overallResponseTimes.forEach(mins => {
    if (mins <= 5) buckets[0]++;
    else if (mins <= 15) buckets[1]++;
    else if (mins <= 30) buckets[2]++;
    else if (mins <= 60) buckets[3]++;
    else buckets[4]++;
  });
  const totalResponded = overallResponseTimes.length;
  const responseTimeBuckets = bucketLabels.map((label, i) => ({
    label,
    count: buckets[i],
    pct: totalResponded > 0 ? Math.round((buckets[i] / totalResponded) * 100) : 0,
  }));

  return {
    totalChats: uniqueChats.size,
    totalMessages,
    noResponseRate: totalInbound > 0 ? Math.round((totalNoReply / totalInbound) * 100) : 0,
    overallMedian: calcMedian(overallResponseTimes),
    inHoursMedian: calcMedian(inHoursResponseTimes),
    weekendShare: totalMessages > 0 ? Math.round((weekendMessages / totalMessages) * 100) : 0,
    outOfHoursArrivals,
    chatsInWorkingHours,
    inHoursNoReply,
    totalInbound,
    totalOutbound,
    responseTimeBuckets,
    agentPerformance: Object.values(agentStatsMap).map(agent => {
      const times = agent.responseTimes;
      times.sort((a, b) => a - b);
      let median = 0;
      if (times.length > 0) {
        const mid = Math.floor(times.length / 2);
        median = times.length % 2 !== 0 ? times[mid] : Math.round((times[mid - 1] + times[mid]) / 2);
      }

      const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

      let assessment = "Good";
      if (median <= 5) assessment = "Top Tier";
      else if (median > 60) assessment = "Need Improvement";
      else if (times.length < 5) assessment = "Onboarding";

      return {
        agent: agent.name,
        msgsSent: agent.msgsSent,
        median,
        avg,
        chats: agent.chats.size,
        assessment
      };
    }).sort((a, b) => b.msgsSent - a.msgsSent)
  };
}

export interface PeriodFilter {
  currentStart: Date;
  currentEnd: Date;
}

export function calculateWhatsAppAnalytics(messages: WhatsAppMessage[], filter?: PeriodFilter) {
  // Global stats for charts
  const leadsGenerated = new Set<string>();
  const dailyVolume: Record<string, { date: string, inbound: number, outbound: number }> = {};
  const operatorStats: Record<string, { operator: string, messagesSent: number }> = {};

  messages.forEach(msg => {
    if (msg.direction === 'inbound' && msg.lead_id) leadsGenerated.add(msg.lead_id);

    const dateStr = new Date(msg.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!dailyVolume[dateStr]) dailyVolume[dateStr] = { date: dateStr, inbound: 0, outbound: 0 };
    dailyVolume[dateStr][msg.direction]++;

    if (msg.direction === 'outbound') {
      const op = msg.operator_name || 'System / Auto-reply';
      if (!operatorStats[op]) operatorStats[op] = { operator: op, messagesSent: 0 };
      operatorStats[op].messagesSent++;
    }
  });

  // Day-of-week volume
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const WEEKEND_DAYS = new Set([0, 6]); // Sunday=0, Saturday=6
  const dayVolume: Record<number, { day: string; inbound: number; outbound: number; isWeekend: boolean }> = {};
  DAYS.forEach((name, idx) => {
    dayVolume[idx] = { day: name, inbound: 0, outbound: 0, isWeekend: WEEKEND_DAYS.has(idx) };
  });

  const timingStart = filter?.currentStart ?? new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
  const timingEnd = filter?.currentEnd ?? new Date();

  messages
    .filter(m => {
      const d = new Date(m.created_at);
      return d >= timingStart && d <= timingEnd;
    })
    .forEach(msg => {
      const dow = new Date(msg.created_at).getDay();
      dayVolume[dow][msg.direction]++;
    });

  // Ordered Mon→Sun (matching screenshot)
  const chatVolumeByDay = [1, 2, 3, 4, 5, 6, 0].map(idx => ({
    ...dayVolume[idx],
    total: dayVolume[idx].inbound + dayVolume[idx].outbound,
  }));

  // Period comparison — driven by filter if provided, else defaults to last 30 days
  const now = new Date();
  const periodEnd   = filter?.currentEnd   ?? now;
  const periodStart = filter?.currentStart ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const periodMs    = periodEnd.getTime() - periodStart.getTime();
  const prevEnd     = new Date(periodStart.getTime());
  const prevStart   = new Date(periodStart.getTime() - periodMs);

  const currentPeriodMsgs = messages.filter(m => {
    const d = new Date(m.created_at);
    return d >= periodStart && d <= periodEnd;
  });
  const previousPeriodMsgs = messages.filter(m => {
    const d = new Date(m.created_at);
    return d >= prevStart && d < prevEnd;
  });

  const currentStats = computePeriodStats(currentPeriodMsgs);
  const previousStats = computePeriodStats(previousPeriodMsgs);

  const periodDays = Math.round(periodMs / (24 * 60 * 60 * 1000));

  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? "+100%" : "- 0%";
    const diff = curr - prev;
    const pct = Math.round((diff / prev) * 100);
    return pct > 0 ? `+${pct}%` : `${pct}%`;
  };

  const periodComparison = [
    { metric: "Total Chats", current: currentStats.totalChats, prev: previousStats.totalChats, change: calcChange(currentStats.totalChats, previousStats.totalChats) },
    { metric: "Total Messages", current: currentStats.totalMessages, prev: previousStats.totalMessages, change: calcChange(currentStats.totalMessages, previousStats.totalMessages) },
    { metric: "No-response Rate (%)", current: currentStats.noResponseRate, prev: previousStats.noResponseRate, change: calcChange(currentStats.noResponseRate, previousStats.noResponseRate) },
    { metric: "Overall Median (mins)", current: currentStats.overallMedian, prev: previousStats.overallMedian, change: calcChange(currentStats.overallMedian, previousStats.overallMedian) },
    { metric: "In-hours Median (mins)", current: currentStats.inHoursMedian, prev: previousStats.inHoursMedian, change: calcChange(currentStats.inHoursMedian, previousStats.inHoursMedian) },
    { metric: "Weekend Share (%)", current: currentStats.weekendShare, prev: previousStats.weekendShare, change: calcChange(currentStats.weekendShare, previousStats.weekendShare) },
    { metric: "Out-of-hours Arrivals", current: currentStats.outOfHoursArrivals, prev: previousStats.outOfHoursArrivals, change: calcChange(currentStats.outOfHoursArrivals, previousStats.outOfHoursArrivals) },
  ];

  // For the top KPI row and Working hours section, use current stats to reflect recent reality
  return {
    totalInbound: currentStats.totalInbound,
    totalOutbound: currentStats.totalOutbound,
    totalMessages: currentStats.totalMessages,
    leadsGeneratedCount: leadsGenerated.size,
    volumeChartData: Object.values(dailyVolume).reverse(),
    agentPerformance: currentStats.agentPerformance,
    workingHours: {
      chatsInWorkingHours: currentStats.chatsInWorkingHours,
      inHoursMedian: currentStats.inHoursMedian,
      outOfHoursArrivals: currentStats.outOfHoursArrivals,
      inHoursNoReply: currentStats.inHoursNoReply
    },
    periodComparison,
    periodDays,
    chatVolumeByDay,
    responseTimeBreakdown: currentStats.responseTimeBuckets.map((bucket, i) => ({
      label: bucket.label,
      count: bucket.count,
      pct: bucket.pct,
      prevPct: previousStats.responseTimeBuckets[i]?.pct ?? 0,
    }))
  };
}
