import { jsPDF } from "npm:jspdf@4.2.1";
import autoTable from "npm:jspdf-autotable@5.0.8";
import { CARBON_LOGO_BASE64, YOKOHAMA_LOGO_BASE64 } from "./logos.ts";

const COLORS = {
  text: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  brandGreen: [0, 128, 55] as [number, number, number],
  headerBg: [241, 245, 249] as [number, number, number],
  divider: [226, 232, 240] as [number, number, number],
  redText: [220, 38, 38] as [number, number, number],
  greenText: [22, 163, 74] as [number, number, number],
};

function addStandardHeader(doc: jsPDF, title: string, targetDateStr: string, pageW: number, margin: number) {
  // 1. Carbon Logo on Far-Left
  const carbonH = 11.5;
  const carbonY = 9.5;
  try {
    const carbonW = carbonH * 5.8514;
    doc.addImage(CARBON_LOGO_BASE64, "PNG", margin, carbonY, carbonW, carbonH);
  } catch {
    // Skip if invalid
  }

  // 2. Date on Far-Right (replacing Yokohama logo)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text("DATE", pageW - margin, 12, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.text);
  doc.text(targetDateStr, pageW - margin, 17.5, { align: "right" });

  // 3. Thick Red Accent Line
  const redLineY = 24;
  doc.setDrawColor(211, 47, 47);
  doc.setLineWidth(1.0);
  doc.line(margin, redLineY, pageW - margin, redLineY);

  // 4. Main Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.text(title, margin, 32);
}

function addStandardFooter(doc: jsPDF, targetDateStr: string, pageW: number, pageH: number, margin: number) {
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
}

function renderSectionTitle(doc: jsPDF, title: string, currentY: number, margin: number): number {
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(title, margin, currentY);
  doc.setDrawColor(...COLORS.brandGreen);
  doc.setLineWidth(0.6);
  doc.line(margin, currentY + 1.5, margin + doc.getTextWidth(title), currentY + 1.5);
  return currentY + 8;
}

