import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as nodemailer from "npm:nodemailer@6.9.11";
import { jsPDF } from "npm:jspdf@4.2.1";
import autoTable from "npm:jspdf-autotable@5.0.8";
import { CARBON_LOGO_BASE64, YOKOHAMA_LOGO_BASE64 } from "../logos.ts";

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

interface CampaignRow {
  name: string;
  impressions: number;
  clicks: number;
  conversions: number;
}

const COLORS = {
  text: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  brandGreen: [0, 128, 55] as [number, number, number],
  headerBg: [241, 245, 249] as [number, number, number],
  divider: [226, 232, 240] as [number, number, number],
};

function generatePdfReport(targetDateStr: string, campaigns: CampaignRow[]): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;

  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // 1. Carbon Logo on Far-Left
  const carbonH = 11.5;
  const carbonY = 9.5;
  try {
    const carbonW = carbonH * 5.8514;
    doc.addImage(CARBON_LOGO_BASE64, "PNG", margin, carbonY, carbonW, carbonH);
  } catch {
    // Skip if invalid
  }

  // 2. Yokohama Logo on Far-Right
  const yokohamaH = 15.0;
  const yokohamaY = 7.5;
  try {
    const yokohamaW = yokohamaH * 2.5637;
    const yokohamaX = pageW - margin - yokohamaW;
    doc.addImage(YOKOHAMA_LOGO_BASE64, "PNG", yokohamaX, yokohamaY, yokohamaW, yokohamaH);
  } catch {
    // Skip if invalid
  }

  // 3. Thick Red Accent Line
  const redLineY = 25;
  doc.setDrawColor(211, 47, 47);
  doc.setLineWidth(1.0);
  doc.line(margin, redLineY, pageW - margin, redLineY);

  // 4. Main Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.text);
  doc.text("Yokohama \u00D7 Carbon \u2014 Google Ads Performance Report", margin, 33);

  // 5. Red Subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(211, 47, 47);
  doc.text("Yokohama Club Network \u2022 Carbon Car Care", margin, 39);

  // 6. Metadata Row
  const metaTopY = 44;
  doc.setDrawColor(...COLORS.divider);
  doc.setLineWidth(0.3);
  doc.line(margin, metaTopY, pageW - margin, metaTopY);

  const metaCols = [
    { label: "PREPARED BY", value: "Carbon Car Care", x: margin },
    { label: "FOR", value: "Yokohama Team", x: margin + 64 },
    { label: "DATE", value: targetDateStr, x: margin + 128 },
  ];

  metaCols.forEach((col) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(col.label, col.x, metaTopY + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.text);
    doc.text(col.value, col.x, metaTopY + 10.5);
  });

  const metaBottomY = 57;
  doc.line(margin, metaBottomY, pageW - margin, metaBottomY);

  let y = 66;

  // Section Title Helper
  const sectionTitle = (title: string, currentY: number): number => {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(title, margin, currentY);
    doc.setDrawColor(...COLORS.brandGreen);
    doc.setLineWidth(0.6);
    doc.line(margin, currentY + 1.5, margin + doc.getTextWidth(title), currentY + 1.5);
    return currentY + 8;
  };

  // 1. Executive Summary
  y = sectionTitle("Executive Summary", y);

  let summaryText = `During the reporting period (${targetDateStr}), Google Ads campaigns generated a total of ${totalImpressions.toLocaleString()} impressions and ${totalClicks.toLocaleString()} clicks across all active campaign initiatives. This overall activity yielded ${totalConversions.toLocaleString(undefined, { maximumFractionDigits: 1 })} total conversions, achieving an average Click-Through Rate (CTR) of ${ctr.toFixed(2)}%.`;

  if (campaigns.length > 0) {
    const topCampaign = [...campaigns].sort((a, b) => b.conversions - a.conversions)[0];
    if (topCampaign && topCampaign.conversions > 0) {
      summaryText += ` The top-performing campaign by volume was "${topCampaign.name}", delivering ${topCampaign.conversions.toLocaleString(undefined, { maximumFractionDigits: 1 })} conversions, ${topCampaign.clicks.toLocaleString()} clicks, and ${topCampaign.impressions.toLocaleString()} impressions.`;
    }
  }

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);

  const lines = doc.splitTextToSize(summaryText, contentW);
  doc.text(lines, margin, y);
  y += lines.length * 4.8 + 8;

  // 2. Total Impressions, Clicks & Conversions (No Spend)
  y = sectionTitle("Total Impressions, Clicks & Conversions", y);

  const kpis = [
    { label: "TOTAL IMPRESSIONS", value: totalImpressions.toLocaleString() },
    { label: "TOTAL CLICKS", value: totalClicks.toLocaleString() },
    { label: "TOTAL CONVERSIONS", value: totalConversions.toLocaleString(undefined, { maximumFractionDigits: 1 }) },
  ];

  const cardW = (contentW - 8) / 3;
  const cardH = 20;

  kpis.forEach((kpi, i) => {
    const cx = margin + i * (cardW + 4);

    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(kpi.label, cx + 5, y + 7);

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(kpi.value, cx + 5, y + 15);
  });

  y += cardH + 12;

  // 3. Campaign Breakdown Section
  y = sectionTitle("Campaign Breakdown", y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Campaign Name", "Impressions", "Clicks", "Conversions"]],
    body: campaigns.length > 0
      ? campaigns.map(c => [
          c.name,
          c.impressions.toLocaleString(),
          c.clicks.toLocaleString(),
          c.conversions.toLocaleString(undefined, { maximumFractionDigits: 1 }),
        ])
      : [["No campaign data available for this period.", "—", "—", "—"]],
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.text,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", fontStyle: "bold", textColor: COLORS.brandGreen },
    },
    theme: "plain",
    styles: {
      font: "helvetica",
      lineColor: COLORS.divider,
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `Generated on ${targetDateStr}  \u2022  Page ${i} of ${pageCount}  \u2022  Confidential \u2014 Carbon Car Care`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
    doc.setDrawColor(...COLORS.divider);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}` && authHeader !== `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const targetDateYYYYMMDD = yesterday.toISOString().split('T')[0];
    console.log(`Fetching Google Ads PDF metrics for date: ${targetDateYYYYMMDD}`);

    const { data: metricsData, error: metricsError } = await supabase
      .from('google_ads_metrics')
      .select('campaign_name, impressions, clicks, conversions')
      .gte('date', targetDateYYYYMMDD);

    if (metricsError) throw metricsError;

    const campaignMap = new Map<string, CampaignRow>();
    if (metricsData) {
      metricsData.forEach(row => {
        const name = row.campaign_name || "Unknown Campaign";
        const c = campaignMap.get(name) || { name, impressions: 0, clicks: 0, conversions: 0 };
        c.impressions += Number(row.impressions) || 0;
        c.clicks += Number(row.clicks) || 0;
        c.conversions += Number(row.conversions) || 0;
        campaignMap.set(name, c);
      });
    }

    const campaigns = Array.from(campaignMap.values());
    const targetDateStr = yesterday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Generate PDF Buffer
    const pdfBuffer = generatePdfReport(targetDateStr, campaigns);

    // PDF specific recipient list (testing recipient ayodeleheebrahymn@outlook.com)
    const pdfRecipients = "ayodeleheebrahymn@outlook.com";

    console.log(`Sending Google Ads PDF report email to ${pdfRecipients}...`);
    const info = await transporter.sendMail({
      from: `"Carbon365 Analytics" <${smtpUser}>`,
      to: pdfRecipients,
      subject: `Google Ads Performance PDF Report — ${targetDateStr}`,
      text: `Hello,\n\nPlease find attached the daily Google Ads Performance PDF Report for ${targetDateStr}.\n\nBest regards,\nCarbon Car Care Team`,
      attachments: [
        {
          filename: `Google_Ads_Report_${targetDateYYYYMMDD}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("Google Ads PDF Email sent successfully: ", info.messageId);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error generating Google Ads PDF report:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
