import {
  dateLabel,
  getBankStatementTransactions,
  getDepositSubmissions,
  getFinanceInterestAllocations,
  getFinanceMonthlyReports,
  getMemberLookup,
  memberName,
  money,
  sumBy,
} from "@/app/lib/giefa/liveData";

export const dynamic = "force-dynamic";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Row = string[];

function cleanText(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function monthLabel(value: string | null | undefined) {
  if (!value) return "No reporting month";
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function percent(value: number) {
  if (!Number.isFinite(value)) return "0.00%";
  return `${value.toFixed(2)}%`;
}

function escapePdf(value: string) {
  return cleanText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxWidth: number, fontSize: number) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  const approxCharWidth = fontSize * 0.52;
  const maxChars = Math.max(12, Math.floor(maxWidth / approxCharWidth));

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

class PdfDocument {
  private pages: string[][] = [[]];
  private y = PAGE_HEIGHT - MARGIN;

  private get ops() {
    return this.pages[this.pages.length - 1];
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.pages.push([]);
      this.y = PAGE_HEIGHT - MARGIN;
      this.headerContinuation();
    }
  }

  private headerContinuation() {
    this.text("GIEFA Monthly Finance Report", MARGIN, this.y, 9, "F2", "2D3748");
    this.line(MARGIN, this.y - 8, PAGE_WIDTH - MARGIN, this.y - 8, "CBD5E1");
    this.y -= 28;
  }

  text(
    value: string,
    x: number,
    y: number,
    size = 10,
    font: "F1" | "F2" = "F1",
    color = "111827"
  ) {
    this.ops.push(
      `${rgb(color)} BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(value)}) Tj ET`
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, color = "D1D5DB") {
    this.ops.push(
      `${rgb(color)} 0.8 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`
    );
  }

  rect(x: number, y: number, width: number, height: number, color = "F8FAFC") {
    this.ops.push(
      `${rgb(color)} ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`
    );
  }

  title(title: string, subtitle: string) {
    this.text("GRADUATE INVESTMENT AND EMERGENCY FUND ASSOCIATION", MARGIN, this.y, 8, "F2", "2563EB");
    this.y -= 22;
    this.text(title, MARGIN, this.y, 21, "F2", "111827");
    this.y -= 20;
    this.text(subtitle, MARGIN, this.y, 10, "F1", "475569");
    this.y -= 24;
    this.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y, "CBD5E1");
    this.y -= 24;
  }

  section(title: string) {
    this.ensureSpace(34);
    this.text(title, MARGIN, this.y, 13, "F2", "111827");
    this.y -= 16;
    this.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y, "E5E7EB");
    this.y -= 14;
  }

  paragraph(text: string) {
    const lines = wrapText(text, CONTENT_WIDTH, 10);
    this.ensureSpace(lines.length * 14 + 8);
    for (const line of lines) {
      this.text(line, MARGIN, this.y, 10, "F1", "334155");
      this.y -= 14;
    }
    this.y -= 6;
  }

  bullets(items: string[]) {
    for (const item of items) {
      const lines = wrapText(item, CONTENT_WIDTH - 14, 10);
      this.ensureSpace(lines.length * 14 + 4);
      this.text("-", MARGIN, this.y, 10, "F2", "2563EB");
      this.text(lines[0], MARGIN + 14, this.y, 10, "F1", "334155");
      this.y -= 14;
      for (const line of lines.slice(1)) {
        this.text(line, MARGIN + 14, this.y, 10, "F1", "334155");
        this.y -= 14;
      }
      this.y -= 2;
    }
    this.y -= 6;
  }

  metricGrid(metrics: Row) {
    const gap = 10;
    const width = (CONTENT_WIDTH - gap * 3) / 4;
    const height = 62;
    this.ensureSpace(height + 18);
    metrics.forEach((metric, index) => {
      const [label, value, detail] = metric.split("|");
      const x = MARGIN + index * (width + gap);
      const y = this.y - height;
      this.rect(x, y, width, height, "F8FAFC");
      this.line(x, y + height, x + width, y + height, "CBD5E1");
      this.line(x, y, x + width, y, "CBD5E1");
      this.line(x, y, x, y + height, "CBD5E1");
      this.line(x + width, y, x + width, y + height, "CBD5E1");
      this.text(label, x + 10, this.y - 18, 8, "F1", "64748B");
      this.text(value, x + 10, this.y - 36, 13, "F2", "111827");
      this.text(detail, x + 10, this.y - 52, 7, "F1", "64748B");
    });
    this.y -= height + 18;
  }

  table(title: string, columns: string[], rows: Row[], footer?: Row) {
    this.section(title);
    if (rows.length === 0) {
      this.paragraph("No records available for this section.");
      return;
    }

    const colWidth = CONTENT_WIDTH / columns.length;
    const rowHeight = 24;
    this.ensureSpace(rowHeight * 2);
    this.rect(MARGIN, this.y - rowHeight + 6, CONTENT_WIDTH, rowHeight, "EEF2FF");
    columns.forEach((column, index) => {
      this.text(column, MARGIN + index * colWidth + 6, this.y - 10, 8, "F2", "334155");
    });
    this.y -= rowHeight;

    rows.forEach((row) => {
      this.ensureSpace(rowHeight + 4);
      this.line(MARGIN, this.y + 6, PAGE_WIDTH - MARGIN, this.y + 6, "E5E7EB");
      row.forEach((cell, index) => {
        const lines = wrapText(cell, colWidth - 12, 8).slice(0, 2);
        lines.forEach((line, lineIndex) => {
          this.text(line, MARGIN + index * colWidth + 6, this.y - lineIndex * 9 - 8, 8, "F1", "111827");
        });
      });
      this.y -= rowHeight;
    });

    if (footer) {
      this.ensureSpace(rowHeight + 4);
      this.rect(MARGIN, this.y - rowHeight + 6, CONTENT_WIDTH, rowHeight, "F8FAFC");
      footer.forEach((cell, index) => {
        this.text(cell, MARGIN + index * colWidth + 6, this.y - 10, 8, "F2", "111827");
      });
      this.y -= rowHeight + 8;
    } else {
      this.y -= 8;
    }
  }

  render() {
    const objects: string[] = [];
    const addObject = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
    const pagesPlaceholderId = addObject("");
    const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const pageIds: number[] = [];

    this.pages.forEach((ops, index) => {
      const footer = [
        `${rgb("64748B")} BT /F1 8 Tf ${MARGIN.toFixed(2)} 24 Td (GIEFA) Tj ET`,
        `${rgb("64748B")} BT /F1 8 Tf ${(PAGE_WIDTH - MARGIN - 54).toFixed(2)} 24 Td (Page ${index + 1} of ${this.pages.length}) Tj ET`,
      ];
      const content = [...ops, ...footer].join("\n");
      const streamId = addObject(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
      const pageId = addObject(
        `<< /Type /Page /Parent ${pagesPlaceholderId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${streamId} 0 R >>`
      );
      pageIds.push(pageId);
    });

    objects[pagesPlaceholderId - 1] = `<< /Type /Pages /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageIds.length} >>`;

    const header = "%PDF-1.4\n";
    const chunks = [header];
    const offsets = [0];
    let offset = Buffer.byteLength(header, "utf8");

    objects.forEach((body, index) => {
      offsets.push(offset);
      const object = `${index + 1} 0 obj\n${body}\nendobj\n`;
      chunks.push(object);
      offset += Buffer.byteLength(object, "utf8");
    });

    const xrefOffset = offset;
    chunks.push(`xref\n0 ${objects.length + 1}\n`);
    chunks.push("0000000000 65535 f \n");
    for (let index = 1; index <= objects.length; index += 1) {
      chunks.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
    }
    chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return new Uint8Array(Buffer.from(chunks.join(""), "utf8"));
  }
}

function rgb(hex: string) {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

type InsightInput = {
  reportingMonth: string;
  activeMemberCount: number;
  contributorCount: number;
  approvedDeposits: number;
  interestAmount: number;
  openingBalance: number;
  closingBalance: number;
  growthRate: number;
  pendingCount: number;
  exceptionCount: number;
  statementMovement: number;
  varianceStatus: string | null | undefined;
  previousReports: Array<{
    reporting_month: string;
    approved_member_deposits: number | null;
    calculated_interest_amount?: number | null;
    manual_interest_amount?: number | null;
    closing_balance: number | null;
    exception_count: number | null;
  }>;
};

function fallbackFinanceInsights(input: InsightInput) {
  const participation =
    input.activeMemberCount > 0
      ? (input.contributorCount / input.activeMemberCount) * 100
      : 0;
  const previous = input.previousReports.find(
    (report) => report.reporting_month !== input.reportingMonth
  );
  const previousInterest = Number(
    previous?.calculated_interest_amount ?? previous?.manual_interest_amount ?? 0
  );
  const interestTrend =
    previousInterest > 0
      ? ((input.interestAmount - previousInterest) / previousInterest) * 100
      : null;
  const insights = [
    `Participation is ${percent(participation)} (${input.contributorCount} of ${input.activeMemberCount || "all"} approved members). Finance should follow up with inactive members before the next contribution window closes.`,
    `The fund earned ${money(input.interestAmount)} this month, equal to ${percent(input.growthRate)} of opening balance. This should be reviewed against the SBG statement before the report is finalized.`,
    interestTrend === null
      ? "There is not enough prior-month return data to calculate a reliable month-on-month interest trend."
      : `Interest changed by ${percent(interestTrend)} compared with the previous available report, so leadership should check whether the change came from higher balances, late deposits, or market movement.`,
    input.pendingCount > 0
      ? `${input.pendingCount} pending deposit proof item(s) are excluded from member ledgers and interest allocation until finance approves them.`
      : "There are no pending deposit proofs for this month, reducing reconciliation risk.",
  ];

  if (input.exceptionCount > 0 || input.varianceStatus === "deposit_exceeds_statement") {
    insights.push(
      "The report has exceptions or a variance flag. It can be generated for review, but chairman/admin should approve corrections before final presentation."
    );
  }

  return insights;
}

async function generateFinanceInsights(input: InsightInput) {
  const fallback = fallbackFinanceInsights(input);
  const geminiInsights = await generateGeminiFinanceInsights(input);

  if (geminiInsights.length > 0) return geminiInsights;

  return generateOpenAIFinanceInsights(input, fallback);
}

async function generateGeminiFinanceInsights(input: InsightInput) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return [];

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.GEMINI_FINANCE_REPORT_MODEL ||
          process.env.GEMINI_GIEFA_ASSISTANT_MODEL ||
          "gemini-3.5-flash",
        system_instruction:
          "You are GIEFA's finance reporting assistant. Produce concise governance-safe insights for a savings cooperative monthly report. Do not give investment advice or promises. Focus on participation, reconciliation, variance risk, cashflow discipline, and leadership next actions. Return 4 to 6 plain bullet sentences only.",
        input: JSON.stringify({
          reporting_month: input.reportingMonth,
          active_member_count: input.activeMemberCount,
          contributor_count: input.contributorCount,
          approved_deposits: input.approvedDeposits,
          statement_movement: input.statementMovement,
          interest_amount: input.interestAmount,
          opening_balance: input.openingBalance,
          closing_balance: input.closingBalance,
          growth_rate_percent: input.growthRate,
          pending_proofs: input.pendingCount,
          exception_count: input.exceptionCount,
          variance_status: input.varianceStatus,
          previous_reports: input.previousReports.slice(0, 6),
        }),
        generation_config: {
          temperature: 0.35,
          thinking_level: "low",
        },
      }),
    });

    if (!response.ok) return [];

    const result = (await response.json()) as {
      output_text?: string;
    };
    return parseInsightLines(result.output_text);
  } catch {
    return [];
  }
}

