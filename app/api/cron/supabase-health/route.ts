import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export async function GET(request: Request) {
  const checkedAt = new Date().toISOString();
  const cronSecret = env("CRON_SECRET");

  if (!cronSecret) {
    return Response.json(
      { ok: false, checkedAt, error: "CRON_SECRET is not configured." },
      { status: 500 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json(
      { ok: false, checkedAt, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      {
        ok: false,
        checkedAt,
        error: "Supabase server credentials are not configured.",
      },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase.from("members").select("id").limit(1);

  if (error) {
    console.error("[supabase-health] database query failed", {
      code: error.code,
      message: error.message,
    });

    return Response.json(
      { ok: false, checkedAt, error: "Database query failed." },
      { status: 503 }
    );
  }

  return Response.json({
    ok: true,
    checkedAt,
    service: "supabase",
  });
}
