"use client";

/* eslint-disable @next/next/no-img-element */

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
    <div className="relative flex min-h-screen bg-[image:var(--app-bg)] text-gray-900 dark:text-white">
      {loading && <GiefaWorkOverlay message="Signing you in securely" />}

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
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                placeholder="info@gmail.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:text-white"
                required
                disabled={loading}
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
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-4 pr-14 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:text-white"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 transition hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-200"
                  aria-label="Toggle password visibility"
                  disabled={loading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  disabled={loading}
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
              disabled={loading}
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
