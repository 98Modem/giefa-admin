type PasskeyError = {
  code?: string;
  message?: string;
  name?: string;
};

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

  if (code === "webauthn_credential_exists") {
    return "Biometric sign-in is already enabled with this device.";
  }

  if (code === "webauthn_credential_not_found") {
    return "This passkey is no longer linked to your GIEFA account. Use your password and enable it again.";
  }

  if (
    code === "webauthn_challenge_expired" ||
    code === "webauthn_challenge_not_found"
  ) {
    return "The biometric request expired. Please try again.";
  }

  if (
    name === "notallowederror" ||
    code.includes("ceremony_aborted") ||
    message.includes("not allowed") ||
    message.includes("cancel")
  ) {
    return "Biometric sign-in was cancelled or timed out.";
  }

  if (message.includes("browser does not support webauthn")) {
    return "This browser does not support biometric or passkey sign-in.";
  }

  return passkeyError.message || "Biometric sign-in could not be completed.";
}
