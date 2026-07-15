import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.11";

const WORKING_HOURS_START = 7;
const WORKING_HOURS_END = 17;

interface WhatsAppMessage {
  id: string;
  wa_id: string;
  direction: string;
  operator_name: string | null;
  created_at: string;
}

// Stats calculation logic adapted from wati.ts
function computePeriodStats(messages: WhatsAppMessage[]) {
  let totalInbound = 0;
  let totalOutbound = 0;
  let chatsInWorkingHours = 0;
  let outOfHoursArrivals = 0;
  let inHoursLateReply = 0;
  let totalNoReply = 0;
  let weekendMessages = 0;

  const inHoursResponseTimes: number[] = [];
  const overallResponseTimes: number[] = [];
  const messagesByContact: Record<string, WhatsAppMessage[]> = {};
  const uniqueChats = new Set<string>();
  const weekendChats = new Set<string>();
  const workingHourMsgIds = new Set<string>();

  messages.forEach(msg => {
    uniqueChats.add(msg.wa_id);

    if (!messagesByContact[msg.wa_id]) {
      messagesByContact[msg.wa_id] = [];
    }
    messagesByContact[msg.wa_id].push(msg);

    const date = new Date(msg.created_at);
    const day = date.getUTCDay();
    const hour = date.getUTCHours();

    const isWeekend = day === 0 || day === 6;
    if (isWeekend) {
      weekendMessages++;
      weekendChats.add(msg.wa_id);
    }

    const dir = (msg.direction || '').toLowerCase();
    const isInbound = dir.includes('inbound') || dir.includes('received');

    if (isInbound) {
      totalInbound++;
      const isWorkingHour = !isWeekend && hour >= WORKING_HOURS_START && hour < WORKING_HOURS_END;
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

  const agentStatsMap: Record<string, {
    name: string,
    msgsSent: number,
    responseTimes: number[],
    chats: Set<string>,
    buckets: number[]
  }> = {};

  Object.values(messagesByContact).forEach(contactMessages => {
    contactMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let lastInbound: WhatsAppMessage | null = null;

    contactMessages.forEach(msg => {
      const dir = (msg.direction || '').toLowerCase();
      const isInbound = dir.includes('inbound') || dir.includes('received');
      const isOutbound = dir.includes('outbound') || dir.includes('sent');

      if (isInbound) {
        if (lastInbound) {
          totalNoReply++;
        }
        lastInbound = msg;
      } else if (isOutbound) {
        const opName = msg.operator_name || 'System / Auto-reply';
        if (!agentStatsMap[opName]) {
          agentStatsMap[opName] = {
            name: opName,
            msgsSent: 0,
            responseTimes: [],
            chats: new Set(),
            buckets: [0, 0, 0, 0, 0]
          };
        }
        agentStatsMap[opName].msgsSent++;
        agentStatsMap[opName].chats.add(msg.wa_id);

        if (lastInbound) {
          const responseTimeMs = new Date(msg.created_at).getTime() - new Date(lastInbound.created_at).getTime();
          const mins = Math.round(responseTimeMs / 60000);
          overallResponseTimes.push(mins);

          if (workingHourMsgIds.has(lastInbound.id)) {
            inHoursResponseTimes.push(mins);
            agentStatsMap[opName].responseTimes.push(mins);

            if (mins <= 5) agentStatsMap[opName].buckets[0]++;
            else if (mins <= 15) agentStatsMap[opName].buckets[1]++;
            else if (mins <= 30) agentStatsMap[opName].buckets[2]++;
            else if (mins <= 60) agentStatsMap[opName].buckets[3]++;
            else agentStatsMap[opName].buckets[4]++;

            if (mins >= 30) {
              inHoursLateReply++;
            }
          }
          lastInbound = null;
        }
      }
    });

    if (lastInbound) {
      totalNoReply++;
    }
  });

  const calcMedian = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  };

  const totalMessages = totalInbound + totalOutbound;

  return {
    totalChats: uniqueChats.size,
    totalMessages,
    overallMedian: calcMedian(overallResponseTimes),
    inHoursMedian: calcMedian(inHoursResponseTimes),
    weekendChats: weekendChats.size,
    outOfHoursArrivals,
    chatsInWorkingHours,
    inHoursLateReply,
    totalInbound,
    totalOutbound,
    totalNoReply,
    agentPerformance: Object.values(agentStatsMap).map(agent => ({
      name: agent.name,
      msgsSent: agent.msgsSent,
      chatsHandled: agent.chats.size,
      medianResponseMins: calcMedian(agent.responseTimes)
    })).sort((a, b) => b.msgsSent - a.msgsSent)
  };
}

const generateHtmlTemplate = (stats: ReturnType<typeof computePeriodStats>, targetDate: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    .header { background: #ffffff; padding: 30px; text-align: center; border-bottom: 4px solid #10b981; }
    .header h1 { margin: 0; color: #0f172a; font-size: 24px; }
    .header p { margin: 10px 0 0 0; color: #64748b; font-size: 14px; }
    .content { padding: 30px; }
    .metrics-table { width: 100%; border-collapse: separate; border-spacing: 15px; margin-bottom: 30px; }
    .metric-card { background: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center; }
    .metric-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .metric-value { font-size: 24px; font-weight: bold; color: #0f172a; margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    h2 { font-size: 18px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-top: 30px; }
    .summary-text { font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-left: 4px solid #10b981; border-radius: 0 4px 4px 0; }
    .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; }
    .data-table th { text-align: left; padding: 12px 15px; background: #f8fafc; font-size: 13px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    .data-table td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Daily WhatsApp Analytics</h1>
      <p>Performance report for ${targetDate}</p>
    </div>
    
    <div class="content">
      <h2>Executive Summary</h2>
      <div class="summary-text">
        Over the past 24 hours, the team processed a total of <strong>${stats.totalMessages.toLocaleString()}</strong> messages across <strong>${stats.totalChats.toLocaleString()}</strong> unique conversations. We saw an inbound volume of <strong>${stats.totalInbound.toLocaleString()}</strong> messages vs an outbound volume of <strong>${stats.totalOutbound.toLocaleString()}</strong> messages. The team maintained a median response time of <strong>${stats.inHoursMedian} mins</strong> during working hours.
      </div>

      <h2>Key Metrics</h2>
      <table class="metrics-table" style="width: 100%; border-collapse: separate; border-spacing: 15px; margin-bottom: 30px;">
        <tr>
          <td class="metric-card" style="background: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center;">
            <div class="metric-label" style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Total Messages</div>
            <div class="metric-value" style="font-size: 24px; font-weight: bold; color: #0f172a; margin: 0;">${stats.totalMessages.toLocaleString()}</div>
          </td>
          <td class="metric-card" style="background: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center;">
            <div class="metric-label" style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Total Chats</div>
            <div class="metric-value" style="font-size: 24px; font-weight: bold; color: #0f172a; margin: 0;">${stats.totalChats.toLocaleString()}</div>
          </td>
        </tr>
        <tr>
          <td class="metric-card" style="background: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center;">
            <div class="metric-label" style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Inbound</div>
            <div class="metric-value" style="font-size: 24px; font-weight: bold; color: #0f172a; margin: 0;">${stats.totalInbound.toLocaleString()}</div>
          </td>
          <td class="metric-card" style="background: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center;">
            <div class="metric-label" style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Outbound</div>
            <div class="metric-value" style="font-size: 24px; font-weight: bold; color: #0f172a; margin: 0;">${stats.totalOutbound.toLocaleString()}</div>
          </td>
        </tr>
      </table>

      <h2>Working Hours Performance (7 AM - 5 PM)</h2>
      <table class="data-table" style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; text-align: left;">
        <tr>
          <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">Median Response Time</td>
          <td style="font-weight: bold; padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${stats.inHoursMedian} mins</td>
        </tr>
        <tr>
          <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">Late Replies (>30m)</td>
          <td style="font-weight: bold; color: ${stats.inHoursLateReply > 0 ? '#ef4444' : '#10b981'}; padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${stats.inHoursLateReply}</td>
        </tr>
        <tr>
          <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">No Replies (Unanswered)</td>
          <td style="font-weight: bold; color: ${stats.totalNoReply > 0 ? '#ef4444' : '#10b981'}; padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${stats.totalNoReply}</td>
        </tr>
      </table>

      <h2>Agent Performance</h2>
      <table class="data-table" style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; text-align: left;">
        <thead>
          <tr>
            <th style="padding: 12px 15px; background: #f8fafc; font-size: 13px; color: #64748b; border-bottom: 2px solid #e2e8f0;">Agent</th>
            <th style="padding: 12px 15px; background: #f8fafc; font-size: 13px; color: #64748b; border-bottom: 2px solid #e2e8f0;">Sent</th>
            <th style="padding: 12px 15px; background: #f8fafc; font-size: 13px; color: #64748b; border-bottom: 2px solid #e2e8f0;">Chats</th>
            <th style="padding: 12px 15px; background: #f8fafc; font-size: 13px; color: #64748b; border-bottom: 2px solid #e2e8f0;">Median Resp</th>
          </tr>
        </thead>
        <tbody>
          ${stats.agentPerformance.map(agent => `
            <tr>
              <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${agent.name}</td>
              <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${agent.msgsSent.toLocaleString()}</td>
              <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${agent.chatsHandled.toLocaleString()}</td>
              <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${agent.medianResponseMins}m</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="footer" style="text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; font-weight: bold;">
      <br/><br/><strong>Generated by Carbon Car Care</strong>
    </div>
  </div>
</body>
</html>
`;

Deno.serve(async (req) => {
  // Enforce method
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Check auth
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}` && authHeader !== `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (!supabaseUrl || !supabaseServiceKey || !smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      throw new Error("Missing environment variables for Supabase or SMTP");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Calculate dates for the last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log(`Fetching messages between ${yesterday.toISOString()} and ${now.toISOString()}`);

    const CHUNK_SIZE = 1000;
    let allMessages: WhatsAppMessage[] = [];
    let from = 0;

    // Fetch all messages for the last 24 hours (paginated if needed)
    while (true) {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, wa_id, direction, operator_name, created_at')
        .gte('created_at', yesterday.toISOString())
        .lte('created_at', now.toISOString())
        .order('created_at', { ascending: false })
        .range(from, from + CHUNK_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allMessages = allMessages.concat(data);
      if (data.length < CHUNK_SIZE) break;
      from += CHUNK_SIZE;
    }

    console.log(`Found ${allMessages.length} messages.`);

    const stats = computePeriodStats(allMessages);
    const targetDateStr = yesterday.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const htmlContent = generateHtmlTemplate(stats, targetDateStr);

    console.log(`Sending email via SMTP (${smtpHost})...`);
    const info = await transporter.sendMail({
      from: `"Carbon365 Analytics" <${smtpUser}>`,
      to: [
        "chirenj@mysyara.com", 
        "a.govindram@Carbon365.com", 
        "merusha.kisten@Carbon365.com", 
        "Ayodele.Ibraheem@Carbon365.com",
        "funmi.ojo@Carbon365.com"
      ].join(", "),
      subject: `WhatsApp Analytics Report, ${targetDateStr}`,
      html: htmlContent,
    });

    console.log("Message sent: %s", info.messageId);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId, stats }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Error generating report:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
