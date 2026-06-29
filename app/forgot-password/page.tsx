"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/app/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sendResetEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");
    setError("");

    const { error: resetError } =
      await supabaseBrowser.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setMessage(
      "If this email exists in GIEFA, a password reset link has been sent."
    );
    setLoading(false);
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
          Reset your password
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          Enter the email address connected to your GIEFA account. We will send
          a secure reset link.
        </p>

        <form className="mt-6 space-y-5" onSubmit={sendResetEmail}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="member@example.com"
              className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Sending reset link..." : "Send reset link"}
          </button>
        </form>

        {message && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/70 dark:bg-green-950/30 dark:text-green-300">
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
