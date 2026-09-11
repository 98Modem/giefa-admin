"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DevicePhoneMobileIcon,
  FingerPrintIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { PasskeyListItem } from "@supabase/supabase-js";
import {
  clearPasskeyDeviceMarker,
  getPasskeyErrorMessage,
  hasPlatformAuthenticator,
  isExistingPasskeyError,
  isPasskeyEnabledOnThisDevice,
  markPasskeyEnabledOnThisDevice,
} from "@/app/lib/auth/passkeys";
import { supabaseBrowser } from "@/app/lib/supabase/client";
import { showSystemToast } from "@/app/components/feedback/SystemToast";

type SupportState = "checking" | "available" | "unavailable";

function formatPasskeyDate(value?: string) {
  if (!value) return "Not used yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PasskeyPreferences() {
  const [support, setSupport] = useState<SupportState>("checking");
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loadPasskeys = useCallback(async () => {
    const { data, error: listError } =
      await supabaseBrowser.auth.passkey.list();

    if (listError) {
      setError(getPasskeyErrorMessage(listError));
      setLoading(false);
      return;
    }

    setPasskeys(data ?? []);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    void Promise.all([
      hasPlatformAuthenticator(),
      supabaseBrowser.auth.passkey.list(),
    ]).then(([available, result]) => {
      if (!active) return;

      setSupport(available ? "available" : "unavailable");
      setDeviceEnabled(isPasskeyEnabledOnThisDevice());
      setLoading(false);

      if (result.error) {
        setError(getPasskeyErrorMessage(result.error));
        return;
      }

      setPasskeys(result.data ?? []);
    });

    return () => {
      active = false;
    };
  }, []);

  const enablePasskey = async () => {
    if (busy) return;

    setBusy(true);
    setStatus("");
    setError("");

    const { error: registrationError } =
      await supabaseBrowser.auth.registerPasskey();

    if (registrationError) {
      if (isExistingPasskeyError(registrationError)) {
        markPasskeyEnabledOnThisDevice();
        setDeviceEnabled(true);
        setStatus(
          "This device already had a GIEFA passkey and is now confirmed for biometric sign-in."
        );
        showSystemToast({
          title: "Biometric sign-in confirmed",
          message: "This device is ready to use its saved GIEFA passkey.",
          tone: "success",
        });
        setBusy(false);
        return;
      }

      setError(getPasskeyErrorMessage(registrationError));
      setBusy(false);
      return;
    }

    markPasskeyEnabledOnThisDevice();
    setDeviceEnabled(true);
    await loadPasskeys();
    setStatus(
      "Biometric sign-in is enabled. You can now use this device from the sign-in page."
    );
    showSystemToast({
      title: "Biometric sign-in enabled",
      message: "This device can now use Face ID, fingerprint, PIN, or its saved passkey.",
      tone: "success",
    });
    setBusy(false);
  };

  const removePasskey = async (passkey: PasskeyListItem) => {
    const confirmed = window.confirm(
      `Remove ${passkey.friendly_name || "this passkey"} from your GIEFA account?`
    );
    if (!confirmed) return;

    setRemovingId(passkey.id);
    setStatus("");
    setError("");

    const { error: deleteError } = await supabaseBrowser.auth.passkey.delete({
      passkeyId: passkey.id,
    });

    if (deleteError) {
      setError(getPasskeyErrorMessage(deleteError));
      setRemovingId(null);
      return;
    }

    setPasskeys((current) => current.filter((item) => item.id !== passkey.id));
    clearPasskeyDeviceMarker();
    setDeviceEnabled(false);
    setStatus(
      "The selected passkey was removed. Confirm this device again before using biometric sign-in."
    );
    showSystemToast({
      title: "Passkey removed",
      message: "The selected credential is no longer connected to your GIEFA account.",
      tone: "success",
    });
    setRemovingId(null);
  };

  const accountHasPasskeys = passkeys.length > 0;

  return (
    <section
      id="biometric-sign-in"
      className="scroll-mt-24 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <FingerPrintIcon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Biometric &amp; passkey sign-in
              </h2>
              {!loading && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    deviceEnabled
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : accountHasPasskeys
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {deviceEnabled
                    ? "This device ready"
                    : accountHasPasskeys
                      ? "Confirm this device"
                      : "Not enabled"}
                </span>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              Sign in with Face ID, a fingerprint, your device PIN, or a saved
              passkey. Your biometric information stays on your device and is
              never shared with GIEFA.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={enablePasskey}
          disabled={busy || support !== "available"}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white shadow-lg shadow-brand-500/15 transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <PlusIcon className="h-5 w-5" aria-hidden="true" />
          {busy
            ? "Waiting for device..."
            : deviceEnabled
              ? "Add another passkey"
              : accountHasPasskeys
                ? "Confirm this device"
                : "Enable on this device"}
        </button>
      </div>

      {!loading && accountHasPasskeys && !deviceEnabled && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">Finish setup on this device</p>
          <p className="mt-1 text-xs leading-5 opacity-90">
            Your account has a passkey, but this browser has not been confirmed.
            Choose <span className="font-semibold">Confirm this device</span> so
            GIEFA can offer biometric sign-in here without opening an empty
            system passkey prompt.
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/5">
          <ShieldCheckIcon
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">
              Protected by your device
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              The private credential cannot be read by GIEFA and only works for
              the GIEFA website.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/5">
          <DevicePhoneMobileIcon
            className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">
              Password remains available
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              You can still use your password if your phone is unavailable or
              you replace it.
            </p>
          </div>
        </div>
      </div>

      {support === "checking" && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Checking this device for biometric sign-in...
        </p>
      )}

      {support === "unavailable" && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          This browser did not report an available Face ID, fingerprint, or
          device passkey authenticator. You can manage existing passkeys here,
          but enable a new one from a supported phone or computer.
        </p>
      )}

      {passkeys.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Enabled devices and passkeys
          </p>
          <div className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="flex items-center justify-between gap-4 bg-white px-4 py-3 dark:bg-gray-900"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">
                    {passkey.friendly_name || "Device passkey"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Last used: {formatPasskeyDate(passkey.last_used_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removePasskey(passkey)}
                  disabled={removingId === passkey.id}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                  {removingId === passkey.id ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {status && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
        >
          {status}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        >
          {error}
        </p>
      )}
    </section>
  );
}
