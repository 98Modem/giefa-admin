import { NextResponse } from "next/server";
import { supabaseServer } from "@/app/lib/supabase/server";

export async function POST() {
  const supabase = await supabaseServer();

  await supabase.auth.signOut({
    scope: "global",
  });

  return NextResponse.json({ ok: true });
}
