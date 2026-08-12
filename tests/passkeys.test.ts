import test from "node:test";
import assert from "node:assert/strict";
import { getPasskeyErrorMessage } from "../app/lib/auth/passkeys";

test("explains when passkeys still need deployment configuration", () => {
  assert.equal(
    getPasskeyErrorMessage({ code: "passkey_disabled" }),
    "Biometric sign-in is not enabled for this GIEFA deployment yet."
  );
});

test("turns a cancelled biometric prompt into a helpful message", () => {
  assert.equal(
    getPasskeyErrorMessage({ name: "NotAllowedError" }),
    "Biometric sign-in was cancelled or timed out."
  );
});

test("provides recovery guidance for an unlinked device credential", () => {
  assert.equal(
    getPasskeyErrorMessage({ code: "webauthn_credential_not_found" }),
    "This passkey is no longer linked to your GIEFA account. Use your password and enable it again."
  );
});

test("preserves an unexpected provider message", () => {
  assert.equal(
    getPasskeyErrorMessage({ message: "A provider-specific problem occurred." }),
    "A provider-specific problem occurred."
  );
});
