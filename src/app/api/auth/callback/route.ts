import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Exchanges the one-time Supabase PKCE code for a secure session cookie. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const requestedNext = request.nextUrl.searchParams.get('next');
  const safeNext = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/chat';
  const supabase = await createServerSupabaseClient();
  if (!supabase || !code) return NextResponse.redirect(new URL('/login?error=auth-not-configured', request.url));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/login?error=link-expired', request.url));
  return NextResponse.redirect(new URL(safeNext, request.url));
}
