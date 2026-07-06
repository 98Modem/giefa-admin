import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Role } from "@/app/employee_type/roles";

const roleProtectedRoutes: {
  prefix: string;
  allowedRoles: Role[];
}[] = [
  {
    prefix: "/members",
    allowedRoles: ["general_sec", "chairman", "admin"],
  },
  {
    prefix: "/finance",
    allowedRoles: ["treasurer", "admin"],
  },
  {
    prefix: "/governance",
    allowedRoles: ["chairman", "admin"],
  },
  {
    prefix: "/system",
    allowedRoles: ["admin"],
  },
  {
    prefix: "/chairman",
    allowedRoles: ["chairman", "admin"],
  },
  {
    prefix: "/funds/pending",
    allowedRoles: ["treasurer", "admin"],
  },
  {
    prefix: "/funds/approved",
    allowedRoles: ["treasurer", "admin"],
  },
];

const publicRoutes = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/pending-approval",
  "/account-suspended",
];

const authLandingRoutes = ["/login", "/signup"];
const publicAssetPattern =
  /\.(?:avif|css|gif|ico|jpg|jpeg|js|json|map|pdf|png|svg|txt|webp|xml)$/i;

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/logo/") || publicAssetPattern.test(pathname)) {
    return NextResponse.next();
  }

  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = publicRoutes.includes(pathname);

  if (!user) {
    if (!isPublicRoute) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return res;
  }

  if (!user.email_confirmed_at) {
    if (pathname !== "/pending-approval") {
      return NextResponse.redirect(new URL("/pending-approval", req.url));
    }

    return res;
  }

  const { data: member } = await supabase
    .from("members")
    .select("status, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isApproved = member?.status === "approved";
  const isSuspended = member?.status === "suspended";

  if (isApproved && authLandingRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isSuspended) {
    if (pathname !== "/account-suspended") {
      return NextResponse.redirect(new URL("/account-suspended", req.url));
    }

    return res;
  }

  if (!isApproved) {
    if (pathname !== "/pending-approval") {
      return NextResponse.redirect(new URL("/pending-approval", req.url));
    }

    return res;
  }

  for (const route of roleProtectedRoutes) {
    if (
      pathname.startsWith(route.prefix) &&
      !route.allowedRoles.includes(member.role as Role)
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo/).*)"],
};
