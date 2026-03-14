import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context — cookie setting ignored
          }
        },
      },
    }
  );
}

/** Use in Route Handlers (API routes) so auth reads from the request's Cookie header. */
export function createClientFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieList = cookieHeader.split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
    const eq = s.indexOf("=");
    const name = eq === -1 ? s : s.slice(0, eq).trim();
    const value = eq === -1 ? "" : s.slice(eq + 1).trim();
    return { name, value };
  });

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieList;
        },
        setAll() {
          // Route Handler: cookies are read-only for this request; client keeps existing session
        },
      },
    }
  );
}

export async function createServiceClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
