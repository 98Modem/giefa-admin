import { Role } from "@/app/employee_type/roles";

export const EMERGENCY_MINIMUM_AVAILABLE = 180_000;
export const EMERGENCY_REQUEST_CAP_RATE = 0.5;
export const EMERGENCY_APPROVED_REQUESTS_PER_CYCLE = 2;

export type EmergencyRequestDecision = {
  allowed: boolean;
  maxRequestAmount: number;
  reason?: string;
};

export function evaluateEmergencyRequest(input: {
  available: number;
  requestCycleCount: number;
  requestedAmount: number;
}): EmergencyRequestDecision {
  const available = Math.max(0, Math.floor(input.available));
  const requestCycleCount = Math.max(0, Math.floor(input.requestCycleCount));
  const requestedAmount = Math.max(0, Math.floor(input.requestedAmount));
  const maxRequestAmount = Math.floor(available * EMERGENCY_REQUEST_CAP_RATE);

  if (requestCycleCount === 0 && available < EMERGENCY_MINIMUM_AVAILABLE) {
    return {
      allowed: false,
      maxRequestAmount,
      reason: `Emergency requests open when your emergency balance first reaches UGX ${EMERGENCY_MINIMUM_AVAILABLE.toLocaleString()}.`,
    };
  }

  if (requestCycleCount >= EMERGENCY_APPROVED_REQUESTS_PER_CYCLE) {
    return {
      allowed: false,
      maxRequestAmount,
      reason:
        "You have used your two emergency requests for this cycle. Please refill your emergency fund before requesting again.",
    };
  }

  if (available <= 0 || maxRequestAmount <= 0) {
    return {
      allowed: false,
      maxRequestAmount,
      reason: "You do not have an emergency balance available for withdrawal.",
    };
  }

  if (requestedAmount > maxRequestAmount) {
    return {
      allowed: false,
      maxRequestAmount,
      reason: `You can request up to UGX ${maxRequestAmount.toLocaleString()} today.`,
    };
  }

  return { allowed: true, maxRequestAmount };
}

export function splitAmountAcrossMonths(total: number, count: number) {
  if (count <= 1) return [total];

  const base = Math.floor(total / count);
  const remainder = total - base * count;

  return Array.from({ length: count }, (_, index) =>
    base + (index < remainder ? 1 : 0)
  );
}

function daysInMonth(reportingMonth: string) {
  const [year, month] = reportingMonth.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function dateDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? date.getUTCDate() : 1;
}

export type WeightedInterestMember = {
  memberId: string;
  openingInvestmentBalance: number;
  monthDeposits?: Array<{ amount: number; effectiveDate: string }>;
  monthEmergencyWithdrawals?: Array<{ amount: number; effectiveDate: string }>;
};

export function calculateDailyWeightedInterest(input: {
  reportingMonth: string;
  interestPool: number;
  members: WeightedInterestMember[];
}) {
  const monthDays = daysInMonth(input.reportingMonth);
  const weights = input.members.map((member) => {
    const depositWeight = (member.monthDeposits ?? []).reduce((sum, deposit) => {
      const activeDays = monthDays - dateDay(deposit.effectiveDate) + 1;
      return sum + deposit.amount * Math.max(activeDays, 0);
    }, 0);
    const withdrawalWeight = (member.monthEmergencyWithdrawals ?? []).reduce(
      (sum, withdrawal) => {
        const activeDays = monthDays - dateDay(withdrawal.effectiveDate) + 1;
        return sum + withdrawal.amount * Math.max(activeDays, 0);
      },
      0
    );

    return {
      memberId: member.memberId,
      weight:
        member.openingInvestmentBalance * monthDays +
        depositWeight -
        withdrawalWeight,
    };
  });
  const totalWeight = weights.reduce((sum, member) => sum + Math.max(member.weight, 0), 0);

  return weights.map((member) => {
    const safeWeight = Math.max(member.weight, 0);
    const interest =
      totalWeight > 0 ? (input.interestPool * safeWeight) / totalWeight : 0;

    return {
      memberId: member.memberId,
      weight: safeWeight,
      share: totalWeight > 0 ? safeWeight / totalWeight : 0,
      interest,
    };
  });
}

export function canAssignMemberRole(input: {
  actorRole: Role;
  targetRole: Role;
  nextRole: Role;
  otherApprovedChairmen: number;
}) {
  if (!["admin", "chairman"].includes(input.actorRole)) {
    return {
      allowed: false,
      reason: "Only chairman or admin can assign association roles.",
    };
  }

  if (input.actorRole === "chairman" && input.nextRole === "admin") {
    return {
      allowed: false,
      reason: "Chairman cannot assign the technical admin role.",
    };
  }

  if (
    input.actorRole !== "admin" &&
    input.targetRole === "chairman" &&
    input.nextRole !== "chairman" &&
    input.otherApprovedChairmen < 1
  ) {
    return {
      allowed: false,
      reason:
        "Assign another approved member as chairman before the current chairman changes role.",
    };
  }

  return { allowed: true };
}
