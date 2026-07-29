import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/app/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));
  const redirectUrl = new URL(next, requestUrl.origin);

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      redirectUrl.pathname = "/reset-password";
      redirectUrl.searchParams.set("error", "recovery_link_failed");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(redirectUrl);
}
