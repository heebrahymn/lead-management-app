import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as nodemailer from "npm:nodemailer";

// Setup Supabase Client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Setup Nodemailer
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
  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}` && authHeader !== `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const targetDateYYYYMMDD = yesterday.toISOString().split('T')[0];
    console.log(`Fetching Meta Ads metrics for date: ${targetDateYYYYMMDD}`);

    const { data: metricsData, error: metricsError } = await supabase
      .from('meta_ads_metrics')
      .select('campaign_name, spend, impressions, reach, clicks, whatsapp_clicks, cpm')
      .eq('date', targetDateYYYYMMDD);

    if (metricsError) throw metricsError;

    console.log(`Found ${metricsData?.length || 0} metric records.`);

    // Aggregations
    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalWaClicks = 0;
    let totalReach = 0;

    const campaignStats: Record<string, any> = {};

    if (metricsData) {
      metricsData.forEach(row => {
        const spend = Number(row.spend) || 0;
        const clicks = Number(row.clicks) || 0;
        const impressions = Number(row.impressions) || 0;
        const waClicks = Number(row.whatsapp_clicks) || 0;
        const reach = Number(row.reach) || 0;

        totalSpend += spend;
        totalClicks += clicks;
        totalImpressions += impressions;
        totalWaClicks += waClicks;
        totalReach += reach;

        if (!campaignStats[row.campaign_name]) {
          campaignStats[row.campaign_name] = { spend: 0, clicks: 0, impressions: 0, whatsapp_clicks: 0, reach: 0 };
        }
        campaignStats[row.campaign_name].spend += spend;
        campaignStats[row.campaign_name].clicks += clicks;
        campaignStats[row.campaign_name].impressions += impressions;
        campaignStats[row.campaign_name].whatsapp_clicks += waClicks;
        campaignStats[row.campaign_name].reach += reach;
      });
    }

    const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const overallCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const overallCostPerWaClick = totalWaClicks > 0 ? totalSpend / totalWaClicks : 0;
    const overallCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

    const targetDateStr = yesterday.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Sort campaigns by spend descending
    const sortedCampaigns = Object.entries(campaignStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.spend - a.spend);

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .header { background: #ffffff; padding: 30px; text-align: center; border-bottom: 4px solid #1877F2; }
        .header h1 { margin: 0; color: #0f172a; font-size: 24px; }
        .header p { margin: 10px 0 0 0; color: #64748b; font-size: 14px; }
        .content { padding: 30px; }
        .metrics-table { width: 100%; border-collapse: separate; border-spacing: 15px; margin-bottom: 30px; }
        .metric-card { background: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center; width: 50%; }
        .metric-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #0f172a; margin: 0; }
        h2 { font-size: 18px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-top: 30px; }
        .summary-text { font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-left: 4px solid #1877F2; border-radius: 0 4px 4px 0; }
        .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; }
        .data-table th { text-align: left; padding: 12px 15px; background: #f8fafc; font-size: 13px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        .data-table td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Daily Meta Ads Analytics</h1>
          <p>Performance report for ${targetDateStr}</p>
        </div>
        
        <div class="content">
          <h2>Executive Summary</h2>
          <div class="summary-text">
            Over the past 24 hours, Meta Ads campaigns generated <strong>${totalWaClicks.toLocaleString()}</strong> WhatsApp clicks from <strong>${totalImpressions.toLocaleString()}</strong> impressions, reaching <strong>${totalReach.toLocaleString()}</strong> unique users. Total ad spend was <strong>AED ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>, resulting in a Cost Per WhatsApp Click of <strong>AED ${overallCostPerWaClick.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> and a CPM of <strong>AED ${overallCPM.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
          </div>

          <h2>Overall Metrics</h2>
          <table class="metrics-table">
            <tr>
              <td class="metric-card">
                <div class="metric-label">Spend</div>
                <div class="metric-value">AED ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </td>
              <td class="metric-card">
                <div class="metric-label">WhatsApp Clicks</div>
                <div class="metric-value">${totalWaClicks.toLocaleString()}</div>
              </td>
            </tr>
            <tr>
              <td class="metric-card">
                <div class="metric-label">Reach / Impressions</div>
                <div class="metric-value" style="font-size: 20px;">${totalReach.toLocaleString()} / ${totalImpressions.toLocaleString()}</div>
              </td>
              <td class="metric-card">
                <div class="metric-label">Cost/WA Click / CPC</div>
                <div class="metric-value" style="font-size: 20px;">AED ${overallCostPerWaClick.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / AED ${overallCPC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </td>
            </tr>
          </table>

          <h2>Campaign Performance</h2>
          <table class="data-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Spend</th>
                <th>WA Clicks</th>
                <th>Cost/WA Click</th>
                <th>Reach</th>
              </tr>
            </thead>
            <tbody>
              ${sortedCampaigns.length === 0 ? `<tr><td colspan="5" style="text-align: center; padding: 20px;">No campaign data found for this period.</td></tr>` :
        sortedCampaigns.map(camp => `
                <tr>
                  <td style="font-weight: 500; color: #0f172a;">${camp.name}</td>
                  <td>AED ${camp.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>${camp.whatsapp_clicks.toLocaleString()}</td>
                  <td>AED ${(camp.whatsapp_clicks > 0 ? camp.spend / camp.whatsapp_clicks : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>${camp.reach.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          Generated by Carbon Car Care
        </div>
      </div>
    </body>
    </html>
    `;

    console.log(`Sending email via SMTP (${smtpHost})...`);
    const info = await transporter.sendMail({
      from: `"Carbon365 Analytics" <${smtpUser}>`,
      to: [
        "chirenj@mysyara.com", 
        "a.govindram@Carbon365.com", 
        "merusha.kisten@Carbon365.com", 
        "Ayodele.Ibraheem@Carbon365.com"
      ].join(", "),
      subject: `Meta Ads Analytics Report, ${targetDateStr}`,
      html: htmlContent,
    });

    console.log("Email sent successfully: ", info.messageId);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating report:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
