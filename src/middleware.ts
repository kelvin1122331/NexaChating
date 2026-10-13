import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/types/database';

/** Refreshes Supabase sessions and guards the authenticated workspace routes. */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith('/login') || path.startsWith('/verify');
  const isPublicPage = path === '/' || path.startsWith('/offline');

  if (!user && !isAuthPage && !isPublicPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  if (user && isAuthPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/chat';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|sounds/|sw.js).*)'],
};