async function generateOpenAIFinanceInsights(input: InsightInput, fallback: string[]) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return fallback;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.OPENAI_FINANCE_REPORT_MODEL ||
          process.env.OPENAI_GIEFA_ASSISTANT_MODEL ||
          "gpt-4o-mini",
        input: [
          {
            role: "system",
            content:
              "You are GIEFA's finance reporting assistant. Produce concise governance-safe insights for a savings cooperative monthly report. Do not give investment advice or promises. Focus on participation, reconciliation, variance risk, cashflow discipline, and leadership next actions. Return 4 to 6 plain bullet sentences only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              reporting_month: input.reportingMonth,
              active_member_count: input.activeMemberCount,
              contributor_count: input.contributorCount,
              approved_deposits: input.approvedDeposits,
              statement_movement: input.statementMovement,
              interest_amount: input.interestAmount,
              opening_balance: input.openingBalance,
              closing_balance: input.closingBalance,
              growth_rate_percent: input.growthRate,
              pending_proofs: input.pendingCount,
              exception_count: input.exceptionCount,
              variance_status: input.varianceStatus,
              previous_reports: input.previousReports.slice(0, 6),
            }),
          },
        ],
        max_output_tokens: 420,
      }),
    });

    if (!response.ok) return fallback;

    const result = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ text?: string }>;
      }>;
    };
    const text =
      result.output_text ??
      result.output
        ?.flatMap((item) => item.content ?? [])
        .map((content) => content.text ?? "")
        .join("\n");
    const insights = parseInsightLines(text);

    return insights.length > 0 ? insights : fallback;
  } catch {
    return fallback;
  }
}

