import { NextResponse } from "next/server";
import { supabaseServer } from "@/app/lib/supabase/server";
import { Role } from "@/app/employee_type/roles";

type AssistantLink = {
  title: string;
  href: string;
  reason: string;
};

type AssistantResponse = {
  answer: string;
  links: AssistantLink[];
};

type MemberContext = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: Role;
  status: string | null;
};

type AssistantHistoryMessage = {
  role: "user" | "assistant";
  text: string;
};

type AiAssistantInput = {
  question: string;
  member: MemberContext;
  role: Role;
  currentPath: string;
  history: AssistantHistoryMessage[];
  financeContext: unknown;
  localNarrative: string;
  destinations: ReturnType<typeof allowedDestinations>;
};

const ALL_ROLES: Role[] = ["admin", "chairman", "general_sec", "treasurer", "member"];
const ADMIN_CHAIRMAN_ROLES: Role[] = ["admin", "chairman"];
const FINANCE_LEADERSHIP_ROLES: Role[] = ["treasurer", "chairman", "admin"];

const ASSISTANT_DESTINATIONS: Array<{
  title: string;
  href: string;
  roles: Role[];
  keywords: string;
}> = [
  {
    title: "Dashboard",
    href: "/dashboard",
    roles: ALL_ROLES,
    keywords: "overview home balances growth contribution summary",
  },
  {
    title: "Upload Deposit Proof",
    href: "/funds/deposit-proof",
    roles: ALL_ROLES,
    keywords: "upload deposit proof payment screenshot receipt contribution scan ocr ai",
  },
  {
    title: "Emergency Fund Balance",
    href: "/account/emergency-fund",
    roles: ALL_ROLES,
    keywords: "emergency fund balance savings available",
  },
  {
    title: "Investment Fund Balance",
    href: "/account/investment-fund",
    roles: ALL_ROLES,
    keywords: "investment fund shares balance interest growth",
  },
  {
    title: "Interest Earned",
    href: "/account/interest",
    roles: ALL_ROLES,
    keywords: "interest earned profit return allocation",
  },
  {
    title: "Request Emergency Funds",
    href: "/funds/request",
    roles: ALL_ROLES,
    keywords: "request emergency money withdrawal assistance",
  },
  {
    title: "My Requests",
    href: "/funds/my-requests",
    roles: ALL_ROLES,
    keywords: "my request status history approval rejected",
  },
  {
    title: "Deposit Reviews",
    href: "/finance/deposit-submissions",
    roles: FINANCE_LEADERSHIP_ROLES,
    keywords: "finance approve reject deposit submissions proof review",
  },
  {
    title: "Statement Reports",
    href: "/finance/statement-reports",
    roles: FINANCE_LEADERSHIP_ROLES,
    keywords: "bank statement upload monthly report extraction unmatched deposits interest",
  },
  {
    title: "Monthly Savings",
    href: "/finance/monthly-savings",
    roles: FINANCE_LEADERSHIP_ROLES,
    keywords: "monthly savings contributions deposits member ledgers finance",
  },
  {
    title: "Interest Growth",
    href: "/finance/interest-growth",
    roles: FINANCE_LEADERSHIP_ROLES,
    keywords: "interest growth returns profit allocation investment finance",
  },
  {
    title: "Financial Reports",
    href: "/finance/reports",
    roles: FINANCE_LEADERSHIP_ROLES,
    keywords: "financial reports analytics finance monthly statement",
  },
  {
    title: "Pending Fund Requests",
    href: "/funds/pending",
    roles: FINANCE_LEADERSHIP_ROLES,
    keywords: "pending emergency fund requests approve reject finance treasurer chairman",
  },
  {
    title: "Approved Fund Requests",
    href: "/funds/approved",
    roles: FINANCE_LEADERSHIP_ROLES,
    keywords: "approved emergency fund requests completed finance treasurer chairman",
  },
  {
    title: "Finance Reports",
    href: "/chairman/finance-reports",
    roles: ADMIN_CHAIRMAN_ROLES,
    keywords: "chairman review finance reports edit approvals monthly close",
  },
  {
    title: "Leadership Role Assignments",
    href: "/chairman/finance-overview",
    roles: ADMIN_CHAIRMAN_ROLES,
    keywords: "assign roles change role appoint chairman treasurer general secretary leadership users",
  },
  {
    title: "Pending Applications",
    href: "/members/pending",
    roles: ["general_sec", "chairman", "admin"],
    keywords: "pending applications approve deny signup members",
  },
  {
    title: "Active Members",
    href: "/members/active",
    roles: ["general_sec", "chairman", "admin"],
    keywords: "active members users approved",
  },
  {
    title: "Suspended Members",
    href: "/members/suspended",
    roles: ["general_sec", "chairman", "admin"],
    keywords: "suspended restore members blocked",
  },
  {
    title: "Activity Logs",
    href: "/governance/activity-logs",
    roles: ADMIN_CHAIRMAN_ROLES,
    keywords: "audit governance activity logs history",
  },
  {
    title: "Users & Roles",
    href: "/system/users",
    roles: ADMIN_CHAIRMAN_ROLES,
    keywords: "admin users roles permissions manage",
  },
  {
    title: "System Permissions",
    href: "/system/permissions",
    roles: ADMIN_CHAIRMAN_ROLES,
    keywords: "permissions access control roles admin chairman system",
  },
  {
    title: "System Audit Logs",
    href: "/system/audit-logs",
    roles: ADMIN_CHAIRMAN_ROLES,
    keywords: "audit logs system history admin chairman",
  },
  {
    title: "System Settings",
    href: "/system/settings",
    roles: ADMIN_CHAIRMAN_ROLES,
    keywords: "settings system configuration admin chairman",
  },
  {
    title: "Profile and Preferences",
    href: "/dashboard/profile",
    roles: ALL_ROLES,
    keywords: "profile avatar photo preferences theme sidebar settings",
  },
];

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function sanitizeQuestion(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 1200);
}

