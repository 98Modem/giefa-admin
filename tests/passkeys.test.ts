import test from "node:test";
import assert from "node:assert/strict";
import {
  getPasskeyErrorMessage,
  isExistingPasskeyError,
  isMissingPasskeyError,
  isPasskeyVerificationError,
  parsePasskeyRequestOptions,
} from "../app/lib/auth/passkeys";

test("explains when passkeys still need deployment configuration", () => {
  assert.equal(
    getPasskeyErrorMessage({ code: "passkey_disabled" }),
    "Biometric sign-in is not enabled for this GIEFA deployment yet."
  );
});

test("decodes Samsung challenges without the native JSON transformer", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { atob: globalThis.atob },
  });

  try {
    const parsed = parsePasskeyRequestOptions({
      challenge: "AQID-_8",
      rpId: "giefa.org",
      allowCredentials: [],
      hints: ["client-device"],
    });

    assert.deepEqual(Array.from(new Uint8Array(parsed.challenge as ArrayBuffer)), [
      1, 2, 3, 251, 255,
    ]);
    assert.equal("allowCredentials" in parsed, false);
    assert.deepEqual(
      (parsed as PublicKeyCredentialRequestOptions & { hints?: string[] }).hints,
      ["client-device"]
    );
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});

test("turns a cancelled biometric prompt into a helpful message", () => {
  assert.equal(
    getPasskeyErrorMessage({ name: "NotAllowedError" }),
    "Biometric sign-in was cancelled or no GIEFA passkey was available on this device."
  );
});

test("turns an aborted or timed-out ceremony into an actionable message", () => {
  assert.equal(
    getPasskeyErrorMessage({
      name: "AbortError",
      message: "Biometric sign-in timed out.",
    }),
    "Biometric sign-in was cancelled or took too long. You can try again or use your password."
  );
});

test("provides recovery guidance for an unlinked device credential", () => {
  assert.equal(
    getPasskeyErrorMessage({ code: "webauthn_credential_not_found" }),
    "This passkey is no longer connected to your GIEFA account. Sign in with your password, then reconnect this device under Profile → Biometric & passkey sign-in."
  );
  assert.equal(
    isMissingPasskeyError({ code: "webauthn_credential_not_found" }),
    true
  );
});

test("keeps a configured device connected after a retryable verification failure", () => {
  assert.equal(
    getPasskeyErrorMessage({ code: "webauthn_verification_failed" }),
    "Your device responded, but GIEFA could not verify this sign-in request. Please try again or use your password."
  );
  assert.equal(
    isMissingPasskeyError({ code: "webauthn_verification_failed" }),
    false
  );
});

test("replaces Samsung's generic WebAuthn failure with retry guidance", () => {
  assert.equal(
    getPasskeyErrorMessage({
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      message: "a Non-Webauthn related error has occurred",
    }),
    "Your device could not start biometric sign-in. Please try once more, or sign in with your password and reconnect this device in Profile settings."
  );
});

test("recognizes credentials that must be reconnected", () => {
  assert.equal(
    isPasskeyVerificationError({ message: "Credential verification failed" }),
    true
  );
});

test("recognizes a passkey already registered on the authenticator", () => {
  assert.equal(
    isExistingPasskeyError({
      code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
    }),
    true
  );
});

test("preserves an unexpected provider message", () => {
  assert.equal(
    getPasskeyErrorMessage({ message: "A provider-specific problem occurred." }),
    "A provider-specific problem occurred."
  );
});
