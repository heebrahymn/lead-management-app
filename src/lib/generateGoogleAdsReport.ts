import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ────────────────────────────────────────────────────────
export interface GoogleAdsCampaignRow {
  name: string;
  status?: string;
  spend?: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cpa?: number;
}

export interface GoogleAdsReportData {
  periodLabel: string;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  ctr: number;
  cpc: number;
  campaigns: GoogleAdsCampaignRow[];
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

// ─── Executive Summary Generator ──────────────────────────────────
function generateExecutiveSummary(data: GoogleAdsReportData): string {
  const { periodLabel, totalImpressions, totalClicks, totalConversions, ctr, cpc, campaigns } = data;
  const sentences: string[] = [];

  sentences.push(
    `During the selected period (${periodLabel}), Google Ads campaigns generated a total of ${totalImpressions.toLocaleString()} impressions and ${totalClicks.toLocaleString()} clicks across all active campaign initiatives.`
  );

  sentences.push(
    `This overall activity yielded ${totalConversions.toLocaleString(undefined, { maximumFractionDigits: 1 })} total conversions, achieving an average Click-Through Rate (CTR) of ${ctr.toFixed(2)}% and an average Cost Per Click (CPC) of AED ${cpc.toFixed(2)}.`
  );

  if (campaigns.length > 0) {
    const sortedByConversions = [...campaigns].sort((a, b) => b.conversions - a.conversions);
    const topCampaign = sortedByConversions[0];
    if (topCampaign && topCampaign.conversions > 0) {
      sentences.push(
        `The top-performing campaign by volume was "${topCampaign.name}", delivering ${topCampaign.conversions.toLocaleString(undefined, { maximumFractionDigits: 1 })} conversions, ${topCampaign.clicks.toLocaleString()} clicks, and ${topCampaign.impressions.toLocaleString()} impressions.`
      );
    }
  }

  return sentences.join(" ");
}

// ─── PDF Generation ───────────────────────────────────────────────
export async function generateGoogleAdsReport(data: GoogleAdsReportData): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

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
  const logoH = 11; // 11mm height for clean visual balance
  const logoY = 10; // Top position for logos

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

  // 2. Date on Far-Right (replacing Yokohama logo)
  doc.setFont(font, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text("DATE", pageW - margin, 12, { align: "right" });

  doc.setFont(font, "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.text);
  doc.text(dateStr, pageW - margin, 17.5, { align: "right" });

  // 3. Thick Red Accent Line across page
  const redLineY = 24;
  doc.setDrawColor(211, 47, 47); // Brand red matching Yokohama
  doc.setLineWidth(1.0);
  doc.line(margin, redLineY, pageW - margin, redLineY);

  // 4. Main Title below Red Line (Left-aligned)
  doc.setFont(font, "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.text);
  doc.text("Google Ads Performance Report", margin, 32);

  let y = 42;

  // ════════════════════════════════════════════════════════════════
  // 1. Executive Summary Section
  // ════════════════════════════════════════════════════════════════
  y = sectionTitle("Executive Summary", y);

  const summaryText = generateExecutiveSummary(data);
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
  // 2. Section for Total Impressions, Clicks and Conversions
  // ════════════════════════════════════════════════════════════════
  y = ensureSpace(45, y);
  y = sectionTitle("Total Impressions, Clicks & Conversions", y);

  const kpis = [
    { label: "TOTAL IMPRESSIONS", value: data.totalImpressions.toLocaleString() },
    { label: "TOTAL CLICKS", value: data.totalClicks.toLocaleString() },
    { label: "TOTAL CONVERSIONS", value: data.totalConversions.toLocaleString(undefined, { maximumFractionDigits: 1 }) },
  ];

  const cardW = (contentW - 8) / 3;
  const cardH = 20;

  kpis.forEach((kpi, i) => {
    const cx = margin + i * (cardW + 4);

    // Card background box
    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");

    // Label
    doc.setFontSize(7.5);
    doc.setFont(font, "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(kpi.label, cx + 5, y + 7);

    // Value
    doc.setFontSize(15);
    doc.setFont(font, "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(kpi.value, cx + 5, y + 15);
  });

  y += cardH + 12;

  // ════════════════════════════════════════════════════════════════
  // 3. Campaign Breakdown Section
  // Columns: Campaign Name, Impressions, Clicks, Conversions
  // ════════════════════════════════════════════════════════════════
  y = ensureSpace(50, y);
  y = sectionTitle("Campaign Breakdown", y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Campaign Name", "Impressions", "Clicks", "Conversions"]],
    body: data.campaigns.length > 0
      ? data.campaigns.map(c => [
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
      font: font,
      lineColor: COLORS.divider,
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
  });

  // Footer on all pages
  addFooter();

  // Save PDF file
  const fileName = `google-ads-report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.pdf`;
  doc.save(fileName);
}
