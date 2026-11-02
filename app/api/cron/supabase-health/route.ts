import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ProjectConfig = {
  name: string;
  url: string;
  serviceRoleKey: string;
  table: string;
};

type HealthCheckResult = {
  project: string;
  ok: boolean;
  latencyMs: number;
  code: "healthy" | "configuration_missing" | "query_failed";
  detail?: string;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function createServerClient(config: ProjectConfig) {
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function checkProject(config: ProjectConfig): Promise<HealthCheckResult> {
  const startedAt = Date.now();

  if (!config.url || !config.serviceRoleKey) {
    return {
      project: config.name,
      ok: false,
      latencyMs: Date.now() - startedAt,
      code: "configuration_missing",
      detail: "Required server credentials are not configured.",
    };
  }

  try {
    const { error } = await createServerClient(config)
      .from(config.table)
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(15_000));

    if (error) {
      return {
        project: config.name,
        ok: false,
        latencyMs: Date.now() - startedAt,
        code: "query_failed",
        detail: `${error.code}: ${error.message}`,
      };
    }

    return {
      project: config.name,
      ok: true,
      latencyMs: Date.now() - startedAt,
      code: "healthy",
    };
  } catch (error) {
    return {
      project: config.name,
      ok: false,
      latencyMs: Date.now() - startedAt,
      code: "query_failed",
      detail: error instanceof Error ? error.message : "Unknown database error.",
    };
  }
}

function publicResults(results: HealthCheckResult[]) {
  return results.map(({ project, ok, latencyMs, code }) => ({
    project,
    ok,
    latencyMs,
    code,
  }));
}

async function recordResults(
  giefaConfig: ProjectConfig,
  checkedAt: string,
  source: string,
  results: HealthCheckResult[]
) {
  if (!giefaConfig.url || !giefaConfig.serviceRoleKey) return;

  const { error } = await createServerClient(giefaConfig)
    .from("system_health_check_runs")
    .insert({
      checked_at: checkedAt,
      source,
      all_healthy: results.every((result) => result.ok),
      results: publicResults(results),
    });

  if (error) {
    console.warn("[supabase-health] could not record the health-check run", {
      code: error.code,
      message: error.message,
    });
  }
}

async function sendFailureAlert(checkedAt: string, results: HealthCheckResult[]) {
  const apiKey = env("RESEND_API_KEY");
  const from = env("GIEFA_EMAIL_FROM");
  const recipient = env("GIEFA_HEALTH_ALERT_EMAIL") || env("GIEFA_EMAIL_REPLY_TO");
  const failures = results.filter((result) => !result.ok);

  if (!failures.length || !apiKey || !from || !recipient) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `database-health-${checkedAt.replaceAll(":", "-")}`,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: "GIEFA database health check failed",
      text: [
        "One or more Supabase projects failed the scheduled health check.",
        `Checked at: ${checkedAt}`,
        "",
        ...failures.map(
          (failure) =>
            `${failure.project}: ${failure.code}${failure.detail ? ` (${failure.detail})` : ""}`
        ),
        "",
        "Open the Supabase and Vercel dashboards to investigate.",
      ].join("\n"),
      tags: [{ name: "category", value: "database_health" }],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend returned HTTP ${response.status}: ${body.slice(0, 300)}`);
  }
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

  const projects: ProjectConfig[] = [
    {
      name: "GIEFA",
      url: env("NEXT_PUBLIC_SUPABASE_URL"),
      serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
      table: "members",
    },
    {
      name: "Game Predictor",
      url: env("PREDICTION_SUPABASE_URL"),
      serviceRoleKey: env("PREDICTION_SUPABASE_SERVICE_ROLE_KEY"),
      table: "matches",
    },
  ];

  const results = await Promise.all(projects.map(checkProject));
  const allHealthy = results.every((result) => result.ok);
  const requestedSource = request.headers.get("x-health-source")?.trim() || "vercel-cron";
  const source = requestedSource.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 60);

  await recordResults(projects[0], checkedAt, source, results).catch((error) => {
    console.warn("[supabase-health] health-check audit failed", {
      message: error instanceof Error ? error.message : "Unknown audit error.",
    });
  });

  if (!allHealthy) {
    console.error(
      "[supabase-health] one or more database checks failed",
      results.filter((result) => !result.ok)
    );

    await sendFailureAlert(checkedAt, results).catch((error) => {
      console.error("[supabase-health] failure alert could not be sent", {
        message: error instanceof Error ? error.message : "Unknown email error.",
      });
    });
  } else {
    console.info("[supabase-health] all database checks passed", {
      checkedAt,
      source,
      results: publicResults(results),
    });
  }

  return Response.json(
    {
      ok: allHealthy,
      checkedAt,
      source,
      projects: publicResults(results),
    },
    { status: allHealthy ? 200 : 503 }
  );
}
