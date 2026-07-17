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
  // Simple auth check to ensure only cron or authorized clients can trigger this
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}` && authHeader !== `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Calculate dates for the last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const targetDateYYYYMMDD = yesterday.toISOString().split('T')[0];
    console.log(`Fetching Google Ads metrics for date: ${targetDateYYYYMMDD}`);

    // Fetch Metrics
    const { data: metricsData, error: metricsError } = await supabase
      .from('google_ads_metrics')
      .select('campaign_name, spend, clicks, impressions, conversions')
      .eq('date', targetDateYYYYMMDD);

    if (metricsError) throw metricsError;

    console.log(`Found ${metricsData?.length || 0} metric records.`);

    // Aggregations
    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalConversions = 0;

    const campaignStats: Record<string, any> = {};

    if (metricsData) {
      metricsData.forEach(row => {
        const spend = Number(row.spend) || 0;
        const clicks = Number(row.clicks) || 0;
        const impressions = Number(row.impressions) || 0;
        const conversions = Number(row.conversions) || 0;

        totalSpend += spend;
        totalClicks += clicks;
        totalImpressions += impressions;
        totalConversions += conversions;

        if (!campaignStats[row.campaign_name]) {
          campaignStats[row.campaign_name] = { spend: 0, clicks: 0, impressions: 0, conversions: 0 };
        }
        campaignStats[row.campaign_name].spend += spend;
        campaignStats[row.campaign_name].clicks += clicks;
        campaignStats[row.campaign_name].impressions += impressions;
        campaignStats[row.campaign_name].conversions += conversions;
      });
    }


    const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const overallCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const overallCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;

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
        .header { background: #ffffff; padding: 30px; text-align: center; border-bottom: 4px solid #10b981; }
        .header h1 { margin: 0; color: #0f172a; font-size: 24px; }
        .header p { margin: 10px 0 0 0; color: #64748b; font-size: 14px; }
        .content { padding: 30px; }
        .metrics-table { width: 100%; border-collapse: separate; border-spacing: 15px; margin-bottom: 30px; }
        .metric-card { background: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center; width: 50%; }
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
          <h1>Daily Google Ads Analytics</h1>
          <p>Performance report for ${targetDateStr}</p>
        </div>
        
        <div class="content">
          <h2>Executive Summary</h2>
          <div class="summary-text">
            Over the past 24 hours, Google Ads campaigns generated <strong>${totalConversions.toLocaleString(undefined, {maximumFractionDigits: 2})}</strong> conversions from <strong>${totalClicks.toLocaleString()}</strong> clicks and <strong>${totalImpressions.toLocaleString()}</strong> impressions. Total ad spend was <strong>AED ${totalSpend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>, resulting in an average Cost Per Acquisition (CPA) of <strong>AED ${overallCPA.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong> and a Click-Through Rate (CTR) of <strong>${overallCTR.toFixed(2)}%</strong>.
          </div>

          <h2>Overall Metrics</h2>
          <table class="metrics-table">
            <tr>
              <td class="metric-card">
                <div class="metric-label">Spend</div>
                <div class="metric-value">AED ${totalSpend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
              </td>
              <td class="metric-card">
                <div class="metric-label">Conversions</div>
                <div class="metric-value">${totalConversions.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
              </td>
            </tr>
            <tr>
              <td class="metric-card">
                <div class="metric-label">Clicks / Impressions</div>
                <div class="metric-value" style="font-size: 20px;">${totalClicks.toLocaleString()} / ${totalImpressions.toLocaleString()}</div>
              </td>
              <td class="metric-card">
                <div class="metric-label">CPA / CPC</div>
                <div class="metric-value" style="font-size: 20px;">AED ${overallCPA.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} / AED ${overallCPC.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
              </td>
            </tr>
          </table>

          <h2>Campaign Performance</h2>
          <table class="data-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Spend</th>
                <th>Conversions</th>
                <th>CPA</th>
              </tr>
            </thead>
            <tbody>
              ${sortedCampaigns.length === 0 ? `<tr><td colspan="4" style="text-align: center; padding: 20px;">No campaign data found for this period.</td></tr>` : 
                sortedCampaigns.map(camp => `
                <tr>
                  <td style="font-weight: 500; color: #0f172a;">${camp.name}</td>
                  <td>AED ${camp.spend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td>${camp.conversions.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                  <td>AED ${(camp.conversions > 0 ? camp.spend / camp.conversions : 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
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
      subject: `Google Ads Analytics Report, ${targetDateStr}`,
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
