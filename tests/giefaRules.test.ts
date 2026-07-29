import test from "node:test";
import assert from "node:assert/strict";
import {
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
