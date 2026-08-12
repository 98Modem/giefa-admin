import test from "node:test";
import assert from "node:assert/strict";
import {
  getPasskeyErrorMessage,
  getSignedPasskeyChallenge,
  isExistingPasskeyError,
  isMissingPasskeyError,
  isPasskeyVerificationError,
  parsePasskeyRequestOptions,
  rememberPasskeyChallenge,
  serializePasskeyCredential,
  shouldAutomaticallyPromptForPasskey,
  takePasskeyChallengeForCredential,
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

test("serializes Samsung assertions from signed buffers instead of native toJSON", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let nativeSerializerCalled = false;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { btoa: globalThis.btoa },
  });

  try {
    const credential = {
      id: "credential-id",
      rawId: new Uint8Array([1, 2, 3]).buffer,
      response: {
        authenticatorData: new Uint8Array([4, 5]).buffer,
        clientDataJSON: new Uint8Array([251, 255]).buffer,
        signature: new Uint8Array([6, 7]).buffer,
        userHandle: new Uint8Array([8]).buffer,
      },
      type: "public-key",
      authenticatorAttachment: "platform",
      getClientExtensionResults: () => ({}),
      toJSON: () => {
        nativeSerializerCalled = true;
        throw new Error("Native serializer must not be used");
      },
    } as unknown as PublicKeyCredential;

    assert.deepEqual(serializePasskeyCredential(credential), {
      id: "credential-id",
      rawId: "AQID",
      response: {
        authenticatorData: "BAU",
        clientDataJSON: "-_8",
        signature: "Bgc",
        userHandle: "CA",
      },
      type: "public-key",
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    });
    assert.equal(nativeSerializerCalled, false);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});

test("prepares Chrome on Android for one-tap sign-in without a blocked auto prompt", () => {
  const chromeAndroid =
    "Mozilla/5.0 (Linux; Android 16; SM-S921B) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36";
  const firefoxAndroid =
    "Mozilla/5.0 (Android 16; Mobile; rv:142.0) Gecko/142.0 Firefox/142.0";
  const safariIPhone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile Safari/604.1";

  assert.equal(shouldAutomaticallyPromptForPasskey(chromeAndroid), false);
  assert.equal(shouldAutomaticallyPromptForPasskey(firefoxAndroid), true);
  assert.equal(shouldAutomaticallyPromptForPasskey(safariIPhone), true);
});

test("verifies an overlapping Chrome assertion with the challenge it actually signed", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new Map<string, string>();
  const olderChallenge = {
    challenge: "b2xkZXItY2hhbGxlbmdl",
    challengeId: "older-challenge-id",
    expiresAt: Date.now() + 60_000,
  };
  const newerChallenge = {
    challenge: "bmV3ZXItY2hhbGxlbmdl",
    challengeId: "newer-challenge-id",
    expiresAt: Date.now() + 60_000,
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });

  try {
    rememberPasskeyChallenge(olderChallenge);
    rememberPasskeyChallenge(newerChallenge);

    const credential = {
      response: {
        clientDataJSON: new TextEncoder().encode(
          JSON.stringify({ challenge: olderChallenge.challenge })
        ).buffer,
      },
    } as unknown as PublicKeyCredential;

    assert.equal(
      getSignedPasskeyChallenge(credential),
      olderChallenge.challenge
    );
    assert.deepEqual(
      takePasskeyChallengeForCredential(credential, newerChallenge),
      olderChallenge
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
