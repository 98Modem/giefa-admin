"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GiefaWorkOverlay } from "@/app/components/loading/GiefaWorkOverlay";
import { supabaseBrowser } from "@/app/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (loading) return;

    setLoading(true);
    setError("");

    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser();

    if (!user?.email_confirmed_at) {
      router.replace("/pending-approval");
      return;
    }

    const { data: member } = await supabaseBrowser
      .from("members")
      .select("status")
      .eq("auth_user_id", user.id)
      .maybeSingle<{ status: string }>();

    if (member?.status === "approved") {
      router.replace("/dashboard");
      return;
    }

    if (member?.status === "suspended") {
      router.replace("/account-suspended");
      return;
    }

    router.replace("/pending-approval");
  };

  return (
    <div className="relative flex min-h-screen bg-white dark:bg-gray-900">
      {loading && <GiefaWorkOverlay message="Signing you in securely" />}

      <div className="flex w-full flex-col justify-center px-6 lg:w-1/2">
        <div className="mx-auto w-full max-w-md">
          <h1 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white">
            Sign In
          </h1>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Enter your email and password to sign in to GIEFA
          </p>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Email
              </label>
              <input
                type="email"
                placeholder="info@gmail.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 px-4 pr-14 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 transition hover:text-brand-600"
                  aria-label="Toggle password visibility"
                  disabled={loading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input type="checkbox" disabled={loading} />
                Keep me logged in
              </label>

              <Link
                href="/forgot-password"
                className="text-sm text-brand-500 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-500 py-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            {error && (
              <p className="mt-2 text-center text-sm text-red-500">{error}</p>
            )}
          </form>

          <p className="mt-5 text-sm text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-brand-500 hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-brand-950 lg:flex">
        <div className="text-center">
          <div
            className="giefa-login-logo-drop giefa-login-logo-card giefa-premium-logo mx-auto mb-7 flex h-36 w-36 items-center justify-center rounded-[2rem]"
            aria-label="GIEFA logo"
            role="img"
          >
            <span className="giefa-login-logo-img giefa-login-logo-mark" aria-hidden="true" />
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
