"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { supabaseBrowser } from "@/app/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const signOut = async () => {
    setLoading(true);
    await supabaseBrowser.auth.signOut({ scope: "global" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <ArrowRightOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
      {loading ? "Signing out..." : "Back to login"}
    </button>
  );
}
