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

const PASSKEY_DEVICE_COOKIE = "giefa-passkey-device";
const PASSKEY_DEVICE_MAX_AGE = 365 * 24 * 60 * 60;

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
  const credentialConstructor = PublicKeyCredential as typeof PublicKeyCredential & {
    parseRequestOptionsFromJSON?: (
      value: PasskeyRequestOptionsJSON
    ) => PublicKeyCredentialRequestOptions;
  };

  if (typeof credentialConstructor.parseRequestOptionsFromJSON === "function") {
    return credentialConstructor.parseRequestOptionsFromJSON(options);
  }

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
  const credentialWithJson = credential as PublicKeyCredential & {
    toJSON?: () => SerializedPasskeyCredential;
  };

  if (typeof credentialWithJson.toJSON === "function") {
    return credentialWithJson.toJSON();
  }

  const response = credential.response as AuthenticatorAssertionResponse;
  const credentialWithAttachment = credential as PublicKeyCredential & {
    authenticatorAttachment?: AuthenticatorAttachment | null;
  };

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

  if (isPasskeyVerificationError(error)) {
    return "This saved passkey could not be verified. Sign in with your password, then reconnect this device under Profile → Biometric & passkey sign-in.";
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