function parseInsightLines(text: string | null | undefined) {
  return cleanText(text)
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedMonth = url.searchParams.get("month");
  const [reports, members, submissions] = await Promise.all([
    getFinanceMonthlyReports(),
    getMemberLookup(),
    getDepositSubmissions(),
  ]);
  const report =
    reports.find((item) => item.reporting_month === requestedMonth) ?? reports[0];

  if (!report) {
    return new Response("No finance report available", { status: 404 });
  }

  const [allocations, transactions] = await Promise.all([
    getFinanceInterestAllocations(report.id),
    getBankStatementTransactions(report.statement_import_id ?? undefined),
  ]);

  const activeMembers = Object.values(members).filter(
    (member) => member.status === "approved"
  );
  const approvedMonthSubmissions = submissions.filter(
    (submission) =>
      submission.status === "approved" &&
      submission.contribution_month === report.reporting_month
  );
  const pendingMonthSubmissions = submissions.filter(
    (submission) =>
      submission.contribution_month === report.reporting_month &&
      (submission.status === "submitted" || submission.status === "needs_review")
  );
  const contributorIds = new Set(
    approvedMonthSubmissions.map((submission) => submission.member_id)
  );

  const openingBalance = Number(report.opening_balance ?? 0);
  const closingBalance = Number(report.closing_balance ?? 0);
  const approvedDeposits = Number(report.approved_member_deposits ?? 0);
  const statementMovement = Number(report.total_deposits ?? 0);
  const interestAmount = Number(
    report.calculated_interest_amount ??
      report.manual_interest_amount ??
      Math.max(statementMovement - approvedDeposits, 0)
  );
  const periodicReturn = closingBalance - openingBalance;
  const growthRate = openingBalance > 0 ? (interestAmount / openingBalance) * 100 : 0;
  const participationRate =
    activeMembers.length > 0 ? (contributorIds.size / activeMembers.length) * 100 : 0;
  const preparedBy = memberName(members[report.prepared_by ?? ""]) || "Finance Team";
  const aiInsights = await generateFinanceInsights({
    reportingMonth: report.reporting_month,
    activeMemberCount: activeMembers.length,
    contributorCount: contributorIds.size,
    approvedDeposits,
    interestAmount,
    openingBalance,
    closingBalance,
    growthRate,
    pendingCount: pendingMonthSubmissions.length,
    exceptionCount: Number(report.exception_count ?? 0),
    statementMovement,
    varianceStatus: report.variance_status,
    previousReports: reports,
  });

  const pdf = new PdfDocument();
  pdf.title(
    `Monthly Finance Report: ${monthLabel(report.reporting_month)}`,
    `Treasurer: ${preparedBy} | Status: ${report.status ?? "draft"} | Generated: ${dateLabel(report.created_at)}`
  );
  pdf.metricGrid([
    `Contributors|${contributorIds.size} / ${activeMembers.length}|${percent(participationRate)} participation`,
    `Member deposits|${money(approvedDeposits)}|Approved and posted`,
    `Investment return|${money(interestAmount)}|${percent(growthRate)} monthly growth`,
    `Closing NAV|${money(closingBalance)}|SBG statement value`,
  ]);

  pdf.section("Group Summary");
  pdf.bullets([
    `Total members contributing this month: ${contributorIds.size}`,
    `Total approved deposits received: ${money(approvedDeposits)}`,
    "Investment status: funds are tracked against the SBG Securities Uganda Money Market Fund statement.",
    "Managed by: SBG Securities Uganda Limited.",
  ]);

  pdf.table(
    `Member Contributions - ${monthLabel(report.reporting_month)}`,
    ["Member", "Date", "Amount", "Emergency", "Investment", "Reference"],
    approvedMonthSubmissions.map((submission) => [
      memberName(members[submission.member_id]),
      submission.deposit_date ? dateLabel(submission.deposit_date) : "No date",
      money(submission.amount),
      money(submission.emergency_amount),
      money(submission.investment_amount),
      submission.bank_reference ?? "No reference",
    ]),
    [
      "Total",
      "",
      money(sumBy(approvedMonthSubmissions, (row) => row.amount)),
      money(sumBy(approvedMonthSubmissions, (row) => row.emergency_amount)),
      money(sumBy(approvedMonthSubmissions, (row) => row.investment_amount)),
      "",
    ]
  );

  pdf.table(
    "Fund Performance",
    ["Metric", "Value"],
    [
      ["Opening Balance", money(openingBalance)],
      ["New Approved Deposits", money(approvedDeposits)],
      ["Closing Balance (NAV)", money(closingBalance)],
      ["Periodic Return", money(periodicReturn)],
      ["Return / Profit Earned", money(interestAmount)],
      ["Monthly Fund Growth Rate", percent(growthRate)],
      ["Net Asset Value (NAV)", money(closingBalance)],
    ]
  );

  pdf.table(
    "Daily Weighted Interest Allocation",
    ["Member", "Opening Base", "Month Deposits", "Weight", "Interest"],
    allocations.map((allocation) => [
      memberName(members[allocation.member_id]),
      money(allocation.opening_investment_balance),
      money(allocation.month_investment_deposits),
      percent((allocation.allocation_weight ?? 0) * 100),
      money(allocation.interest_amount),
    ]),
    allocations.length
      ? [
          "Total",
          money(sumBy(allocations, (row) => row.opening_investment_balance)),
          money(sumBy(allocations, (row) => row.month_investment_deposits)),
          "100.00%",
          money(sumBy(allocations, (row) => row.interest_amount)),
        ]
      : undefined
  );

  pdf.table(
    "Statement Reconciliation",
    ["Date", "Narration", "Credit", "Reference", "Match"],
    transactions.slice(0, 16).map((transaction) => [
      transaction.transaction_date ? dateLabel(transaction.transaction_date) : "No date",
      transaction.description ?? "No narration",
      money(transaction.credit),
      transaction.reference ?? "No reference",
      transaction.match_status ?? "unmatched",
    ])
  );

  pdf.section("AI Advisory Insights");
  pdf.bullets(aiInsights);
  pdf.paragraph(
    "These AI-assisted insights are for governance review and should be confirmed by finance and leadership before member communication or final approval."
  );

  pdf.section("Issues and Notes");
  pdf.bullets([
    `Participation: ${contributorIds.size} of ${activeMembers.length || "all"} approved members contributed in ${monthLabel(report.reporting_month)}.`,
    `Interest allocation: ${money(interestAmount)} is distributed by each member's daily weighted investment balance.`,
    `Pending proof: ${pendingMonthSubmissions.length} submission(s) remain visible for finance follow-up but are not posted until approved.`,
    report.variance_status === "deposit_exceeds_statement"
      ? "Chairman attention: approved deposits exceed statement movement. The report requires leadership review."
      : "Statement variance is within the current report status.",
  ]);

  if (report.notes) {
    pdf.paragraph(`Finance notes: ${report.notes}`);
  }

  const bytes = pdf.render();
  const filename = `giefa-monthly-finance-report-${report.reporting_month}.pdf`;

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
