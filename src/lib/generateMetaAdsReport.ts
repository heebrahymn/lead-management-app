import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ────────────────────────────────────────────────────────
export interface MetaAdsCampaignRow {
  name: string;
  impressions: number;
  reach: number;
  clicks: number;          // Link Clicks
  whatsapp_clicks: number; // WhatsApp Clicks
}

export interface MetaAdsReportData {
  periodLabel: string;
  totalImpressions: number;
  totalReach: number;
  totalClicks: number;
  totalWaClicks: number;
  ctr: number;
  campaigns: MetaAdsCampaignRow[];
  logoBase64?: string;
}

// ─── Color Palette ────────────────────────────────────────────────
const COLORS = {
  primary: [30, 64, 175] as [number, number, number],       // Brand blue
  brandGreen: [0, 128, 55] as [number, number, number],     // Carbon green
  brandBlue: [0, 60, 143] as [number, number, number],      // Carbon blue
  headerBg: [241, 245, 249] as [number, number, number],    // Slate-100
  white: [255, 255, 255] as [number, number, number],
  text: [15, 23, 42] as [number, number, number],           // Slate-900
  muted: [100, 116, 139] as [number, number, number],       // Slate-500
  green: [22, 163, 74] as [number, number, number],
  greenBg: [220, 252, 231] as [number, number, number],     // Green-100
  blue: [37, 99, 235] as [number, number, number],
  blueBg: [219, 234, 254] as [number, number, number],      // Blue-100
  divider: [226, 232, 240] as [number, number, number],     // Slate-200
};

// ─── Font Loader ──────────────────────────────────────────────────
const FONT_NAME = "Montserrat";
let fontsLoaded = false;

async function loadMontserratFonts(doc: jsPDF): Promise<void> {
  if (fontsLoaded) {
    doc.addFont("Montserrat-Regular.ttf", FONT_NAME, "normal");
    doc.addFont("Montserrat-Bold.ttf", FONT_NAME, "bold");
    return;
  }

  const toBase64 = async (url: string): Promise<string> => {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  try {
    const [regularB64, boldB64] = await Promise.all([
      toBase64("/fonts/Montserrat-Regular.ttf"),
      toBase64("/fonts/Montserrat-Bold.ttf"),
    ]);

    doc.addFileToVFS("Montserrat-Regular.ttf", regularB64);
    doc.addFont("Montserrat-Regular.ttf", FONT_NAME, "normal");

    doc.addFileToVFS("Montserrat-Bold.ttf", boldB64);
    doc.addFont("Montserrat-Bold.ttf", FONT_NAME, "bold");

    fontsLoaded = true;
  } catch (err) {
    console.warn("Failed to load Montserrat fonts, falling back to helvetica", err);
  }
}

// ─── Logo Loader Helper ───────────────────────────────────────────
async function fetchLogos(): Promise<{ carbonLogo?: string; yokohamaLogo?: string }> {
  const toBase64 = async (url: string): Promise<string | undefined> => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return undefined;
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  };

  const [carbonLogo, yokohamaLogo] = await Promise.all([
    toBase64("/logo.png"),
    toBase64("/yokohama-logo.png"),
  ]);

  return { carbonLogo, yokohamaLogo };
}

const ALLOWED_CAMPAIGN_NAMES = [
  "zambia - buy 3 get 1 free apr-1-26 campaign",
  "zambia - buy 2 get free gift 11jun26 campaign"
];

function formatCampaignName(name: string): string {
  if (name.toLowerCase().includes("buy 3 get 1 free")) {
    return "Zambia - Buy 3 get 1 free Campaign";
  }
  if (name.toLowerCase().includes("buy 2 get free gift")) {
    return "Zambia - Buy 2 Get Free Gift Campaign";
  }
  return name
    .replace(/APR-1-26\s*/gi, "")
    .replace(/11JUN26\s*/gi, "")
    .trim();
}

