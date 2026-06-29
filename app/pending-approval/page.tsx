"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function PendingApprovalPage() {
  const router = useRouter();

  // ------------------------------
  // State
  // ------------------------------
  const [loading, setLoading] = useState(true); // initial load only
  const [checking, setChecking] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [error, setError] = useState("");
  const [approvedToast, setApprovedToast] = useState(false);

  // ------------------------------
  // Redirect helper
  // ------------------------------
  const redirectToDashboard = useCallback(() => {
    router.replace("/dashboard");
  }, [router]);

  // ------------------------------
  // Check user and approval status
  // ------------------------------
  const checkStatus = useCallback(async () => {
    setChecking(true);
    setError("");

    try {
      // Refresh session to get latest email verification
      await supabase.auth.refreshSession();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const isEmailVerified = !!user.email_confirmed_at;
      setEmailVerified(isEmailVerified);

      // Stop here if email not verified
      if (!isEmailVerified) {
        setChecking(false);
        return;
      }

      // Fetch member record
      const { data: member, error: memberError } = await supabase
        .from("members")
        .select("first_name, status")
        .eq("auth_user_id", user.id)
        .single();

      if (memberError || !member) {
        setError("Unable to check approval status. Please try again.");
        setChecking(false);
        return;
      }

      setFirstName(member.first_name ?? "");

      // Approved → redirect
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

      // Still pending
      setChecking(false);
    } catch (err) {
      console.error("checkStatus error:", err);
      setError("An unexpected error occurred. Please try again.");
      setChecking(false);
    }
  }, [router, redirectToDashboard]);

  // ------------------------------
  // Initial load (ONE TIME)
  // ------------------------------
  useEffect(() => {
    const init = async () => {
      await checkStatus();
      setLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------
  // Realtime approval listener
  // ------------------------------
  useEffect(() => {
    let channel: RealtimeChannel | undefined;

    const subscribe = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
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
      if (channel) supabase.removeChannel(channel);
    };
  }, [redirectToDashboard, router]);

  // ------------------------------
  // Polling fallback (every 5s)
  // ------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      checkStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [checkStatus]);

  // ------------------------------
  // Resend verification email
  // ------------------------------
  const resendVerificationEmail = async () => {
    setChecking(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        setError("Unable to resend verification email.");
        setChecking(false);
        return;
      }

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });

      if (error) {
        setError(error.message);
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

  // ------------------------------
  // Initial loading screen
  // ------------------------------
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-gray-500 text-center">
          Checking account status…
        </p>
      </div>
    );
  }

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-gray-900 px-4 text-center">
      <Image
        src="/logo/giefa-auth-logo.png"
        alt="Company Logo"
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
            We’ve sent a verification link to your email address.
            <br />
            Please check your inbox and click the link to continue.
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
            Thank you{firstName && `, ${firstName}`} 👋
            <br />
            Your account is being reviewed by an administrator.
          </p>

          <div className="mt-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            You will gain full access once approved.
          </div>
        </>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-500">{error}</p>
      )}

      <button
        onClick={checkStatus}
        disabled={checking}
        className="mt-6 rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {checking ? "Checking…" : "Check status"}
      </button>

      {approvedToast && (
        <div className="fixed bottom-6 right-6 rounded-lg bg-green-600 px-4 py-3 text-sm text-white shadow-lg">
          ✅ Account approved! Redirecting…
        </div>
      )}
    </div>
  );
}