function sanitizePath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/dashboard";
  return value.replace(/[^\w\-/?#=&.]/g, "").slice(0, 200);
}

function sanitizeHistory(value: unknown): AssistantHistoryMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const role = record.role === "assistant" ? "assistant" : "user";
      const text = sanitizeQuestion(record.text);
      return text ? { role, text } : null;
    })
    .filter((item): item is AssistantHistoryMessage => Boolean(item))
    .slice(-8);
}

const GIEFA_ASSISTANT_SYSTEM_PROMPT =
  "You are GIEFA Assistant inside the Graduate Investment and Emergency Fund Association Dashboard. Respond like a capable, calm human operations assistant, not a keyword bot. Read the user's whole paragraph, infer what they mean, and answer the real question first in natural language. If the user asks about their role, status, contribution, report, or where to go, use current_user and finance_context directly before suggesting links. Do not lead with legalistic refusals. Only mention limits when the user asks you to perform a protected action. Help with smart navigation, contribution status, pending approval, suspended status, finance explanations, report preparation, member support, and governance guidance. Use the supplied finance_context when answering finance/report questions. For monthly report narratives, use clear association language: group summary, member deposits, statement movement, interest/variance, exceptions, and next actions. You must not claim to approve, reject, delete, suspend, restore, transfer money, or change records. For protected operations, explain where to go and who must perform it. Only suggest links from the allowed_destinations list. Return JSON only.";

function buildAssistantPayload(input: AiAssistantInput) {
  return {
    question: input.question,
    current_user: {
      name: [input.member.first_name, input.member.last_name].filter(Boolean).join(" "),
      role: input.role,
      status: input.member.status,
    },
    current_page: input.currentPath,
    conversation_history: input.history,
    finance_context: input.financeContext,
    precomputed_finance_narrative: input.localNarrative,
    allowed_destinations: input.destinations.map((destination) => ({
      title: destination.title,
      href: destination.href,
      keywords: destination.keywords,
    })),
    response_shape: {
      answer: "string",
      links: [{ title: "string", href: "string", reason: "string" }],
    },
  };
}

async function callGeminiAssistant(input: AiAssistantInput, fallback: AssistantResponse) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return null;

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.GEMINI_GIEFA_ASSISTANT_MODEL ||
          process.env.GEMINI_FINANCE_REPORT_MODEL ||
          "gemini-3.5-flash",
        system_instruction: GIEFA_ASSISTANT_SYSTEM_PROMPT,
        input: JSON.stringify(buildAssistantPayload(input)),
        generation_config: {
          temperature: 0.45,
          thinking_level: "low",
        },
      }),
    });

    if (!response.ok) return null;

    const result = (await response.json()) as { output_text?: string };
    return parseAssistantOutput(result.output_text ?? "", fallback);
  } catch {
    return null;
  }
}