// ─── 1. META ADS PDF REPORT GENERATOR ─────────────────────────────
export function generateMetaPdfReport(targetDateStr: string, campaigns: any[]): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;

  addStandardHeader(doc, "Meta Ads Performance Report", targetDateStr, pageW, margin);

  const totalImpressions = campaigns.reduce((sum, c) => sum + (Number(c.impressions) || 0), 0);
  const totalReach = campaigns.reduce((sum, c) => sum + (Number(c.reach) || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (Number(c.clicks) || 0), 0);
  const totalWaClicks = campaigns.reduce((sum, c) => sum + (Number(c.whatsapp_clicks) || 0), 0);
  const totalSpend = campaigns.reduce((sum, c) => sum + (Number(c.spend) || 0), 0);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const costPerWaClick = totalWaClicks > 0 ? totalSpend / totalWaClicks : 0;

  let y = 42;
  y = renderSectionTitle(doc, "Executive Summary", y, margin);

  let summaryText = `During the reporting period (${targetDateStr}), Meta Ads campaigns generated a total of ${totalWaClicks.toLocaleString()} WhatsApp clicks from ${totalImpressions.toLocaleString()} impressions, reaching ${totalReach.toLocaleString()} unique users across Facebook and Instagram. Total ad spend was AED ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, resulting in a Cost Per WhatsApp Click of AED ${costPerWaClick.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} and an overall Click-Through Rate (CTR) of ${ctr.toFixed(2)}%.`;

  if (campaigns.length > 0) {
    const topCampaign = [...campaigns].sort((a, b) => b.whatsapp_clicks - a.whatsapp_clicks)[0];
    if (topCampaign && topCampaign.whatsapp_clicks > 0) {
      summaryText += ` The top-performing campaign for lead generation was "${topCampaign.name}", driving ${topCampaign.whatsapp_clicks.toLocaleString()} WhatsApp clicks, ${topCampaign.clicks.toLocaleString()} link clicks, and ${topCampaign.impressions.toLocaleString()} impressions.`;
    }
  }

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  const lines = doc.splitTextToSize(summaryText, contentW);
  doc.text(lines, margin, y);
  y += lines.length * 4.8 + 8;

  y = renderSectionTitle(doc, "Overall Performance Metrics", y, margin);

  const kpis = [
    { label: "SPEND", value: `AED ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: "WHATSAPP CLICKS", value: totalWaClicks.toLocaleString() },
    { label: "REACH / IMPRESSIONS", value: `${totalReach.toLocaleString()} / ${totalImpressions.toLocaleString()}` },
    { label: "COST/WA CLICK", value: `AED ${costPerWaClick.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  ];

  const cardW = (contentW - 9) / 4;
  const cardH = 20;

  kpis.forEach((kpi, i) => {
    const cx = margin + i * (cardW + 3);
    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(kpi.label, cx + 4, y + 7);

    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(kpi.value, cx + 4, y + 15);
  });

  y += cardH + 12;

  y = renderSectionTitle(doc, "Campaign Performance Breakdown", y, margin);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Campaign Name", "Spend (AED)", "WA Clicks", "Cost/WA Click", "Reach", "Impressions"]],
    body: campaigns.length > 0
      ? campaigns.map(c => [
          c.name,
          Number(c.spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          Number(c.whatsapp_clicks || 0).toLocaleString(),
          c.whatsapp_clicks > 0 ? `AED ${(c.spend / c.whatsapp_clicks).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
          Number(c.reach || 0).toLocaleString(),
          Number(c.impressions || 0).toLocaleString(),
        ])
      : [["No campaign data available for this period.", "—", "—", "—", "—", "—"]],
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.text,
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold" },
      1: { halign: "right" },
      2: { halign: "right", fontStyle: "bold", textColor: COLORS.brandGreen },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    theme: "plain",
    styles: { font: "helvetica", lineColor: COLORS.divider, lineWidth: 0.2 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  addStandardFooter(doc, targetDateStr, pageW, pageH, margin);
  return new Uint8Array(doc.output("arraybuffer"));
}

// ─── 2. GOOGLE ADS PDF REPORT GENERATOR ───────────────────────────
export function generateGooglePdfReport(targetDateStr: string, campaigns: any[]): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;

  addStandardHeader(doc, "Google Ads Performance Report", targetDateStr, pageW, margin);

  const totalImpressions = campaigns.reduce((sum, c) => sum + (Number(c.impressions) || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (Number(c.clicks) || 0), 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + (Number(c.conversions) || 0), 0);
  const totalSpend = campaigns.reduce((sum, c) => sum + (Number(c.spend) || 0), 0);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  let y = 42;
  y = renderSectionTitle(doc, "Executive Summary", y, margin);

  let summaryText = `During the reporting period (${targetDateStr}), Google Ads campaigns generated a total of ${totalConversions.toLocaleString(undefined, { maximumFractionDigits: 1 })} conversions from ${totalClicks.toLocaleString()} clicks and ${totalImpressions.toLocaleString()} impressions. Total ad spend was AED ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, resulting in an average Cost Per Acquisition (CPA) of AED ${cpa.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} and an average Click-Through Rate (CTR) of ${ctr.toFixed(2)}%.`;

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

  y = renderSectionTitle(doc, "Overall Performance Metrics", y, margin);

  const kpis = [
    { label: "SPEND", value: `AED ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: "CONVERSIONS", value: totalConversions.toLocaleString(undefined, { maximumFractionDigits: 1 }) },
    { label: "CLICKS / IMPRESSIONS", value: `${totalClicks.toLocaleString()} / ${totalImpressions.toLocaleString()}` },
    { label: "CPA / CPC", value: `AED ${cpa.toFixed(2)} / AED ${cpc.toFixed(2)}` },
  ];

  const cardW = (contentW - 9) / 4;
  const cardH = 20;

  kpis.forEach((kpi, i) => {
    const cx = margin + i * (cardW + 3);
    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(kpi.label, cx + 4, y + 7);

    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(kpi.value, cx + 4, y + 15);
  });

  y += cardH + 12;

  y = renderSectionTitle(doc, "Campaign Performance Breakdown", y, margin);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Campaign Name", "Spend (AED)", "Conversions", "CPA (AED)", "Clicks", "Impressions"]],
    body: campaigns.length > 0
      ? campaigns.map(c => [
          c.name,
          Number(c.spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          Number(c.conversions || 0).toLocaleString(undefined, { maximumFractionDigits: 1 }),
          c.conversions > 0 ? `AED ${(c.spend / c.conversions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
          Number(c.clicks || 0).toLocaleString(),
          Number(c.impressions || 0).toLocaleString(),
        ])
      : [["No campaign data available for this period.", "—", "—", "—", "—", "—"]],
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.text,
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold" },
      1: { halign: "right" },
      2: { halign: "right", fontStyle: "bold", textColor: COLORS.brandGreen },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    theme: "plain",
    styles: { font: "helvetica", lineColor: COLORS.divider, lineWidth: 0.2 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  addStandardFooter(doc, targetDateStr, pageW, pageH, margin);
  return new Uint8Array(doc.output("arraybuffer"));
}

// ─── 3. WHATSAPP ANALYTICS PDF REPORT GENERATOR ───────────────────
export function generateWhatsAppPdfReport(targetDateStr: string, stats: any): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;

  addStandardHeader(doc, "WhatsApp Analytics Performance Report", targetDateStr, pageW, margin);

  let y = 42;
  y = renderSectionTitle(doc, "Executive Summary", y, margin);

  const summaryText = `Over the past 24 hours (${targetDateStr}), the team processed a total of ${stats.totalMessages.toLocaleString()} messages across ${stats.totalChats.toLocaleString()} unique conversations. We observed an inbound volume of ${stats.totalInbound.toLocaleString()} messages vs an outbound volume of ${stats.totalOutbound.toLocaleString()} messages. During working hours (7 AM - 5 PM), the team maintained a median response time of ${stats.inHoursMedian} minutes.`;

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  const lines = doc.splitTextToSize(summaryText, contentW);
  doc.text(lines, margin, y);
  y += lines.length * 4.8 + 8;

  y = renderSectionTitle(doc, "Key Performance Metrics", y, margin);

  const kpis = [
    { label: "TOTAL MESSAGES", value: stats.totalMessages.toLocaleString() },
    { label: "TOTAL CHATS", value: stats.totalChats.toLocaleString() },
    { label: "INBOUND MESSAGES", value: stats.totalInbound.toLocaleString() },
    { label: "OUTBOUND MESSAGES", value: stats.totalOutbound.toLocaleString() },
  ];

  const cardW = (contentW - 9) / 4;
  const cardH = 20;

  kpis.forEach((kpi, i) => {
    const cx = margin + i * (cardW + 3);
    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(kpi.label, cx + 4, y + 7);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(kpi.value, cx + 4, y + 15);
  });

  y += cardH + 12;

  y = renderSectionTitle(doc, "Working Hours Performance (7 AM - 5 PM)", y, margin);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Metric Parameter", "Value Status"]],
    body: [
      ["Median Response Time", `${stats.inHoursMedian} mins`],
      ["Late Replies (>30m)", `${stats.inHoursLateReply}`],
      ["No Replies (Unanswered >24h)", `${stats.totalNoReply}`],
    ],
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
      0: { halign: "left" },
      1: { halign: "right", fontStyle: "bold" },
    },
    theme: "plain",
    styles: { font: "helvetica", lineColor: COLORS.divider, lineWidth: 0.2 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  y = renderSectionTitle(doc, "Agent Performance Breakdown", y, margin);

  const agentRows = stats.agentPerformance || [];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Agent Name", "Messages Sent", "Chats Handled", "Median Response Time"]],
    body: agentRows.length > 0
      ? agentRows.map((agent: any) => [
          agent.name,
          agent.msgsSent.toLocaleString(),
          agent.chatsHandled.toLocaleString(),
          `${agent.medianResponseMins}m`,
        ])
      : [["No agent activity recorded.", "—", "—", "—"]],
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
    styles: { font: "helvetica", lineColor: COLORS.divider, lineWidth: 0.2 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  addStandardFooter(doc, targetDateStr, pageW, pageH, margin);
  return new Uint8Array(doc.output("arraybuffer"));
}
