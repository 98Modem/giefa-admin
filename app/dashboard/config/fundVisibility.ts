import { Role } from "@/app/employee_type/roles";

export type FundVisibilityProfile = {
  label: string;
  summary: string;
  personal: boolean;
  collective: boolean;
  memberLedger: boolean;
  approvals: boolean;
  reports: boolean;
  governance: boolean;
  note: string;
};

export const FUND_VISIBILITY: Record<Role, FundVisibilityProfile> = {
  member: {
    label: "Personal banking view",
    summary: "Own savings, fund balances, requests, and safe collective totals.",
    personal: true,
    collective: true,
    memberLedger: false,
    approvals: false,
    reports: false,
    governance: false,
    note:
      "Members can see their own money plus association-level totals for motivation and transparency, without seeing another member's private balance.",
  },
  general_sec: {
    label: "Membership governance view",
    summary:
      "Applications, active/suspended members, meetings, and governance actions.",
    personal: true,
    collective: false,
    memberLedger: false,
    approvals: false,
    reports: false,
    governance: true,
    note:
      "The General Secretary should manage membership status and governance workflow, not operational fund balances.",
  },
  treasurer: {
    label: "Finance operations view",
    summary:
      "Contribution ledgers, emergency requests, fund allocations, and finance reports.",
    personal: true,
    collective: true,
    memberLedger: true,
    approvals: true,
    reports: true,
    governance: false,
    note:
      "The Treasurer owns the financial operating desk: requests, savings, interest, and performance.",
  },
  chairman: {
    label: "Executive oversight view",
    summary:
      "High-level fund health, trends, reports, audit signals, and governance review.",
    personal: true,
    collective: true,
    memberLedger: false,
    approvals: false,
    reports: true,
    governance: true,
    note:
      "The Chairman sees enough to govern and challenge decisions without taking over daily treasury operations.",
  },
  admin: {
    label: "System and finance control view",
    summary:
      "All member, finance, governance, audit, permission, and correction tools.",
    personal: true,
    collective: true,
    memberLedger: true,
    approvals: true,
    reports: true,
    governance: true,
    note:
      "Admin has full system visibility for support, correction, role management, and audit accountability.",
  },
};

export function isTopManagement(role: Role) {
  return role === "admin" || role === "chairman" || role === "treasurer";
}
