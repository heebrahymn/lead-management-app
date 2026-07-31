import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as nodemailer from "npm:nodemailer@6.9.11";
import { generateMetaPdfReport } from "../pdf-generators.ts";

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

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}` && authHeader !== `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const targetDateYYYYMMDD = yesterday.toISOString().split('T')[0];
    const targetDatePdfStr = yesterday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    console.log(`Fetching Meta Ads PDF metrics for date: ${targetDateYYYYMMDD}`);

    const { data: metricsData, error: metricsError } = await supabase
      .from('meta_ads_metrics')
      .select('campaign_name, spend, impressions, reach, clicks, whatsapp_clicks')
      .gte('date', targetDateYYYYMMDD);

    if (metricsError) throw metricsError;

    const campaignMap = new Map<string, any>();
    if (metricsData) {
      metricsData.forEach(row => {
        const name = row.campaign_name || "Unknown Campaign";
        const c = campaignMap.get(name) || { name, spend: 0, impressions: 0, reach: 0, clicks: 0, whatsapp_clicks: 0 };
        c.spend += Number(row.spend) || 0;
        c.impressions += Number(row.impressions) || 0;
        c.reach += Number(row.reach) || 0;
        c.clicks += Number(row.clicks) || 0;
        c.whatsapp_clicks += Number(row.whatsapp_clicks) || 0;
        campaignMap.set(name, c);
      });
    }

    const campaigns = Array.from(campaignMap.values()).sort((a, b) => b.spend - a.spend);
    const pdfBuffer = generateMetaPdfReport(targetDatePdfStr, campaigns);
    const testRecipient = "ayodeleheebrahymn@outlook.com";

    console.log(`Sending Meta Ads PDF report email to ${testRecipient}...`);
    const info = await transporter.sendMail({
      from: `"Carbon365 Analytics" <${smtpUser}>`,
      to: testRecipient,
      subject: `Meta Ads Performance PDF Report — ${targetDatePdfStr}`,
      text: `Hello,\n\nPlease find attached the daily Meta Ads Performance PDF Report for ${targetDatePdfStr}.\n\nBest regards,\nCarbon Car Care Team`,
      attachments: [
        {
          filename: `Meta_Ads_Report_${targetDateYYYYMMDD}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("Meta Ads PDF Email sent successfully: ", info.messageId);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error generating Meta Ads PDF report:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
