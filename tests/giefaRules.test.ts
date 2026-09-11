import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateApprovedSubmissionTotal,
  calculateDailyWeightedInterest,
  canAssignMemberRole,
  evaluateEmergencyRequest,
  splitAmountAcrossMonths,
} from "../app/lib/giefa/rules";

test("first emergency request opens only after the minimum refill trigger", () => {
  const decision = evaluateEmergencyRequest({
    available: 179_999,
    requestCycleCount: 0,
    requestedAmount: 50_000,
  });

  assert.equal(decision.allowed, false);
  assert.match(decision.reason ?? "", /180,000/);
});

test("second emergency request can proceed below the refill trigger but still respects the 50 percent cap", () => {
  const allowed = evaluateEmergencyRequest({
    available: 100_000,
    requestCycleCount: 1,
    requestedAmount: 50_000,
  });
  const blocked = evaluateEmergencyRequest({
    available: 100_000,
    requestCycleCount: 1,
    requestedAmount: 50_001,
  });

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.maxRequestAmount, 50_000);
  assert.equal(blocked.allowed, false);
});

test("third emergency request is blocked until a new refill cycle starts", () => {
  const decision = evaluateEmergencyRequest({
    available: 400_000,
    requestCycleCount: 2,
    requestedAmount: 100_000,
  });

  assert.equal(decision.allowed, false);
  assert.match(decision.reason ?? "", /two emergency requests/);
});

test("deposit splits distribute remainders predictably across selected months", () => {
  assert.deepEqual(splitAmountAcrossMonths(100_001, 3), [33_334, 33_334, 33_333]);
  assert.deepEqual(splitAmountAcrossMonths(200_000, 1), [200_000]);
});

test("approved deposit total remains zero when no approved submissions exist", () => {
  assert.equal(calculateApprovedSubmissionTotal([]), 0);
  assert.equal(calculateApprovedSubmissionTotal([{ amount: null }]), 0);
});

test("approved deposit total comes only from persisted submission amounts", () => {
  assert.equal(
    calculateApprovedSubmissionTotal([
      { amount: 100_000 },
      { amount: 200_000 },
    ]),
    300_000
  );
});

test("finance report production paths contain no February demo deposit seed", () => {
  const actionSource = readFileSync(
    new URL("../app/actions/financeReports.ts", import.meta.url),
    "utf8"
  );
  const pageSource = readFileSync(
    new URL("../app/finance/statement-reports/page.tsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(actionSource, /reportingMonth\s*===\s*["']2026-02["']/);
  assert.doesNotMatch(pageSource, /["']2026-02["']\s*:\s*300_?000/);
});

test("public deposit-confirmation examples contain only fictional fallback identifiers", () => {
  const emailSource = readFileSync(
    new URL("../app/lib/email/depositConfirmation.ts", import.meta.url),
    "utf8"
  );
  const productionExample = readFileSync(
    new URL("../.env.production.example", import.meta.url),
    "utf8"
  );
  const loginSource = readFileSync(
    new URL("../app/login/page.tsx", import.meta.url),
    "utf8"
  );

  assert.match(emailSource, /DEMO-ACCOUNT-NOT-CONFIGURED/);
  assert.match(emailSource, /DEMO-MONEY-MARKET-NOT-CONFIGURED/);
  assert.match(emailSource, /DEMO SAVINGS GROUP — NOT A REAL ACCOUNT/);
  assert.match(emailSource, /deposits@example\.invalid/);
  assert.doesNotMatch(
    emailSource,
    /env\("SBG_(?:GROUP|MONEY_MARKET)_ACCOUNT_NUMBER"\)\s*\|\|\s*"\d{8,}"/
  );
  assert.doesNotMatch(
    productionExample,
    /^SBG_(?:GROUP|MONEY_MARKET)_ACCOUNT_NUMBER=\d{8,}$/m
  );
  assert.match(productionExample, /deposits@example\.invalid/);
  assert.match(productionExample, /support@example\.invalid/);
  assert.match(loginSource, /placeholder="member@example\.invalid"/);
});

test("daily weighted interest gives earlier money more weight than late-month money", () => {
  const allocations = calculateDailyWeightedInterest({
    reportingMonth: "2026-07",
    interestPool: 10_000,
    members: [
      { memberId: "a", openingInvestmentBalance: 400_000 },
      {
        memberId: "b",
        openingInvestmentBalance: 0,
        monthDeposits: [{ amount: 400_000, effectiveDate: "2026-07-16" }],
      },
    ],
  });

  assert.equal(allocations.length, 2);
  assert.ok(allocations[0].interest > allocations[1].interest);
  assert.equal(Math.round(allocations[0].interest + allocations[1].interest), 10_000);
});

test("daily weighted interest reduces a member weight after emergency withdrawal", () => {
  const [member] = calculateDailyWeightedInterest({
    reportingMonth: "2026-07",
    interestPool: 10_000,
    members: [
      {
        memberId: "a",
        openingInvestmentBalance: 400_000,
        monthEmergencyWithdrawals: [{ amount: 100_000, effectiveDate: "2026-07-16" }],
      },
    ],
  });

  assert.equal(member.share, 1);
  assert.equal(member.interest, 10_000);
  assert.equal(member.weight, 10_800_000);
});

test("role assignment protects chairman continuity and admin boundary", () => {
  assert.equal(
    canAssignMemberRole({
      actorRole: "chairman",
      targetRole: "member",
      nextRole: "admin",
      otherApprovedChairmen: 1,
    }).allowed,
    false
  );
  assert.equal(
    canAssignMemberRole({
      actorRole: "chairman",
      targetRole: "chairman",
      nextRole: "treasurer",
      otherApprovedChairmen: 0,
    }).allowed,
    false
  );
  assert.equal(
    canAssignMemberRole({
      actorRole: "admin",
      targetRole: "chairman",
      nextRole: "general_sec",
      otherApprovedChairmen: 0,
    }).allowed,
    true
  );
});
