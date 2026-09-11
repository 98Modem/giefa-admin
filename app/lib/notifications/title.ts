export type NotificationTitleSource = {
  title?: string | null;
  message?: string | null;
  type?: string | null;
};

const GENERIC_TITLES = new Set([
  "giefa update",
  "notification",
  "new notification",
  "update",
]);

const LOWERCASE_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "from",
  "has",
  "in",
  "of",
  "on",
  "the",
  "to",
  "was",
]);

function headline(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word, index) => {
      const normalized = word.toLowerCase();

      if (index > 0 && LOWERCASE_WORDS.has(normalized)) return normalized;
      if (/^[A-Z0-9]{2,5}$/.test(word)) return word;

      return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
    })
    .join(" ");
}

function fallbackTitle(message: string, type: string) {
  const source =
    message
      .split(/[.!?]/, 1)[0]
      ?.replace(/^(your|the|a|an)\s+/i, "")
      .replace(/^GIEFA\s+/i, "")
      .trim() || type.replaceAll("_", " ").trim();

  if (!source) return "New Notification";

  const words = source.split(/\s+/);
  const concise = words.length > 7 ? `${words.slice(0, 7).join(" ")}…` : source;

  return headline(concise);
}

export function getNotificationTitle(notification: NotificationTitleSource) {
  const storedTitle = notification.title?.trim() ?? "";

  if (storedTitle && !GENERIC_TITLES.has(storedTitle.toLowerCase())) {
    return storedTitle;
  }

  const message = notification.message?.trim() ?? "";
  const type = notification.type?.trim().toLowerCase() ?? "";
  const context = `${type} ${message}`.toLowerCase();

  if (context.includes("deposit")) {
    if (context.includes("reject")) return "Deposit Proof Rejected";
    if (context.includes("approv") || context.includes("posted")) {
      return "Deposit Proof Approved";
    }
    if (context.includes("submit") || context.includes("finance review")) {
      return "Deposit Proof Submitted";
    }
    return "Deposit Update";
  }

  if (context.includes("emergency")) {
    if (context.includes("reject")) return "Emergency Request Rejected";
    if (context.includes("approv")) return "Emergency Request Approved";
    if (context.includes("submit") || context.includes("request")) {
      return "Emergency Fund Request";
    }
    return "Emergency Fund Update";
  }

  if (context.includes("suspension") || context.includes("suspend")) {
    if (context.includes("restored") || context.includes("rejected")) {
      return "Account Access Restored";
    }
    if (context.includes("remains active") || context.includes("reviewed")) {
      return "Suspension Reviewed";
    }
    return "Account Suspension Update";
  }

  if (context.includes("membership")) {
    if (context.includes("approv")) return "Membership Approved";
    if (context.includes("pending") || context.includes("application")) {
      return "Membership Application";
    }
    return "Membership Update";
  }

  if (context.includes("report")) {
    if (context.includes("variance")) return "Finance Variance Needs Review";
    if (context.includes("edit") && context.includes("request")) {
      return "Finance Report Edit Requested";
    }
    if (context.includes("approv")) return "Finance Report Approved";
    if (context.includes("reject")) return "Finance Report Rejected";
    if (context.includes("applied")) return "Finance Report Edit Applied";
    return "Finance Report Update";
  }

  if (context.includes("role")) return "Role Updated";
  if (context.includes("interest")) return "Interest Allocation Updated";
  if (context.includes("meeting")) return "Meeting Update";

  return fallbackTitle(message, type);
}