// ─── Executive Summary Generator ──────────────────────────────────
function generateExecutiveSummary(data: MetaAdsReportData, activeCampaigns: MetaAdsCampaignRow[], totalImpressions: number, totalReach: number, totalClicks: number, totalWaClicks: number, ctr: number): string {
  const { periodLabel } = data;
  const sentences: string[] = [];

  sentences.push(
    `During the selected period (${periodLabel}), Meta Ads campaigns generated a total of ${totalImpressions.toLocaleString()} impressions and reached ${totalReach.toLocaleString()} unique users across Facebook and Instagram.`
  );

  sentences.push(
    `The channel accumulated ${totalClicks.toLocaleString()} link clicks and driven ${totalWaClicks.toLocaleString()} direct WhatsApp conversations, achieving an overall Click-Through Rate (CTR) of ${ctr.toFixed(2)}%.`
  );

  if (activeCampaigns.length > 0) {
    const sortedByWaClicks = [...activeCampaigns].sort((a, b) => b.whatsapp_clicks - a.whatsapp_clicks);
    const topCampaign = sortedByWaClicks[0];
    if (topCampaign && topCampaign.whatsapp_clicks > 0) {
      const displayName = formatCampaignName(topCampaign.name);
      sentences.push(
        `The top-performing campaign for lead generation was "${displayName}", driving ${topCampaign.whatsapp_clicks.toLocaleString()} WhatsApp clicks, ${topCampaign.clicks.toLocaleString()} link clicks, and ${topCampaign.impressions.toLocaleString()} impressions.`
      );
    }
  }

  return sentences.join(" ");
}

