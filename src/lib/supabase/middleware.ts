import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup");
  const isKidPage = path.startsWith("/dashboard/kid") || path.startsWith("/kid");
  const isStudentEntry = path === "/student";

  const isParentProtected =
    path.startsWith("/dashboard/parent") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/parent");

  const isSessionPage = path.startsWith("/session");

  // Kid pages don't require Supabase auth — they use access codes stored in cookies/localStorage
  if (isKidPage || isStudentEntry) {
    return supabaseResponse;
  }

  // Session pages are accessible by both parents and kids
  if (isSessionPage) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users away from parent-protected pages
  if (!user && isParentProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login/signup
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/parent";
    return NextResponse.redirect(url);
  }

  // Redirect /dashboard to /dashboard/parent for logged-in parents
  if (user && path === "/dashboard") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/parent";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
