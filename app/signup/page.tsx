"use client";

import { supabaseBrowser } from "../lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      setMessage("You must accept the terms and conditions.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data: authData, error: authError } =
        await supabaseBrowser.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              role: "member",
            },
          },
        });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error("User creation failed.");

      router.replace(`/pending-approval?email=${encodeURIComponent(email)}`);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Signup failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen bg-white dark:bg-gray-900">
      <div className="flex w-full flex-col justify-center px-6 lg:w-1/2">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/login"
            className="mb-6 inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            &larr; Back to Login
          </Link>

          <h1 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white">
            Create Account
          </h1>

          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Join the Graduate Investment & Emergency Fund Association
          </p>

          <form className="space-y-5" onSubmit={handleSignup}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <input
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                required
              />
              <input
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                required
              />
            </div>

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 px-4 pr-16 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500"
                aria-label="Toggle password visibility"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <label className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={() => setAcceptedTerms(!acceptedTerms)}
              />
              <span>
                I agree to the{" "}
                <span className="font-medium text-gray-800 dark:text-white">
                  Terms & Conditions
                </span>{" "}
                and{" "}
                <span className="font-medium text-gray-800 dark:text-white">
                  Privacy Policy
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={!acceptedTerms || loading}
              className="w-full rounded-lg bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            {message && (
              <p className="mt-2 text-center text-sm text-red-500">
                {message}
              </p>
            )}
          </form>

          <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-500 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden w-1/2 items-center justify-center bg-brand-950 lg:flex">
        <div className="text-center">
          <Image
            src="/logo/giefa-auth-logo.png"
            alt="GIEFA Logo"
            width={140}
            height={40}
            className="mx-auto mb-4"
          />
          <p className="text-gray-400">
            Secure &bull; Transparent &bull; Member-Driven
          </p>
        </div>
      </div>
    </div>
  );
}
