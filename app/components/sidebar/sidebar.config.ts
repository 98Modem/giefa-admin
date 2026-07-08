import {
  HomeIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  UsersIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { ComponentType, SVGProps } from "react";

/** --------------------
 * Roles
 -------------------- */
import { Role } from "@/app/employee_type/roles";

/** --------------------
 * Types
 -------------------- */
export type SidebarSubItem = {
  title: string;
  href: string;
  roles?: Role[];
};

export type SidebarItem = {
  key: string;
  title: string;
  href?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  roles: Role[];
  subMenu?: SidebarSubItem[];
};

/** --------------------
 * Shared Roles
 -------------------- */
const ALL_ROLES: Role[] = [
  "admin",
  "chairman",
  "general_sec",
  "treasurer",
  "member",
];

const ADMIN_CHAIRMAN_ROLES: Role[] = ["admin", "chairman"];
const FINANCE_LEADERSHIP_ROLES: Role[] = ["treasurer", "chairman", "admin"];

/** --------------------
 * Sidebar Menu Config
 -------------------- */
export const SIDEBAR_MENU: SidebarItem[] = [
  /* =====================
     DASHBOARD (ALL ROLES)
  ===================== */
  {
    key: "dashboard",
    title: "Dashboard",
    href: "/dashboard",
    icon: HomeIcon,
    roles: ALL_ROLES,
  },

  /* =====================
     MY ACCOUNT (ALL ROLES)
  ===================== */
  {
    key: "my-account",
    title: "My Account",
    icon: UsersIcon,
    roles: ALL_ROLES,
    subMenu: [
      {
        title: "Emergency Fund",
        href: "/account/emergency-fund",
      },
      {
        title: "Investment Fund",
        href: "/account/investment-fund",
      },
      {
        title: "Interest Earned",
        href: "/account/interest",
      },
    ],
  },

  /* =====================
     FUNDS (ALL ROLES)
  ===================== */
  {
    key: "member-funds",
    title: "Funds",
    icon: ClipboardDocumentListIcon,
    roles: ALL_ROLES,
    subMenu: [
      {
        title: "Upload Deposit Proof",
        href: "/funds/deposit-proof",
      },
      {
        title: "Request Funds",
        href: "/funds/request",
      },
      {
        title: "My Requests",
        href: "/funds/my-requests",
      },
    ],
  },

  /* =====================
     TREASURER
  ===================== */
  {
    key: "treasurer-funds",
    title: "Member Funds",
    icon: ClipboardDocumentListIcon,
    roles: FINANCE_LEADERSHIP_ROLES,
    subMenu: [
      {
        title: "Pending Requests",
        href: "/funds/pending",
      },
      {
        title: "Approved Requests",
        href: "/funds/approved",
      },
    ],
  },
  {
    key: "finance",
    title: "Finance",
    icon: BanknotesIcon,
    roles: FINANCE_LEADERSHIP_ROLES,
    subMenu: [
      {
        title: "Deposit Reviews",
        href: "/finance/deposit-submissions",
      },
      {
        title: "Monthly Savings",
        href: "/finance/monthly-savings",
      },
      {
        title: "Interest Growth",
        href: "/finance/interest-growth",
      },
      {
        title: "Statement Reports",
        href: "/finance/statement-reports",
      },
      {
        title: "Financial Reports",
        href: "/finance/reports",
      },
    ],
  },

  /* =====================
     GENERAL SECRETARY
  ===================== */
  {
    key: "membership",
    title: "Membership",
    icon: UsersIcon,
    roles: ["general_sec", "chairman", "admin"],
    subMenu: [
      {
        title: "Pending Applications",
        href: "/members/pending",
        roles: ["general_sec", "chairman", "admin"],
      },
      {
        title: "Active Members",
        href: "/members/active",
        roles: ["general_sec", "chairman", "admin"],
      },
      {
        title: "Suspended Members",
        href: "/members/suspended",
        roles: ["general_sec", "chairman", "admin"],
      },
      {
        title: "Schedule Meetings",
        href: "/members/meetings",
        roles: ["general_sec", "chairman", "admin"],
      },
    ],
  },

  /* =====================
     CHAIRMAN
  ===================== */
  {
    key: "chairman-finance",
    title: "Finance Overview",
    icon: ChartBarIcon,
    roles: ADMIN_CHAIRMAN_ROLES,
    subMenu: [
      {
        title: "Overview",
        href: "/chairman/finance-overview",
      },
      {
        title: "Reports",
        href: "/chairman/finance-reports",
      },
    ],
  },
  {
    key: "governance",
    title: "Governance",
    icon: ShieldCheckIcon,
    roles: ADMIN_CHAIRMAN_ROLES,
    subMenu: [
      {
        title: "Activity Logs",
        href: "/governance/activity-logs",
      },
      {
        title: "Deletion Approvals",
        href: "/governance/deletion-approvals",
      },
    ],
  },

  /* =====================
     SYSTEM OVERSIGHT
  ===================== */
  {
    key: "system",
    title: "System",
    icon: Cog6ToothIcon,
    roles: ADMIN_CHAIRMAN_ROLES,
    subMenu: [
      {
        title: "Users & Roles",
        href: "/system/users",
      },
      {
        title: "Permissions",
        href: "/system/permissions",
      },
      {
        title: "Audit Logs",
        href: "/system/audit-logs",
      },
      {
        title: "Settings",
        href: "/system/settings",
      },
    ],
  },
];
