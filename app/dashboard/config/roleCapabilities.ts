import { Role } from "@/app/employee_type/roles";

export const ROLE_CAPABILITIES: Record<
  Role,
  {
    canViewFinanceStats: boolean;
    canViewGrowthChart: boolean;
    canViewRequestsTable: boolean;
    canViewFundOverview: boolean;
    canViewActivityFeed: boolean;
    canViewReports: boolean;
  }
> = {
  admin: {
    canViewFinanceStats: true,
    canViewGrowthChart: true,
    canViewRequestsTable: true,
    canViewFundOverview: true,
    canViewActivityFeed: true,
    canViewReports: true,
  },
  chairman: {
    canViewFinanceStats: true,
    canViewGrowthChart: true,
    canViewRequestsTable: false,
    canViewFundOverview: true,
    canViewActivityFeed: true,
    canViewReports: true,
  },
  treasurer: {
    canViewFinanceStats: true,
    canViewGrowthChart: true,
    canViewRequestsTable: true,
    canViewFundOverview: true,
    canViewActivityFeed: true,
    canViewReports: true,
  },
  general_sec: {
    canViewFinanceStats: false,
    canViewGrowthChart: false,
    canViewRequestsTable: false,
    canViewFundOverview: false,
    canViewActivityFeed: true,
    canViewReports: false,
  },
  member: {
    canViewFinanceStats: true, // personal only
    canViewGrowthChart: true,
    canViewRequestsTable: true, // own requests
    canViewFundOverview: true,
    canViewActivityFeed: false,
    canViewReports: false,
  },
};
