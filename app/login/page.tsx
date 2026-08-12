"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ExclamationTriangleIcon,
  FingerPrintIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { GiefaWorkOverlay } from "@/app/components/loading/GiefaWorkOverlay";
import {
  clearPasskeyDeviceMarker,
  getPasskeyErrorMessage,
  hasPlatformAuthenticator,
  isPasskeyEnabledOnThisDevice,
  isMissingPasskeyError,
  markPasskeyEnabledOnThisDevice,
  parsePasskeyRequestOptions,
  serializePasskeyCredential,
  shouldAutomaticallyPromptForPasskey,
} from "@/app/lib/auth/passkeys";
import { supabaseBrowser } from "@/app/lib/supabase/client";

type PreparedPasskey = {
  challengeId: string;
  expiresAt: number;
  publicKey: PublicKeyCredentialRequestOptions;
};

type PasskeyNotice = {
  title: string;
  message: string;
  tone: "info" | "error";
};

export default function LoginPage() {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const preparedPasskeyRef = useRef<PreparedPasskey | null>(null);
  const preparePasskeyPromiseRef = useRef<Promise<boolean> | null>(null);
  const passkeyAbortControllerRef = useRef<AbortController | null>(null);
  const autoPasskeyAttemptedRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Signing you in securely");
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyPreparing, setPasskeyPreparing] = useState(false);
  const [passkeyWaiting, setPasskeyWaiting] = useState(false);
  const [passkeyNotice, setPasskeyNotice] = useState<PasskeyNotice | null>(null);
  const [openPasskeySettingsAfterLogin, setOpenPasskeySettingsAfterLogin] =
    useState(false);
  const [error, setError] = useState("");

  const preparePasskey = useCallback(() => {
    if (preparePasskeyPromiseRef.current) {
      return preparePasskeyPromiseRef.current;
    }

    const request = (async () => {
      setPasskeyPreparing(true);

      try {
        const { data, error: preparationError } =
          await supabaseBrowser.auth.passkey.startAuthentication();

        if (preparationError || !data) {
          throw preparationError ?? new Error("No sign-in challenge was returned.");
        }

        const expiresAt =
          data.expires_at < 1_000_000_000_000
            ? data.expires_at * 1_000
            : data.expires_at;

        preparedPasskeyRef.current = {
          challengeId: data.challenge_id,
          expiresAt,
          publicKey: parsePasskeyRequestOptions(data.options),
        };
        return true;
      } catch (preparationError) {
        preparedPasskeyRef.current = null;
        setPasskeyNotice({
          title: "Biometric sign-in is temporarily unavailable",
          message: getPasskeyErrorMessage(preparationError),
          tone: "error",
        });
        return false;
      } finally {
        setPasskeyPreparing(false);
      }
    })().finally(() => {
      preparePasskeyPromiseRef.current = null;
    });

    preparePasskeyPromiseRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    let active = true;

    void hasPlatformAuthenticator().then((available) => {
      if (!active) return;

      setPasskeyAvailable(available);

    });

    return () => {
      active = false;
      passkeyAbortControllerRef.current?.abort();
    };
  }, []);

  const openSignedInWorkspace = useCallback(() => {
    setLoadingMessage("Opening your GIEFA workspace");

    // Supabase has already persisted the verified session. A full navigation
    // lets the server-side access guard route approved, pending, and suspended
    // members without repeating two client-side network lookups on mobile.
    window.location.replace(
      openPasskeySettingsAfterLogin
        ? "/dashboard/profile#biometric-sign-in"
        : "/"
    );
  }, [openPasskeySettingsAfterLogin]);

  const busy = loading || passkeyWaiting;

  const handleLogin = async () => {
    if (busy) return;

    setLoading(true);
    setLoadingMessage("Signing you in securely");
    setError("");
    setPasskeyNotice(null);

    const { error: signInError } =
      await supabaseBrowser.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    openSignedInWorkspace();
  };

  const handlePasskeyLogin = useCallback(async () => {
    if (busy) return;

    setError("");

    if (!isPasskeyEnabledOnThisDevice()) {
      setOpenPasskeySettingsAfterLogin(true);
      setPasskeyNotice({
        title: "Set up biometric sign-in first",
        message:
          "Sign in with your password below. We will take you to Profile settings, where you can enable Face ID, fingerprint, or a passkey on this device.",
        tone: "info",
      });
      window.setTimeout(() => emailInputRef.current?.focus(), 0);
      return;
    }

    const prepared = preparedPasskeyRef.current;

    if (!prepared || prepared.expiresAt <= Date.now()) {
      preparedPasskeyRef.current = null;
      const ready = await preparePasskey();
      setPasskeyNotice(
        ready
          ? {
              title: "Biometric sign-in is ready",
              message:
                "For your security, tap the biometric sign-in button once more.",
              tone: "info",
            }
          : null
      );
      return;
    }

    preparedPasskeyRef.current = null;
    setPasskeyNotice(null);

    const abortController = new AbortController();
    passkeyAbortControllerRef.current = abortController;
    const timeoutId = window.setTimeout(() => {
      abortController.abort(
        new DOMException("Biometric sign-in timed out.", "AbortError")
      );
    }, 45_000);
    const cancelledRequest = new Promise<never>((_, reject) => {
      abortController.signal.addEventListener(
        "abort",
        () => {
          reject(
            abortController.signal.reason ??
              new DOMException("Biometric sign-in was cancelled.", "AbortError")
          );
        },
        { once: true }
      );
    });

    let credentialRequest: Promise<Credential | null>;

    try {
      // Start WebAuthn directly inside the tap event. Some Android credential
      // providers reject the first attempt when network work precedes this call.
      credentialRequest = navigator.credentials.get({
        publicKey: prepared.publicKey,
        signal: abortController.signal,
      });
    } catch (passkeyError) {
      window.clearTimeout(timeoutId);
      passkeyAbortControllerRef.current = null;
      setPasskeyNotice({
        title: "Biometric sign-in could not start",
        message: getPasskeyErrorMessage(passkeyError),
        tone: "error",
      });
      void preparePasskey();
      return;
    }

    setPasskeyWaiting(true);

    try {
      // Race against our own abort listener as well as passing the signal to
      // Chrome. This releases the UI even if a device credential provider does
      // not settle navigator.credentials.get() correctly.
      const credential = await Promise.race([
        credentialRequest,
        cancelledRequest,
      ]);
      window.clearTimeout(timeoutId);
      passkeyAbortControllerRef.current = null;
      setPasskeyWaiting(false);

      if (!(credential instanceof PublicKeyCredential)) {
        throw new Error("No biometric credential was returned by this device.");
      }

      setLoading(true);
      setLoadingMessage("Verifying your secure credential");

      const { data: passkeyData, error: passkeyError } =
        await supabaseBrowser.auth.passkey.verifyAuthentication({
          challengeId: prepared.challengeId,
          credential: serializePasskeyCredential(credential),
        });

      if (passkeyError || !passkeyData?.session || !passkeyData.user) {
        if (isMissingPasskeyError(passkeyError)) {
          clearPasskeyDeviceMarker();
          setOpenPasskeySettingsAfterLogin(true);
        }

        setPasskeyNotice({
          title: "Biometric sign-in was not completed",
          message: getPasskeyErrorMessage(
            passkeyError ?? new Error("Your verified session was not returned.")
          ),
          tone: "error",
        });
        setLoading(false);

        // A verification request consumes its one-time challenge whether it
        // succeeds or fails. Prepare the next challenge now so retrying needs
        // one tap instead of a separate preparation tap.
        void preparePasskey();
        return;
      }

      markPasskeyEnabledOnThisDevice();
      openSignedInWorkspace();
    } catch (passkeyError) {
      window.clearTimeout(timeoutId);
      passkeyAbortControllerRef.current = null;
      setPasskeyWaiting(false);
      setPasskeyNotice({
        title: "Biometric sign-in was not completed",
        message: getPasskeyErrorMessage(passkeyError),
        tone: "error",
      });
      setLoading(false);
      void preparePasskey();
    }
  }, [busy, openSignedInWorkspace, preparePasskey]);

  const cancelPasskeyLogin = () => {
    passkeyAbortControllerRef.current?.abort(
      new DOMException("Biometric sign-in was cancelled.", "AbortError")
    );
  };

  useEffect(() => {
    if (
      !passkeyAvailable ||
      !isPasskeyEnabledOnThisDevice() ||
      autoPasskeyAttemptedRef.current
    ) {
      return;
    }

    autoPasskeyAttemptedRef.current = true;

    const autoPrompt = shouldAutomaticallyPromptForPasskey();

    void preparePasskey().then((ready) => {
      if (
        !ready ||
        !autoPrompt ||
        document.visibilityState !== "visible" ||
        window.location.pathname !== "/login"
      ) {
        return;
      }

      window.setTimeout(() => {
        void handlePasskeyLogin();
      }, 250);
    });
  }, [handlePasskeyLogin, passkeyAvailable, preparePasskey]);

  return (
    <div className="relative flex min-h-screen bg-[image:var(--app-bg)] text-gray-900 dark:text-white">
      {loading && <GiefaWorkOverlay message={loadingMessage} />}

      <div className="flex w-full flex-col justify-center px-6 py-10 lg:w-1/2">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-transparent bg-transparent p-0 sm:border-[var(--app-border)] sm:bg-[var(--app-surface)] sm:p-8 sm:shadow-2xl sm:shadow-brand-950/5 dark:sm:shadow-black/20 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-8 flex justify-center lg:hidden">
            <div
              className="giefa-login-logo-card giefa-premium-logo flex h-24 w-24 items-center justify-center rounded-[1.65rem]"
              aria-label="GIEFA logo"
              role="img"
            >
              <img
                src="/logo/auth-logo-login.png"
                alt=""
                className="giefa-login-logo-img h-16 w-16"
                draggable={false}
              />
            </div>
          </div>

          <h1 className="mb-2 text-2xl font-semibold text-gray-950 dark:text-white">
            Sign In
          </h1>
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
            Use your device passkey or enter your email and password.
          </p>

          {passkeyAvailable && (
            <>
              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={busy || passkeyPreparing}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-brand-500/35 bg-brand-50 px-4 text-sm font-semibold text-brand-700 shadow-sm transition hover:border-brand-500 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-400/40 dark:bg-brand-500/10 dark:text-brand-200 dark:hover:bg-brand-500/20"
              >
                <FingerPrintIcon className="h-6 w-6" aria-hidden="true" />
                {passkeyWaiting
                  ? "Waiting for your device..."
                  : passkeyPreparing
                  ? "Preparing secure sign-in..."
                  : "Use Face ID, fingerprint, or passkey"}
              </button>

              {passkeyWaiting && (
                <div
                  role="status"
                  className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100"
                >
                  <p className="font-semibold">Check your device prompt</p>
                  <p className="mt-1 text-xs leading-5 opacity-90">
                    Approve the request with your fingerprint, face, PIN, or
                    saved passkey. If no prompt appeared, cancel and try again.
                  </p>
                  <button
                    type="button"
                    onClick={cancelPasskeyLogin}
                    className="mt-3 rounded-lg border border-current/25 px-3 py-2 text-xs font-semibold transition hover:bg-white/60 dark:hover:bg-white/10"
                  >
                    Cancel and use password
                  </button>
                </div>
              )}

              {passkeyNotice && (
                <div
                  role={passkeyNotice.tone === "error" ? "alert" : "status"}
                  className={`mt-3 flex gap-3 rounded-xl border px-4 py-3 text-left ${
                    passkeyNotice.tone === "error"
                      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                  }`}
                >
                  {passkeyNotice.tone === "error" ? (
                    <ExclamationTriangleIcon
                      className="mt-0.5 h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <ShieldCheckIcon
                      className="mt-0.5 h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {passkeyNotice.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 opacity-90">
                      {passkeyNotice.message}
                    </p>
                  </div>
                </div>
              )}

              <div className="my-6 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-[var(--app-border)]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  or use password
                </span>
                <span className="h-px flex-1 bg-[var(--app-border)]" />
              </div>
            </>
          )}

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                ref={emailInputRef}
                type="email"
                placeholder="info@gmail.com"
                autoComplete="username webauthn"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:text-white"
                required
                disabled={busy}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-4 pr-14 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:text-white"
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 transition hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-200"
                  aria-label="Toggle password visibility"
                  disabled={busy}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  disabled={busy}
                  className="h-4 w-4 rounded border-[var(--app-border)] text-brand-500 focus:ring-brand-500/20"
                />
                Keep me logged in
              </label>

              <Link
                href="/forgot-password"
                className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            {error && (
              <p className="mt-2 text-center text-sm text-red-500">{error}</p>
            )}
          </form>

          <p className="mt-5 text-sm text-gray-600 dark:text-gray-300">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
              Sign Up
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-[image:var(--app-sidebar)] lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.12),transparent_34%),radial-gradient(circle_at_68%_62%,color-mix(in_srgb,var(--color-brand-400)_18%,transparent),transparent_38%)]" />
        <div className="text-center">
          <div
            className="giefa-login-logo-drop giefa-login-logo-card giefa-premium-logo mx-auto mb-7 flex h-36 w-36 items-center justify-center rounded-[2rem]"
            aria-label="GIEFA logo"
            role="img"
          >
            <img
              src="/logo/auth-logo-login.png"
              alt=""
              className="giefa-login-logo-img giefa-login-logo-mark"
              draggable={false}
            />
          </div>
          <p className="giefa-login-wordmark mb-3 text-3xl font-semibold tracking-[0.24em] text-white">
            GIEFA
          </p>
          <p className="text-gray-400">
            Graduate Investment & Emergency Fund Association
          </p>
        </div>
      </div>
    </div>
  );
}
