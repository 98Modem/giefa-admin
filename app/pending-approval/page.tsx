"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { EmailOtpType, RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/app/lib/supabase/client";

export default function PendingApprovalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [error, setError] = useState("");
  const [approvedToast, setApprovedToast] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const redirectToDashboard = useCallback(() => {
    router.replace("/dashboard");
  }, [router]);

  const completeEmailLinkIfPresent = useCallback(async () => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type") as EmailOtpType | null;

    if (code) {
      const { error: exchangeError } =
        await supabaseBrowser.auth.exchangeCodeForSession(code);

      url.searchParams.delete("code");
      url.searchParams.delete("type");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

      if (exchangeError) {
        setError(
          "We could not complete this verification link. Please sign in or request a fresh verification email."
        );
      }

      return;
    }

    if (tokenHash && type) {
      const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      url.searchParams.delete("token_hash");
      url.searchParams.delete("type");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

      if (verifyError) {
        setError(
          "We could not complete this verification link. Please sign in or request a fresh verification email."
        );
      }
    }
  }, []);

  const checkStatus = useCallback(async () => {
    setChecking(true);

    try {
      await supabaseBrowser.auth.refreshSession();

      const {
        data: { user },
        error: userError,
      } = await supabaseBrowser.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const isEmailVerified = !!user.email_confirmed_at;
      setEmailVerified(isEmailVerified);

      if (!isEmailVerified) {
        setChecking(false);
        return;
      }

      const { data: member, error: memberError } = await supabaseBrowser
        .from("members")
        .select("first_name, status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (memberError || !member) {
        setError("Your email is verified, but your member record is not ready yet. Please contact the General Secretary if this remains.");
        setChecking(false);
        return;
      }

      setFirstName(member.first_name ?? "");

      if (member.status === "approved") {
        setApprovedToast(true);
        setChecking(false);
        redirectToDashboard();
        return;
      }

      if (member.status === "suspended") {
        setChecking(false);
        router.replace("/account-suspended");
        return;
      }

      setError("");
      setChecking(false);
    } catch (err) {
      console.error("checkStatus error:", err);
      setError("An unexpected error occurred. Please try again.");
      setChecking(false);
    }
  }, [redirectToDashboard, router]);

  useEffect(() => {
    const init = async () => {
      await completeEmailLinkIfPresent();
      setSessionReady(true);
      await checkStatus();
      setLoading(false);
    };

    init();
  }, [checkStatus, completeEmailLinkIfPresent]);

  useEffect(() => {
    let channel: RealtimeChannel | undefined;

    const subscribe = async () => {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser();

      if (!user) return;

      channel = supabaseBrowser
        .channel("member-approval-listener")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "members",
            filter: `auth_user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new.status === "approved") {
              setApprovedToast(true);
              redirectToDashboard();
              return;
            }

            if (payload.new.status === "suspended") {
              router.replace("/account-suspended");
            }
          }
        )
        .subscribe();
    };

    subscribe();

    return () => {
      if (channel) supabaseBrowser.removeChannel(channel);
    };
  }, [redirectToDashboard, router]);

  useEffect(() => {
    if (!sessionReady) return;

    const interval = window.setInterval(() => {
      checkStatus();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [checkStatus, sessionReady]);

  const resendVerificationEmail = async () => {
    setChecking(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser();

      if (!user?.email) {
        setError("Unable to resend verification email. Please sign in again first.");
        setChecking(false);
        return;
      }

      const { error: resendError } = await supabaseBrowser.auth.resend({
        type: "signup",
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/pending-approval`,
        },
      });

      if (resendError) {
        setError(resendError.message);
      } else {
        alert("Verification email resent. Please check your inbox.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to resend verification email.");
    } finally {
      setChecking(false);
    }
  };

  const returnToLogin = async () => {
    await supabaseBrowser.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-center text-gray-500">Checking account status...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center dark:bg-gray-900">
      <Image
        src="/logo/giefa-auth-logo.png"
        alt="GIEFA Logo"
        width={160}
        height={48}
        className="mb-6"
      />

      {!emailVerified ? (
        <>
          <h1 className="mb-3 text-2xl font-semibold text-gray-800 dark:text-white">
            Verify Your Email
          </h1>

          <p className="max-w-md text-gray-600 dark:text-gray-400">
            We have sent a verification link to your email address.
            <br />
            Please check your inbox and click the latest link to continue.
          </p>

          <button
            onClick={resendVerificationEmail}
            disabled={checking}
            className="mt-4 text-sm font-medium text-brand-500 hover:underline disabled:opacity-50"
          >
            Resend verification email
          </button>
        </>
      ) : (
        <>
          <h1 className="mb-3 text-2xl font-semibold text-gray-800 dark:text-white">
            Account Pending Approval
          </h1>

          <p className="max-w-md text-gray-600 dark:text-gray-400">
            Thank you{firstName && `, ${firstName}`}.
            <br />
            Your email is verified. Your account is waiting for General Secretary approval.
          </p>

          <div className="mt-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            You will gain dashboard access once your membership is approved.
          </div>
        </>
      )}

      {error && <p className="mt-4 max-w-md text-sm text-red-500">{error}</p>}

      <button
        onClick={checkStatus}
        disabled={checking}
        className="mt-6 rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {checking ? "Checking..." : "Check status"}
      </button>

      <button
        onClick={returnToLogin}
        className="mt-3 text-sm font-medium text-gray-500 hover:text-gray-800 hover:underline dark:text-gray-300 dark:hover:text-white"
      >
        Back to login
      </button>

      {approvedToast && (
        <div className="fixed bottom-6 right-6 rounded-lg bg-green-600 px-4 py-3 text-sm text-white shadow-lg">
          Account approved. Redirecting...
        </div>
      )}
    </div>
  );
}