async function callOpenAIAssistant(input: AiAssistantInput, fallback: AssistantResponse) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.OPENAI_GIEFA_ASSISTANT_MODEL ||
          process.env.OPENAI_DEPOSIT_EXTRACTION_MODEL ||
          "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: GIEFA_ASSISTANT_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(buildAssistantPayload(input)),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "giefa_assistant_response",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                answer: { type: "string" },
                links: {
                  type: "array",
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      href: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["title", "href", "reason"],
                  },
                },
              },
              required: ["answer", "links"],
            },
          },
        },
        max_output_tokens: 700,
      }),
    });

    if (!response.ok) return null;

    const result = await response.json();
    return parseAssistantOutput(extractOutputText(result), fallback);
  } catch {
    return null;
  }
}

function money(value: unknown) {
  return `UGX ${Number(value ?? 0).toLocaleString()}`;
}

function allowedDestinations(role: Role) {
  return ASSISTANT_DESTINATIONS.filter((destination) =>
    destination.roles.includes(role)
  );
}

function scoreDestination(
  destination: (typeof ASSISTANT_DESTINATIONS)[number],
  question: string
) {
  const query = question.toLowerCase();
  const haystack = `${destination.title} ${destination.href} ${destination.keywords}`.toLowerCase();
  const terms = query.split(/\W+/).filter((term) => term.length > 2);
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function roleLabel(role: Role) {
  return role.replace("_", " ");
}

function localAnswer(
  question: string,
  member: MemberContext,
  history: AssistantHistoryMessage[] = []
): AssistantResponse {
  const role = member.role;
  const normalized = question.toLowerCase();
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || "there";
  const previousUserQuestion = [...history]
    .reverse()
    .find((message) => message.role === "user")?.text;
  const destinations = allowedDestinations(role)
    .map((destination) => ({
      destination,
      score: scoreDestination(destination, question),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ destination }) => ({
      title: destination.title,
      href: destination.href,
      reason: "This page looks useful for what you asked.",
    }));

  if (/who are you|what are you|who.*you.*me|why.*feel.*you|are you real|talk.*you|hello|hi\b|hey\b/.test(normalized)) {
    return {
      answer: [
        `I am Ask GIEFA, ${name}. I am here as your dashboard assistant, not as a hidden officer changing records in the background.`,
        "",
        `For you right now, I can read your GIEFA context as a ${roleLabel(role)} and help explain what you are seeing, where to go next, what a status means, or how to phrase finance/report notes.`,
        "",
        "You can talk to me normally. If you say, \"I uploaded proof but my balance has not changed,\" I should explain the finance review flow. If you say, \"where does chairman approve an edit?\" I should take you to the right place.",
      ].join("\n"),
      links: destinations.slice(0, 1),
    };
  }

  if (/same question|again|still|rigid|not natural|same answer|dynamic/.test(normalized)) {
    return {
      answer: [
        "You are right to expect better than a repeated menu answer.",
        previousUserQuestion
          ? `The last thing you asked was: "${previousUserQuestion}". I should treat this as part of the same conversation, not as a fresh keyword search.`
          : "I should treat your message as a conversation, not as a fresh keyword search.",
        "",
        "Ask me the next part directly and I will stay with the context. A good test is to ask \"why?\" or \"what should I do next?\" after a question, and I should continue from the previous meaning.",
      ].join("\n"),
      links: [],
    };
  }

  if (/my role|new role|changed.*role|role.*changed|what.*role|treasurer|chairman|general secretary|general_sec/.test(normalized)) {
    const canManageRoles = role === "admin" || role === "chairman";
    const roleLink = canManageRoles
      ? [
          {
            title: "Leadership Role Assignments",
            href: "/chairman/finance-overview",
            reason: "Chairman/Admin can assign approved members to leadership roles here.",
          },
        ]
      : [
          {
            title: "Dashboard",
            href: "/dashboard",
            reason: "Your dashboard reloads with the menu for your current role.",
          },
        ];

    return {
      answer: [
        `Your account is currently set as ${roleLabel(role)}.`,
        "",
        role === "treasurer"
          ? "That means you should see finance workspaces such as deposit reviews, monthly savings, interest growth, statement reports, and financial reports."
          : role === "chairman"
            ? "That means you can review leadership finance reports, governance activity, and role assignments."
            : role === "admin"
              ? "That means you have the full system role and can manage users, roles, audit logs, settings, and technical corrections."
              : role === "general_sec"
                ? "That means you handle member applications, active/suspended members, and membership governance."
                : "That means you have normal member access for your balances, contributions, proof uploads, and requests.",
        "",
        "If your role was just changed and the sidebar still looks old, refresh the dashboard or sign out and back in so the interface can reload your permissions cleanly.",
      ].join("\n"),
      links: roleLink,
    };
  }

  if (/deposit|proof|receipt|screenshot|upload/.test(normalized)) {
    return {
      answer:
        "Here is the clean contribution flow:\n\n1. Upload the deposit proof from Upload Deposit Proof.\n2. Review the extracted amount, date, reference, sender name, and 30% emergency / 70% investment split.\n3. Send it to finance.\n4. Finance matches it with the bank statement before it becomes part of your ledger.\n\nIf it is still submitted or pending, it is visible as evidence but has not yet changed your balances.",
      links: destinations.length
        ? destinations
        : [
            {
              title: "Upload Deposit Proof",
              href: "/funds/deposit-proof",
              reason: "Members upload payment evidence here.",
            },
          ],
    };
  }

  if (/contribution status|status|pending|submitted|approved|rejected|suspended|approval/.test(normalized)) {
    return {
      answer:
        "Status meaning in GIEFA:\n\nPending approval means the member account exists but leadership has not approved access yet. The next action is for the General Secretary/Admin to review the application.\n\nSubmitted contribution means the member uploaded proof, but finance has not matched it to the bank statement yet.\n\nApproved contribution means finance matched the proof to the bank statement and the member ledger can be updated.\n\nRejected contribution means finance could not confirm the deposit or details were wrong.\n\nSuspended member means dashboard access is blocked until leadership restores the member or completes the suspension review.",
      links: destinations,
    };
  }

  if (/unmatched|statement|report|monthly|bank/.test(normalized)) {
    return {
      answer:
        "Statement reports compare bank statement movement with approved member deposits. Unmatched deposits are bank credits that still need finance review because the system cannot confidently pair them with a member submission.\n\nA good report should explain total statement movement, approved deposits, interest or variance, unmatched items, and the next action for finance/chairman.",
      links: destinations,
    };
  }

  if (/approve|reject|delete|suspend|restore|permission/.test(normalized)) {
    return {
      answer:
        "I can show you where this is handled and explain the next step, but I cannot perform protected actions myself. Approval, rejection, suspension, restoration, deletion, and permission changes must be completed by the authorized role inside the correct page.",
      links: destinations,
    };
  }

  return {
    answer:
      "I am with you. I did not find one exact GIEFA action from that wording, so tell me what happened, what page you are on, and what result you expected. I can then explain the status, suggest the next step, or take you to the right workspace.",
    links: destinations.slice(0, 2),
  };
}

function buildLocalFinanceNarrative(context: Awaited<ReturnType<typeof getFinanceContext>>) {
  if (!context || typeof context !== "object" || !("latest_reports" in context)) return "";

  const latest = context.latest_reports?.[0];
  if (!latest) return "";

  const interest =
    Number(latest.manual_interest_amount ?? latest.calculated_interest_amount ?? 0) || 0;

  return [
    `Latest report: ${latest.reporting_month}.`,
    `Statement movement: ${money(latest.total_deposits)}.`,
    `Approved member deposits: ${money(latest.approved_member_deposits)}.`,
    `Interest/variance: ${money(interest)}.`,
    `Closing balance: ${money(latest.closing_balance)}.`,
    `Exceptions: ${Number(latest.exception_count ?? 0)}.`,
    latest.unmatched_deposits
      ? `Unmatched deposits still need review: ${money(latest.unmatched_deposits)}.`
      : "No unmatched deposit amount is currently recorded for this report.",
  ].join(" ");
}

function parseAssistantOutput(outputText: string, fallback: AssistantResponse) {
  try {
    const parsed = JSON.parse(outputText) as Partial<AssistantResponse>;
    return {
      answer:
        typeof parsed.answer === "string" && parsed.answer.trim()
          ? parsed.answer.trim()
          : fallback.answer,
      links: Array.isArray(parsed.links)
        ? parsed.links
            .filter(
              (link): link is AssistantLink =>
                Boolean(link) &&
                typeof link.title === "string" &&
                typeof link.href === "string" &&
                typeof link.reason === "string"
            )
            .slice(0, 4)
        : fallback.links,
    };
  } catch {
    return fallback;
  }
}

function extractOutputText(response: unknown) {
  if (
    response &&
    typeof response === "object" &&
    "output_text" in response &&
    typeof response.output_text === "string"
  ) {
    return response.output_text;
  }

  if (!response || typeof response !== "object" || !("output" in response)) {
    return "";
  }

  const output = response.output;
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item)) return [];
      const content = item.content;
      if (!Array.isArray(content)) return [];

      return content.map((part) => {
        if (!part || typeof part !== "object" || !("text" in part)) return "";
        return typeof part.text === "string" ? part.text : "";
      });
    })
    .join("\n")
    .trim();
}

