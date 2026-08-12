type PasskeyError = {
  code?: string;
  message?: string;
  name?: string;
};

export type PasskeyRequestOptionsJSON = {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<{
    id: string;
    type?: PublicKeyCredentialType;
    transports?: string[];
  }>;
  userVerification?: UserVerificationRequirement;
  extensions?: AuthenticationExtensionsClientInputs;
  hints?: string[];
};

export type SerializedPasskeyCredential = {
  id: string;
  rawId: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle?: string;
  };
  type: "public-key";
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
  authenticatorAttachment?: AuthenticatorAttachment;
};

export type PreparedPasskeyChallenge = {
  challenge: string;
  challengeId: string;
  expiresAt: number;
};

const PASSKEY_DEVICE_COOKIE = "giefa-passkey-device";
const PASSKEY_DEVICE_MAX_AGE = 365 * 24 * 60 * 60;
const PASSKEY_CHALLENGE_STORAGE = "giefa-passkey-challenges-v1";
const PASSKEY_CHALLENGE_LIMIT = 12;
const passkeyChallengeMemory = new Map<string, PreparedPasskeyChallenge>();

function base64UrlToArrayBuffer(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const decoded = window.atob(padded);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes.buffer;
}

function arrayBufferToBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizePasskeyChallenge(value: string) {
  return value
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function storedPasskeyChallenges() {
  const challenges = new Map(passkeyChallengeMemory);

  if (typeof window === "undefined") return challenges;

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(PASSKEY_CHALLENGE_STORAGE) ?? "[]"
    ) as PreparedPasskeyChallenge[];

    for (const challenge of stored) {
      if (
        challenge &&
        typeof challenge.challenge === "string" &&
        typeof challenge.challengeId === "string" &&
        typeof challenge.expiresAt === "number"
      ) {
        challenges.set(normalizePasskeyChallenge(challenge.challenge), challenge);
      }
    }
  } catch {
    // Private browsing or restricted storage should not disable passkey login.
  }

  return challenges;
}

function savePasskeyChallenges(
  challenges: Map<string, PreparedPasskeyChallenge>
) {
  const active = Array.from(challenges.values())
    .filter((challenge) => challenge.expiresAt > Date.now())
    .sort((left, right) => right.expiresAt - left.expiresAt)
    .slice(0, PASSKEY_CHALLENGE_LIMIT);

  passkeyChallengeMemory.clear();
  for (const challenge of active) {
    passkeyChallengeMemory.set(
      normalizePasskeyChallenge(challenge.challenge),
      challenge
    );
  }

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PASSKEY_CHALLENGE_STORAGE, JSON.stringify(active));
  } catch {
    // The in-memory registry still supports the current tab.
  }
}

export function rememberPasskeyChallenge(
  challenge: PreparedPasskeyChallenge
) {
  const challenges = storedPasskeyChallenges();
  challenges.set(normalizePasskeyChallenge(challenge.challenge), {
    challenge: challenge.challenge,
    challengeId: challenge.challengeId,
    expiresAt: challenge.expiresAt,
  });
  savePasskeyChallenges(challenges);
}

export function getSignedPasskeyChallenge(credential: PublicKeyCredential) {
  try {
    const response = credential.response as AuthenticatorAssertionResponse;
    const clientData = JSON.parse(
      new TextDecoder().decode(response.clientDataJSON)
    ) as { challenge?: unknown };

    return typeof clientData.challenge === "string"
      ? normalizePasskeyChallenge(clientData.challenge)
      : null;
  } catch {
    return null;
  }
}

export function takePasskeyChallengeForCredential(
  credential: PublicKeyCredential,
  fallback: PreparedPasskeyChallenge
) {
  const signedChallenge = getSignedPasskeyChallenge(credential);
  if (!signedChallenge) return null;

  const fallbackChallenge = normalizePasskeyChallenge(fallback.challenge);
  const challenges = storedPasskeyChallenges();
  const matching =
    challenges.get(signedChallenge) ??
    (signedChallenge === fallbackChallenge ? fallback : null);

  if (!matching || matching.expiresAt <= Date.now()) return null;

  challenges.delete(signedChallenge);
  savePasskeyChallenges(challenges);
  return matching;
}

function passkeyCookieDomain() {
  if (typeof window === "undefined") return "";

  const hostname = window.location.hostname.toLowerCase();
  return hostname === "giefa.org" || hostname.endsWith(".giefa.org")
    ? "; Domain=.giefa.org"
    : "";
}

export function isPasskeyEnabledOnThisDevice() {
  if (typeof document === "undefined") return false;

  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === `${PASSKEY_DEVICE_COOKIE}=1`);
}

