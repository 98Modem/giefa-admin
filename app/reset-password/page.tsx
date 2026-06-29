"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/app/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Preparing password reset...");

  useEffect(() => {
    const prepareRecoverySession = async () => {
      setError("");

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error: exchangeError } =
          await supabaseBrowser.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(
            "This reset link cannot be completed in this browser. Please request a new password reset email and open the latest link."
          );
          setMessage("");
          return;
        }

        setReady(true);
        setMessage("");
        window.history.replaceState({}, document.title, "/reset-password");
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabaseBrowser.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setError(sessionError.message);
          setMessage("");
          return;
        }

        setReady(true);
        setMessage("");
        window.history.replaceState({}, document.title, "/reset-password");
        return;
      }

      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (session) {
        setReady(true);
        setMessage("");
        return;
      }

      setError("This reset link is invalid or has expired.");
      setMessage("");
    };

    void prepareRecoverySession();
  }, []);

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabaseBrowser.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully. Redirecting to login...");
    setLoading(false);

    await supabaseBrowser.auth.signOut();

    window.setTimeout(() => {
      router.replace("/login");
    }, 1200);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-gray-950">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="mb-6 inline-flex text-sm font-medium text-gray-500 transition hover:text-brand-600 dark:text-gray-400"
        >
          &larr; Back to login
        </Link>

        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Create a new password
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          Choose a strong password for your GIEFA account.
        </p>

        <form className="mt-6 space-y-5" onSubmit={updatePassword}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter new password"
                className="h-11 w-full rounded-lg border border-gray-300 px-4 pr-14 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                required
                disabled={!ready || loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 transition hover:text-brand-600"
                disabled={!ready || loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
              disabled={!ready || loading}
            />
          </div>

          <button
            type="submit"
            disabled={!ready || loading}
            className="w-full rounded-lg bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Updating password..." : "Update password"}
          </button>
        </form>

        {message && (
          <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
