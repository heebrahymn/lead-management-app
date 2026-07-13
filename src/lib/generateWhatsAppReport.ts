import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ────────────────────────────────────────────────────────
interface PeriodComparisonRow {
  metric: string;
  current: number | string;
  prev: number | string;
  change: string;
}

interface AgentRow {
  agent: string;
  msgsSent: number;
  chats: number;
  avg: number;
  buckets: number[];
  assessment: string;
  rationale: string;
}

interface DayVolumeRow {
  day: string;
  inbound: number;
  outbound: number;
  total: number;
  isWeekend: boolean;
}

interface ResponseBucketRow {
  label: string;
  count: number;
  pct: number;
  prevCount: number;
  prevPct: number;
}

interface WorkingHoursData {
  chatsInWorkingHours: number;
  inHoursMedian: number;
  outOfHoursArrivals: number;
  inHoursLateReply: number;
}

export interface ReportData {
  totalMessages: number;
  totalInbound: number;
  totalOutbound: number;
  leadsSourced: number;
  workingHours: WorkingHoursData;
  periodComparison: PeriodComparisonRow[];
  agentPerformance: AgentRow[];
  chatVolumeByDay: DayVolumeRow[];
  responseTimeBreakdown: ResponseBucketRow[];
  periodDays: number;
  periodLabel: string;
  filterPreset: string;
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
  red: [220, 38, 38] as [number, number, number],
  redBg: [254, 226, 226] as [number, number, number],       // Red-100
  blue: [37, 99, 235] as [number, number, number],
  blueBg: [219, 234, 254] as [number, number, number],      // Blue-100
  orange: [234, 88, 12] as [number, number, number],
  orangeBg: [255, 237, 213] as [number, number, number],    // Orange-100
  grayBg: [243, 244, 246] as [number, number, number],      // Gray-100
  grayText: [107, 114, 128] as [number, number, number],    // Gray-500
  divider: [226, 232, 240] as [number, number, number],     // Slate-200
};

// ─── Font Loader ──────────────────────────────────────────────────
const FONT_NAME = "Montserrat";
let fontsLoaded = false;