async function getFinanceContext(member: MemberContext) {
  const supabase = await supabaseServer();

  if (member.role === "member") {
    const [{ data: emergency }, { data: shares }, { data: deposits }, { data: requests }] =
      await Promise.all([
        supabase
          .from("emergency_funds")
          .select("available,total_contributed,total_withdrawn")
          .eq("member_id", member.id)
          .maybeSingle(),
        supabase
          .from("shares")
          .select("total_amount,total_shares")
          .eq("member_id", member.id)
          .maybeSingle(),
        supabase
          .from("deposit_submissions")
          .select("status, amount, emergency_amount, investment_amount, contribution_month, deposit_date, confidence")
          .eq("member_id", member.id)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("emergency_requests")
          .select("status, amount, created_at")
          .eq("member_id", member.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    return {
      member_status: member.status,
      emergency,
      shares,
      recent_deposit_submissions: deposits ?? [],
      recent_emergency_requests: requests ?? [],
    };
  }

  const [
    { count: pendingDeposits },
    { count: pendingApplications },
    { count: reports },
    { count: editRequests },
    { data: latestReports },
    { data: latestDeposits },
    { data: latestTransactions },
  ] = await Promise.all([
      supabase
        .from("deposit_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted"),
      supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("finance_monthly_reports")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("finance_report_edit_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "requested"),
      supabase
        .from("finance_monthly_reports")
        .select(
          "reporting_month, opening_balance, closing_balance, total_deposits, approved_member_deposits, unmatched_deposits, exception_count, status, notes, manual_interest_amount, calculated_interest_amount, variance_amount, variance_status"
        )
        .order("reporting_month", { ascending: false })
        .limit(3),
      supabase
        .from("deposit_submissions")
        .select("status, amount, emergency_amount, investment_amount, contribution_month, deposit_date, bank_reference, sender_name, confidence")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("bank_statement_transactions")
        .select("transaction_date, description, reference, credit, debit, match_status")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  return {
    member_status: member.status,
    pending_deposit_reviews: pendingDeposits ?? 0,
    pending_member_applications: pendingApplications ?? 0,
    finance_report_count: reports ?? 0,
    pending_report_edit_requests: editRequests ?? 0,
    latest_reports: latestReports ?? [],
    latest_deposit_submissions: latestDeposits ?? [],
    latest_statement_transactions: latestTransactions ?? [],
  };
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const question = sanitizeQuestion(payload.question);
  const currentPath = sanitizePath(payload.currentPath);
  const history = sanitizeHistory(payload.history);
  if (!question) return jsonError("Ask the assistant a question.");

  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return jsonError("You must be signed in to use GIEFA Assistant.", 401);

  const { data: member } = await supabase
    .from("members")
    .select("id, first_name, last_name, role, status")
    .eq("auth_user_id", session.user.id)
    .maybeSingle<MemberContext>();

  if (!member) return jsonError("Your member profile could not be found.", 403);

  const role = member.role;
  const fallback = localAnswer(question, member);
  const destinations = allowedDestinations(role);
  const financeContext = await getFinanceContext(member);
  const localNarrative = buildLocalFinanceNarrative(financeContext);
  const assistantInput: AiAssistantInput = {
    question,
    member,
    role,
    currentPath,
    history,
    financeContext,
    localNarrative,
    destinations,
  };
  const geminiAnswer = await callGeminiAssistant(assistantInput, fallback);

  if (geminiAnswer) {
    return NextResponse.json({ ...geminiAnswer, mode: "ai", provider: "gemini" });
  }

  const openAiAnswer = await callOpenAIAssistant(assistantInput, fallback);

  if (openAiAnswer) {
    return NextResponse.json({ ...openAiAnswer, mode: "ai", provider: "openai" });
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ...fallback,
      answer:
        /report|statement|finance|monthly|unmatched|interest/i.test(question) && localNarrative
          ? `${fallback.answer}\n\n${localNarrative}`
          : fallback.answer,
      mode: "guided",
      note: "No Gemini or OpenAI key is configured, so GIEFA Assistant used built-in guidance.",
    });
  }

  return NextResponse.json({
    ...fallback,
    answer:
      /report|statement|finance|monthly|unmatched|interest/i.test(question) && localNarrative
        ? `${fallback.answer}\n\n${localNarrative}`
        : fallback.answer,
    mode: "guided",
    note: "The configured AI provider was unavailable, so GIEFA Assistant used built-in guidance.",
  });
}