// ─── PDF Generation ───────────────────────────────────────────────
export async function generateMetaAdsReport(data: MetaAdsReportData): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // Filter campaigns strictly to requested allowed list if matched
  const matchedCampaigns = data.campaigns.filter(c =>
    ALLOWED_CAMPAIGN_NAMES.some(allowed => c.name.trim().toLowerCase() === allowed || c.name.trim().toLowerCase().includes(allowed))
  );
  const activeCampaigns = matchedCampaigns.length > 0 ? matchedCampaigns : data.campaigns;

  // Recalculate metrics strictly for allowed campaigns
  const totalImpressions = activeCampaigns.reduce((sum, c) => sum + c.impressions, 0);
  const totalReach = activeCampaigns.reduce((sum, c) => sum + c.reach, 0);
  const totalClicks = activeCampaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalWaClicks = activeCampaigns.reduce((sum, c) => sum + c.whatsapp_clicks, 0);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // ── Load Fonts & Logos ────────────────────────────────────────
  await loadMontserratFonts(doc);
  const font = fontsLoaded ? FONT_NAME : "helvetica";
  const { carbonLogo, yokohamaLogo } = await fetchLogos();

  // ── Helper functions ──────────────────────────────────────────
  const addFooter = () => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont(font, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.text(
        `Generated on ${dateStr} at ${timeStr}  \u2022  Page ${i} of ${pageCount}  \u2022  Confidential \u2014 Carbon Car Care`,
        pageW / 2,
        pageH - 8,
        { align: "center" }
      );
      doc.setDrawColor(...COLORS.divider);
      doc.setLineWidth(0.3);
      doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
    }
  };

  const sectionTitle = (title: string, y: number): number => {
    doc.setFontSize(13);
    doc.setFont(font, "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(title, margin, y);
    doc.setDrawColor(...COLORS.brandGreen);
    doc.setLineWidth(0.6);
    doc.line(margin, y + 1.5, margin + doc.getTextWidth(title), y + 1.5);
    return y + 8;
  };

  const ensureSpace = (needed: number, currentY: number): number => {
    if (currentY + needed > pageH - 22) {
      doc.addPage();
      return 20;
    }
    return currentY;
  };

  // ════════════════════════════════════════════════════════════════
  // Header — Replicating Reference Image Design
  // ════════════════════════════════════════════════════════════════
  // 1. Carbon Logo on Far-Left
  const carbonH = 11.5;
  const carbonY = 9.5;
  if (data.logoBase64 || carbonLogo) {
    try {
      const src = data.logoBase64 || carbonLogo!;
      const carbonW = carbonH * 5.8514; // ~67.3mm
      doc.addImage(src, "PNG", margin, carbonY, carbonW, carbonH);
    } catch {
      // Skip if invalid
    }
  }

  // 2. Yokohama Logo on Far-Right
  const yokohamaH = 15.0;
  const yokohamaY = 7.5;
  if (yokohamaLogo) {
    try {
      const yokohamaW = yokohamaH * 2.5637; // ~38.5mm
      const yokohamaX = pageW - margin - yokohamaW;
      doc.addImage(yokohamaLogo, "PNG", yokohamaX, yokohamaY, yokohamaW, yokohamaH);
    } catch {
      // Skip if invalid
    }
  }

  // 3. Thick Red Accent Line across page
  const redLineY = 25;
  doc.setDrawColor(211, 47, 47); // Brand red
  doc.setLineWidth(1.0);
  doc.line(margin, redLineY, pageW - margin, redLineY);

  // 4. Main Title below Red Line (Left-aligned)
  doc.setFont(font, "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.text);
  doc.text("Meta Ads Performance Report", margin, 33);

  // 5. Metadata Row with top & bottom divider lines
  const metaTopY = 38;
  doc.setDrawColor(...COLORS.divider);
  doc.setLineWidth(0.3);
  doc.line(margin, metaTopY, pageW - margin, metaTopY);

  const metaCols = [
    { label: "PREPARED BY", value: "Carbon Car Care", x: margin },
    { label: "FOR", value: "Yokohama Team", x: margin + 64 },
    { label: "DATE", value: dateStr, x: margin + 128 },
  ];

  metaCols.forEach((col) => {
    doc.setFont(font, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(col.label, col.x, metaTopY + 4.5);

    doc.setFont(font, "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.text);
    doc.text(col.value, col.x, metaTopY + 9.5);
  });

  const metaBottomY = 51;
  doc.line(margin, metaBottomY, pageW - margin, metaBottomY);

  let y = 58;

  // ════════════════════════════════════════════════════════════════
  // 1. Executive Summary Section
  // ════════════════════════════════════════════════════════════════
  y = sectionTitle("Executive Summary", y);

  const summaryText = generateExecutiveSummary(data, activeCampaigns, totalImpressions, totalReach, totalClicks, totalWaClicks, ctr);
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.text);

  const words = summaryText.split(" ");
  let currentX = margin;
  let currentY = y;
  const lineHeight = 4.8;

  words.forEach((word) => {
    const isBold = /\d/.test(word);
    doc.setFont(font, isBold ? "bold" : "normal");
    const wordWidth = doc.getTextWidth(word + " ");

    if (currentX + wordWidth > margin + contentW) {
      currentX = margin;
      currentY += lineHeight;
    }

    doc.text(word, currentX, currentY);
    currentX += wordWidth;
  });

  y = currentY + lineHeight + 8;

  // ════════════════════════════════════════════════════════════════
  // 2. Section for Key Performance Totals (No Spend Data)
  // ════════════════════════════════════════════════════════════════
  y = ensureSpace(45, y);
  y = sectionTitle("Key Performance Totals", y);

  const kpis = [
    { label: "IMPRESSIONS", value: totalImpressions.toLocaleString() },
    { label: "REACH", value: totalReach.toLocaleString() },
    { label: "LINK CLICKS", value: totalClicks.toLocaleString() },
    { label: "WHATSAPP CLICKS", value: totalWaClicks.toLocaleString() },
  ];

  const cardW = (contentW - 9) / 4;
  const cardH = 20;

  kpis.forEach((kpi, i) => {
    const cx = margin + i * (cardW + 3);

    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");

    doc.setFontSize(7);
    doc.setFont(font, "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(kpi.label, cx + 4, y + 7);

    doc.setFontSize(13);
    doc.setFont(font, "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(kpi.value, cx + 4, y + 15);
  });

  y += cardH + 12;

  // ════════════════════════════════════════════════════════════════
  // 3. Campaign Breakdown Section (No Spend Data)
  // Columns: Campaign Name, Impressions, Reach, Link Clicks, WhatsApp Clicks
  // ════════════════════════════════════════════════════════════════
  y = ensureSpace(50, y);
  y = sectionTitle("Campaign Breakdown", y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Campaign Name", "Impressions", "Reach", "Link Clicks", "WhatsApp Clicks"]],
    body: activeCampaigns.length > 0
      ? activeCampaigns.map(c => [
          formatCampaignName(c.name),
          c.impressions.toLocaleString(),
          c.reach.toLocaleString(),
          c.clicks.toLocaleString(),
          c.whatsapp_clicks.toLocaleString(),
        ])
      : [["No campaign data available for this period.", "—", "—", "—", "—"]],
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
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold", textColor: COLORS.brandGreen },
    },
    theme: "plain",
    styles: {
      font: font,
      lineColor: COLORS.divider,
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
  });

  addFooter();

  const fileName = `meta-ads-report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.pdf`;
  doc.save(fileName);
}