export function markPasskeyEnabledOnThisDevice() {
  if (typeof document === "undefined") return;

  document.cookie = `${PASSKEY_DEVICE_COOKIE}=1; Path=/; Max-Age=${PASSKEY_DEVICE_MAX_AGE}; SameSite=Lax${passkeyCookieDomain()}${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;
}

export function clearPasskeyDeviceMarker() {
  if (typeof document === "undefined") return;

  document.cookie = `${PASSKEY_DEVICE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${passkeyCookieDomain()}${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;
}

export async function hasPlatformAuthenticator() {
  if (
    typeof window === "undefined" ||
    typeof window.PublicKeyCredential === "undefined"
  ) {
    return false;
  }

  const availabilityCheck =
    window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable;

  if (typeof availabilityCheck !== "function") return false;

  try {
    return await availabilityCheck.call(window.PublicKeyCredential);
  } catch {
    return false;
  }
}

export function parsePasskeyRequestOptions(
  options: PasskeyRequestOptionsJSON
): PublicKeyCredentialRequestOptions {
  const { challenge, allowCredentials, ...remainingOptions } = options;
  const parsed = {
    ...remainingOptions,
    challenge: base64UrlToArrayBuffer(challenge),
  } as PublicKeyCredentialRequestOptions;

  // An absent credential list is important for discoverable passkeys. Do not
  // turn it into an empty list on older Android credential providers.
  if (allowCredentials?.length) {
    parsed.allowCredentials = allowCredentials.map((credential) => ({
      id: base64UrlToArrayBuffer(credential.id),
      type: credential.type ?? "public-key",
      transports: credential.transports as AuthenticatorTransport[] | undefined,
    }));
  }

  return parsed;
}

export function serializePasskeyCredential(
  credential: PublicKeyCredential
): SerializedPasskeyCredential {
  const response = credential.response as AuthenticatorAssertionResponse;
  const credentialWithAttachment = credential as PublicKeyCredential & {
    authenticatorAttachment?: AuthenticatorAttachment | null;
  };

  // Encode the assertion ourselves on every browser. Samsung Chrome exposes
  // PublicKeyCredential.toJSON(), but assertions serialized through that path
  // have repeatedly failed Supabase's challenge comparison. The underlying
  // WebAuthn ArrayBuffers are the signed source of truth and work consistently
  // across Chrome, Firefox, and Safari when encoded directly as base64url.
  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    response: {
      authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      signature: arrayBufferToBase64Url(response.signature),
      userHandle: response.userHandle
        ? arrayBufferToBase64Url(response.userHandle)
        : undefined,
    },
    type: "public-key",
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment:
      credentialWithAttachment.authenticatorAttachment ?? undefined,
  };
}

export function shouldAutomaticallyPromptForPasskey(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent
) {
  const isChromium =
    /(?:Chrome|CriOS|Chromium|Edg|EdgA|EdgiOS|OPR|SamsungBrowser)\//i.test(
      userAgent
    );

  // Chrome's immediate passkey UI requires a user gesture. Starting a modal
  // request during page load can remain invisible and makes the user tap twice.
  // We still prefetch its challenge so the first explicit tap opens the native
  // credential provider without waiting for a network round trip.
  return !isChromium;
}

export function isExistingPasskeyError(error: unknown) {
  const passkeyError = (error ?? {}) as PasskeyError;
  const code = passkeyError.code?.toLowerCase() ?? "";
  const message = passkeyError.message?.toLowerCase() ?? "";

  return (
    code === "webauthn_credential_exists" ||
    code === "error_authenticator_previously_registered" ||
    message.includes("previously registered") ||
    message.includes("already registered")
  );
}

export function isPasskeyVerificationError(error: unknown) {
  const passkeyError = (error ?? {}) as PasskeyError;
  const code = passkeyError.code?.toLowerCase() ?? "";
  const message = passkeyError.message?.toLowerCase() ?? "";

  return (
    code === "webauthn_verification_failed" ||
    code === "webauthn_credential_not_found" ||
    message.includes("credential verification failed")
  );
}

export function isMissingPasskeyError(error: unknown) {
  const passkeyError = (error ?? {}) as PasskeyError;
  const code = passkeyError.code?.toLowerCase() ?? "";

  return code === "webauthn_credential_not_found";
}

export function getPasskeyErrorMessage(error: unknown) {
  const passkeyError = (error ?? {}) as PasskeyError;
  const code = passkeyError.code?.toLowerCase() ?? "";
  const name = passkeyError.name?.toLowerCase() ?? "";
  const message = passkeyError.message?.toLowerCase() ?? "";

  if (code === "passkey_disabled") {
    return "Biometric sign-in is not enabled for this GIEFA deployment yet.";
  }

  if (code === "too_many_passkeys") {
    return "This account has reached its passkey limit. Remove an old device and try again.";
  }

  if (isExistingPasskeyError(error)) {
    return "This device already has a GIEFA passkey.";
  }

  if (isMissingPasskeyError(error)) {
    return "This passkey is no longer connected to your GIEFA account. Sign in with your password, then reconnect this device under Profile → Biometric & passkey sign-in.";
  }

  if (isPasskeyVerificationError(error)) {
    return "Your device responded, but GIEFA could not verify this sign-in request. Please try again or use your password.";
  }

  if (
    code === "webauthn_challenge_expired" ||
    code === "webauthn_challenge_not_found"
  ) {
    return "The biometric request expired. Please try again.";
  }

  if (
    name === "aborterror" ||
    code.includes("ceremony_aborted") ||
    message.includes("timed out")
  ) {
    return "Biometric sign-in was cancelled or took too long. You can try again or use your password.";
  }

  if (
    name === "notallowederror" ||
    message.includes("not allowed") ||
    message.includes("cancel") ||
    message.includes("no passkeys available")
  ) {
    return "Biometric sign-in was cancelled or no GIEFA passkey was available on this device.";
  }

  if (
    code === "error_passthrough_see_cause_property" ||
    message.includes("non-webauthn related error")
  ) {
    return "Your device could not start biometric sign-in. Please try once more, or sign in with your password and reconnect this device in Profile settings.";
  }

  if (message.includes("browser does not support webauthn")) {
    return "This browser does not support biometric or passkey sign-in.";
  }

  return passkeyError.message || "Biometric sign-in could not be completed.";
}
