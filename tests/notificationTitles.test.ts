import test from "node:test";
import assert from "node:assert/strict";
import { getNotificationTitle } from "../app/lib/notifications/title";

test("preserves a meaningful stored notification title", () => {
  assert.equal(
    getNotificationTitle({
      title: "Finance report edit requested",
      message: "Finance requested permission to edit a monthly report.",
    }),
    "Finance report edit requested"
  );
});

test("replaces a generic title with a deposit outcome", () => {
  assert.equal(
    getNotificationTitle({
      title: "GIEFA update",
      message:
        "Your deposit proof was rejected. Please review the finance note and resubmit if needed.",
    }),
    "Deposit Proof Rejected"
  );
});

test("derives titles for legacy emergency and membership notifications", () => {
  assert.equal(
    getNotificationTitle({
      message: "Your emergency fund request was approved.",
    }),
    "Emergency Request Approved"
  );
  assert.equal(
    getNotificationTitle({
      message: "Your GIEFA membership was approved.",
    }),
    "Membership Approved"
  );
});

test("creates a concise heading for an unknown notification category", () => {
  assert.equal(
    getNotificationTitle({
      message: "Your monthly contribution reminder is ready.",
    }),
    "Monthly Contribution Reminder Is Ready"
  );
});
