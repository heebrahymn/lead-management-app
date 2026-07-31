import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as nodemailer from "npm:nodemailer@6.9.11";
import { generateWhatsAppPdfReport } from "../pdf-generators.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const smtpHost = Deno.env.get("SMTP_HOST")!;
const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
const smtpUser = Deno.env.get("SMTP_USER")!;
const smtpPass = Deno.env.get("SMTP_PASS")!;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

const WORKING_HOURS_START = 7;
const WORKING_HOURS_END = 17;

interface WhatsAppMessage {
  id: string;
  wa_id: string;
  direction: string;
  operator_name: string | null;
  created_at: string;
}

function computeWhatsAppStats(messages: WhatsAppMessage[], reportingStartDate: Date, reportingEndDate: Date, nowTime: number) {
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
    const date = new Date(msg.created_at);
    const inWindow = date >= reportingStartDate && date <= reportingEndDate;

    if (!messagesByContact[msg.wa_id]) {
      messagesByContact[msg.wa_id] = [];
    }
    messagesByContact[msg.wa_id].push(msg);

    if (inWindow) {
      uniqueChats.add(msg.wa_id);
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
    }
  });

  const agentStatsMap: Record<string, {
    name: string,
    msgsSent: number,
    responseTimes: number[],
    chats: Set<string>
  }> = {};

  Object.values(messagesByContact).forEach(contactMessages => {
    contactMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let lastInbound: WhatsAppMessage | null = null;

    contactMessages.forEach(msg => {
      const dir = (msg.direction || '').toLowerCase();
      const isInbound = dir.includes('inbound') || dir.includes('received');
      const isOutbound = dir.includes('outbound') || dir.includes('sent');
      const msgTime = new Date(msg.created_at).getTime();
      const inWindow = msgTime >= reportingStartDate.getTime() && msgTime <= reportingEndDate.getTime();

      if (isInbound) {
        lastInbound = msg;
      } else if (isOutbound) {
        const opName = msg.operator_name || 'System / Auto-reply';
        
        if (inWindow) {
          if (!agentStatsMap[opName]) {
            agentStatsMap[opName] = { name: opName, msgsSent: 0, responseTimes: [], chats: new Set() };
          }
          agentStatsMap[opName].msgsSent++;
          agentStatsMap[opName].chats.add(msg.wa_id);
        }

        if (lastInbound) {
          const responseTimeMs = msgTime - new Date(lastInbound.created_at).getTime();
          const mins = Math.round(responseTimeMs / 60000);
          
          if (inWindow) {
            overallResponseTimes.push(mins);
            if (workingHourMsgIds.has(lastInbound.id)) {
              inHoursResponseTimes.push(mins);
              if (!agentStatsMap[opName]) {
                agentStatsMap[opName] = { name: opName, msgsSent: 0, responseTimes: [], chats: new Set() };
              }
              agentStatsMap[opName].responseTimes.push(mins);
              if (mins >= 30) {
                inHoursLateReply++;
              }
            }
          }
          lastInbound = null;
        }
      }
    });

    if (lastInbound) {
      const timeSinceLastInbound = nowTime - new Date(lastInbound.created_at).getTime();
      const hoursSinceLastInbound = timeSinceLastInbound / (1000 * 60 * 60);
      if (hoursSinceLastInbound >= 24) {
        totalNoReply++;
      }
    }
  });

  const calcMedian = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  };

  return {
    totalChats: uniqueChats.size,
    totalMessages: totalInbound + totalOutbound,
    overallMedian: calcMedian(overallResponseTimes),
    inHoursMedian: calcMedian(inHoursResponseTimes),
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

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}` && authHeader !== `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const targetDateYYYYMMDD = yesterday.toISOString().split('T')[0];
    const targetDatePdfStr = yesterday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const CHUNK_SIZE = 1000;
    let allMessages: WhatsAppMessage[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, wa_id, direction, operator_name, created_at')
        .gte('created_at', twoDaysAgo.toISOString())
        .lte('created_at', now.toISOString())
        .order('created_at', { ascending: false })
        .range(from, from + CHUNK_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allMessages = allMessages.concat(data);
      if (data.length < CHUNK_SIZE) break;
      from += CHUNK_SIZE;
    }

    const stats = computeWhatsAppStats(allMessages, yesterday, now, now.getTime());
    const pdfBuffer = generateWhatsAppPdfReport(targetDatePdfStr, stats);
    const testRecipient = "ayodeleheebrahymn@outlook.com";

    console.log(`Sending WhatsApp PDF report email to ${testRecipient}...`);
    const info = await transporter.sendMail({
      from: `"Carbon365 Analytics" <${smtpUser}>`,
      to: testRecipient,
      subject: `WhatsApp Analytics Performance PDF Report — ${targetDatePdfStr}`,
      text: `Hello,\n\nPlease find attached the daily WhatsApp Analytics Performance PDF Report for ${targetDatePdfStr}.\n\nBest regards,\nCarbon Car Care Team`,
      attachments: [
        {
          filename: `WhatsApp_Analytics_Report_${targetDateYYYYMMDD}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("WhatsApp PDF Email sent successfully: ", info.messageId);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error generating WhatsApp PDF report:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