async function loadMontserratFonts(doc: jsPDF): Promise<void> {
  if (fontsLoaded) {
    // Fonts already registered in the VFS from a previous call
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
        // Strip the data:…;base64, prefix
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



// ─── Executive Summary Generator ──────────────────────────────────
function generateExecutiveSummary(data: ReportData): string {
  const {
    totalMessages,
    totalInbound,
    totalOutbound,
    leadsSourced,
    workingHours,
    periodComparison,
    agentPerformance,
    chatVolumeByDay,
    periodDays,
  } = data;

  const sentences: string[] = [];

  // 1. Volume overview
  const totalChatsRow = periodComparison.find(r => r.metric === "Total Chats");
  const totalChats = totalChatsRow ? totalChatsRow.current : "—";
  sentences.push(
    `During the selected ${periodDays}-day period, the WhatsApp channel processed ${totalMessages.toLocaleString()} messages across ${totalChats} unique conversations, comprising ${totalInbound.toLocaleString()} inbound and ${totalOutbound.toLocaleString()} outbound messages.`
  );

  // 2. Leads
  if (leadsSourced > 0) {
    sentences.push(
      `The channel sourced ${leadsSourced} new lead${leadsSourced !== 1 ? "s" : ""} during this period.`
    );
  }

  // 3. Period-on-period trend
  const msgRow = periodComparison.find(r => r.metric === "Total Messages");
  if (msgRow) {
    const change = msgRow.change;
    if (change.startsWith("+") && change !== "+0%") {
      sentences.push(`Message volume rose ${change} compared to the previous period, indicating growing engagement.`);
    } else if (change.startsWith("-")) {
      sentences.push(`Message volume declined ${change} versus the prior period.`);
    } else {
      sentences.push(`Message volume remained flat compared to the previous period.`);
    }
  }

  // 4. Response time
  const medianRow = periodComparison.find(r => r.metric === "In-hours Median (mins)");
  if (medianRow) {
    const curr = medianRow.current;
    const prev = medianRow.prev;
    sentences.push(
      `In-hours median response time was ${curr} minute${curr !== 1 ? "s" : ""} (previously ${prev} minute${prev !== 1 ? "s" : ""}).`
    );
  }

  // 5. Best/worst agent
  const ratedAgents = agentPerformance.filter(a => a.assessment !== "Onboarding");
  if (ratedAgents.length > 0) {
    const best = ratedAgents.reduce((a, b) => a.avg <= b.avg ? a : b);
    sentences.push(
      `${best.agent} was the top-performing agent with a ${best.avg}-minute median response across ${best.chats} conversations, earning a "${best.assessment}" rating.`
    );
    const worst = ratedAgents.reduce((a, b) => a.avg >= b.avg ? a : b);
    if (worst.agent !== best.agent) {
      sentences.push(
        `${worst.agent} had the slowest median at ${worst.avg} minute${worst.avg !== 1 ? "s" : ""} ("${worst.assessment}").`
      );
    }
  }

  // 6. Working hours
  if (workingHours.inHoursLateReply > 0) {
    sentences.push(
      `${workingHours.inHoursLateReply} in-hours conversations received a late reply (>30 minutes), an area for improvement.`
    );
  }
  if (workingHours.outOfHoursArrivals > 0) {
    sentences.push(
      `${workingHours.outOfHoursArrivals} inbound messages arrived outside working hours.`
    );
  }

  // 7. Weekend traffic
  const weekendRow = periodComparison.find(r => r.metric === "Total Weekend Chats");
  if (weekendRow && Number(weekendRow.current) > 0) {
    const weekendTotal = chatVolumeByDay
      .filter(d => d.isWeekend)
      .reduce((s, d) => s + d.total, 0);
    const weekendPct = totalMessages > 0 ? Math.round((weekendTotal / totalMessages) * 100) : 0;
    sentences.push(
      `Weekend traffic accounted for ${weekendPct}% of total message volume (${weekendRow.current} unique conversations).`
    );
  }

  return sentences.join(" ");
}

// ─── PDF Generation ───────────────────────────────────────────────
export async function generateWhatsAppReport(data: ReportData): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // ── Load Montserrat Font ──────────────────────────────
  await loadMontserratFonts(doc);
  const font = fontsLoaded ? FONT_NAME : "helvetica";

  // ── Helpers ───────────────────────────────────────────
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
      // Divider line above footer
      doc.setDrawColor(...COLORS.divider);
      doc.setLineWidth(0.3);
      doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
    }
  };

  const sectionTitle = (title: string, y: number): number => {
    doc.setFontSize(14);
    doc.setFont(font, "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(title, margin, y);
    // Accent underline in brand green
    doc.setDrawColor(...COLORS.brandGreen);
    doc.setLineWidth(0.6);
    doc.line(margin, y + 1.5, margin + doc.getTextWidth(title), y + 1.5);
    return y + 8;
  };

  const sectionSubtitle = (text: string, y: number): number => {
    doc.setFontSize(9);
    doc.setFont(font, "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(text, margin, y);
    return y + 5;
  };

  // Safe page-break check: if we're too close to the bottom, add a new page
  const ensureSpace = (needed: number, currentY: number): number => {
    if (currentY + needed > pageH - 22) {
      doc.addPage();
      return 20;
    }
    return currentY;
  };

  // ════════════════════════════════════════════════════════════════
  // PAGE 1 — Cover + Executive Summary + KPIs
  // ════════════════════════════════════════════════════════════════

  // Header — clean white background with logo
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pageW, 44, "F");

  // Green accent stripe at bottom of header
  doc.setFillColor(...COLORS.brandGreen);
  doc.rect(0, 42, pageW, 1.5, "F");
  // Thin blue stripe underneath
  doc.setFillColor(...COLORS.brandBlue);
  doc.rect(0, 43.5, pageW, 0.5, "F");

  // Logo (if provided)
  if (data.logoBase64) {
    try {
      // Logo is wide landscape format (~5:1 ratio), placed left
      doc.addImage(data.logoBase64, "PNG", margin, 5, 52, 11);
    } catch {
      // Silently skip if image is invalid
    }
  }

  // Report title — right-aligned block
  doc.setFont(font, "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.brandBlue);
  doc.text("WhatsApp Analytics Report", pageW - margin, 16, { align: "right" });

  doc.setFontSize(11);
  doc.setFont(font, "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text("Carbon Car Care CRM", pageW - margin, 24, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.brandGreen);
  doc.text(`${dateStr}  \u2022  ${data.periodLabel}`, pageW - margin, 32, { align: "right" });

  let y = 50;

  // Executive Summary
  y = sectionTitle("Executive Summary", y);
  const summary = generateExecutiveSummary(data);
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);

  const words = summary.split(" ");
  let currentX = margin;
  let currentY = y;
  const lineHeight = 5;

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

  // KPI Cards (2×2 grid)
  y = sectionTitle("Key Performance Indicators", y);
  const kpis = [
    { label: "Total Messages", value: data.totalMessages.toLocaleString() },
    { label: "Inbound Messages", value: data.totalInbound.toLocaleString() },
    { label: "Outbound Messages", value: data.totalOutbound.toLocaleString() },
    { label: "Leads Sourced via WA", value: data.leadsSourced.toLocaleString() },
  ];

  const cardW = (contentW - 6) / 2;
  const cardH = 18;
  kpis.forEach((kpi, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = margin + col * (cardW + 6);
    const cy = y + row * (cardH + 4);

    // Card background
    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "F");

    // Label
    doc.setFontSize(8);
    doc.setFont(font, "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(kpi.label.toUpperCase(), cx + 5, cy + 7);

    // Value
    doc.setFontSize(16);
    doc.setFont(font, "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(kpi.value, cx + 5, cy + 14);
  });

  y += 2 * (cardH + 4) + 8;

  // ════════════════════════════════════════════════════════════════
  // Working Hours Analysis (fits on page 1 if space, else page 2)
  // ════════════════════════════════════════════════════════════════
  y = ensureSpace(45, y);
  y = sectionTitle("Working Hours Response Analysis", y);

  const whKpis = [
    { label: "In-hours Chats", value: String(data.workingHours.chatsInWorkingHours) },
    { label: "In-hours Median", value: `${data.workingHours.inHoursMedian} m` },
    { label: "Out-of-hours Arrivals", value: String(data.workingHours.outOfHoursArrivals) },
    { label: "In-hours Late Reply (>30m)", value: String(data.workingHours.inHoursLateReply) },
  ];

  whKpis.forEach((kpi, i) => {
    const col = i % 4;
    const cw = (contentW - 9) / 4;
    const cx = margin + col * (cw + 3);

    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(cx, y, cw, cardH, 2, 2, "F");

    doc.setFontSize(7);
    doc.setFont(font, "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(kpi.label.toUpperCase(), cx + 4, y + 7);

    doc.setFontSize(14);
    doc.setFont(font, "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(kpi.value, cx + 4, y + 14);
  });

  y += cardH + 10;

  // ════════════════════════════════════════════════════════════════
  // Period-on-Period Comparison Table
  // ════════════════════════════════════════════════════════════════
  y = ensureSpace(60, y);
  y = sectionTitle("Period-on-Period Comparison", y);
  y = sectionSubtitle(data.periodLabel, y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Metric", "Current Period", "Previous Period", "Change"]],
    body: data.periodComparison.map(row => [
      row.metric,
      String(row.current),
      String(row.prev),
      row.change,
    ]),
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.text,
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: COLORS.muted },
      1: { halign: "right", fontStyle: "bold" },
      2: { halign: "right", textColor: COLORS.muted },
      3: { halign: "right" },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 3) {
        const val = String(hookData.cell.raw);
        const metric = String(data.periodComparison[hookData.row.index]?.metric ?? "");
        const inverted = [
          "Late-Response Rate (%)",
          "Overall Median (mins)",
          "In-hours Median (mins)",
        ].includes(metric);

        const isPositive = val.startsWith("+") && val !== "+0%";
        const isNegative = val.startsWith("-") && val !== "- 0%";

        if (isPositive) {
          hookData.cell.styles.textColor = inverted ? COLORS.red : COLORS.green;
        } else if (isNegative) {
          hookData.cell.styles.textColor = inverted ? COLORS.green : COLORS.red;
        } else {
          hookData.cell.styles.textColor = COLORS.muted;
        }
      }
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

  y = (doc as any).lastAutoTable.finalY + 10;

  // ════════════════════════════════════════════════════════════════
  // Agent Response Time Table
  // ════════════════════════════════════════════════════════════════
  y = ensureSpace(50, y);
  y = sectionTitle("Agent Response Time (Working Hours)", y);
  y = sectionSubtitle("Performance metrics for the selected period", y);

  const assessmentColor = (assessment: string): { bg: [number, number, number]; text: [number, number, number] } => {
    switch (assessment) {
      case "Top Tier": return { bg: COLORS.greenBg, text: COLORS.green };
      case "Good": return { bg: COLORS.blueBg, text: COLORS.blue };
      case "Need Improvement": return { bg: COLORS.redBg, text: COLORS.red };
      default: return { bg: COLORS.grayBg, text: COLORS.grayText };
    }
  };

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Agent", "Msgs Sent", "Chats", "≤ 5m", "5-15m", "15-30m", "30-60m", "> 60m", "Assessment", "Reason"]],
    body: data.agentPerformance.length > 0
      ? data.agentPerformance.map(row => [
          row.agent,
          String(row.msgsSent),
          String(row.chats),
          row.buckets[0] > 0 ? String(row.buckets[0]) : "—",
          row.buckets[1] > 0 ? String(row.buckets[1]) : "—",
          row.buckets[2] > 0 ? String(row.buckets[2]) : "—",
          row.buckets[3] > 0 ? String(row.buckets[3]) : "—",
          row.buckets[4] > 0 ? String(row.buckets[4]) : "—",
          row.assessment,
          row.rationale,
        ])
      : [["No agent data for this period.", "", "", "", "", "", "", "", "", ""]],
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.text,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.text,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold" },
      3: { textColor: COLORS.green, fontStyle: "bold" },
      7: { textColor: COLORS.red, fontStyle: "bold" },
      8: { halign: "right" },
      9: { halign: "right", fontStyle: "italic", textColor: COLORS.muted, cellWidth: 30 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 8) {
        const val = String(hookData.cell.raw);
        const colors = assessmentColor(val);
        hookData.cell.styles.fillColor = colors.bg;
        hookData.cell.styles.textColor = colors.text;
        hookData.cell.styles.fontStyle = "bold";
      }
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

  y = (doc as any).lastAutoTable.finalY + 10;

  // ════════════════════════════════════════════════════════════════
  // Chat Volume & Timing (Day of Week)
  // ════════════════════════════════════════════════════════════════
  y = ensureSpace(55, y);
  y = sectionTitle("Chat Volume & Timing", y);
  y = sectionSubtitle("Message distribution by day of week", y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Day", "Inbound", "Outbound", "Total"]],
    body: data.chatVolumeByDay.map(row => [
      row.isWeekend ? `${row.day}  ⬤ Weekend` : row.day,
      String(row.inbound),
      String(row.outbound),
      String(row.total),
    ]),
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
      0: { fontStyle: "bold" },
      1: { halign: "right", textColor: COLORS.green, fontStyle: "bold" },
      2: { halign: "right", textColor: COLORS.blue, fontStyle: "bold" },
      3: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 0) {
        const rowIdx = hookData.row.index;
        if (data.chatVolumeByDay[rowIdx]?.isWeekend) {
          hookData.cell.styles.textColor = COLORS.orange;
        } else {
          hookData.cell.styles.textColor = COLORS.muted;
        }
      }
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

  y = (doc as any).lastAutoTable.finalY + 10;

  // ════════════════════════════════════════════════════════════════
  // Response Time Breakdown
  // ════════════════════════════════════════════════════════════════
  y = ensureSpace(50, y);
  y = sectionTitle("Response Time Breakdown (All Hours)", y);
  y = sectionSubtitle("How quickly your team responds", y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Response Time", "Current Count", "Previous Count", "Change"]],
    body: data.responseTimeBreakdown.map((row, i) => {
      const diff = row.count - row.prevCount;
      const label = diff > 0 ? `+${diff}` : diff === 0 ? "0" : `${diff}`;
      return [row.label, String(row.count), String(row.prevCount), label];
    }),
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
      0: { fontStyle: "bold", textColor: COLORS.muted },
      1: { halign: "right", fontStyle: "bold" },
      2: { halign: "right", textColor: COLORS.muted },
      3: { halign: "right" },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 3) {
        const rowIdx = hookData.row.index;
        const row = data.responseTimeBreakdown[rowIdx];
        const diff = row.count - row.prevCount;
        const inverted = rowIdx >= 3; // Slow buckets — increases are bad

        if (diff > 0) {
          hookData.cell.styles.textColor = inverted ? COLORS.red : COLORS.green;
        } else if (diff < 0) {
          hookData.cell.styles.textColor = inverted ? COLORS.green : COLORS.red;
        } else {
          hookData.cell.styles.textColor = COLORS.muted;
        }
      }
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

  // ── Add footers to all pages ─────────────────────────
  addFooter();

  // ── Trigger download ─────────────────────────────────
  const fileName = `whatsapp-analytics-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.pdf`;
  doc.save(fileName);
}
