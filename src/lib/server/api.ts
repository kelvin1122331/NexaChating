import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ApiError } from '@/lib/types/api';
import type { Database } from '@/lib/types/database';

interface RateLimitOptions { limit: number; windowSeconds: number; namespace: string; }
interface MemoryBucket { count: number; resetAt: number; }
interface RateLimitCheck { allowed: boolean; retryAfterSeconds: number; }

const globalRateLimits = globalThis as typeof globalThis & {
  __nexaMemoryLimits?: Map<string, MemoryBucket>;
  __nexaUpstash?: Redis;
  __nexaLimiters?: Map<string, Ratelimit>;
};

export type AuthenticatedApiContext = {
  supabase: SupabaseClient<Database>;
  user: User;
};
export type ApiAuthorization =
  | { ok: true; context: AuthenticatedApiContext }
  | { ok: false; response: NextResponse };

/** Creates a typed JSON error response without disclosing server-side exception details. */
export function apiError(status: number, error: string, code?: string): NextResponse<ApiError> {
  const body: ApiError = { error, ...(code ? { code } : {}) };
  return NextResponse.json<ApiError>(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Validates a mutating request's same-origin header against the forwarded host and configured app URL. */
export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  let originUrl: URL;
  try { originUrl = new URL(origin); }
  catch { return false; }
  if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') return false;
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const requestHost = forwardedHost || request.headers.get('host');
  if (requestHost && originUrl.host.toLowerCase() === requestHost.toLowerCase()) return true;
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredAppUrl) return false;
  try { return originUrl.origin === new URL(configuredAppUrl).origin; }
  catch { return false; }
}

function getUpstashRateLimiter(options: RateLimitOptions): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    globalRateLimits.__nexaUpstash ??= Redis.fromEnv();
    globalRateLimits.__nexaLimiters ??= new Map<string, Ratelimit>();
    const key = `${options.namespace}:${options.limit}:${options.windowSeconds}`;
    const existing = globalRateLimits.__nexaLimiters.get(key);
    if (existing) return existing;
    const limiter = new Ratelimit({
      redis: globalRateLimits.__nexaUpstash,
      limiter: Ratelimit.slidingWindow(options.limit, `${options.windowSeconds} s`),
      prefix: `nexachat:${options.namespace}`,
      analytics: false,
    });
    globalRateLimits.__nexaLimiters.set(key, limiter);
    return limiter;
  } catch (error) {
    console.warn('[NexaChat rate limit] Upstash is unavailable; using the local fallback.', error);
    return null;
  }
}

async function checkRateLimit(identifier: string, options: RateLimitOptions): Promise<RateLimitCheck> {
  const upstash = getUpstashRateLimiter(options);
  if (upstash) {
    try {
      const result = await upstash.limit(identifier);
      return { allowed: result.success, retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1_000)) };
    } catch (error) {
      console.warn('[NexaChat rate limit] Redis request failed; using the local fallback.', error);
    }
  }

  const now = Date.now();
  globalRateLimits.__nexaMemoryLimits ??= new Map<string, MemoryBucket>();
  const key = `${options.namespace}:${identifier}`;
  const bucket = globalRateLimits.__nexaMemoryLimits.get(key);
  if (!bucket || bucket.resetAt <= now) {
    globalRateLimits.__nexaMemoryLimits.set(key, { count: 1, resetAt: now + options.windowSeconds * 1_000 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= options.limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)) };
  bucket.count += 1;
  if (globalRateLimits.__nexaMemoryLimits.size > 10_000) {
    for (const [expiredKey, entry] of globalRateLimits.__nexaMemoryLimits) if (entry.resetAt <= now) globalRateLimits.__nexaMemoryLimits.delete(expiredKey);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Enforces same-origin mutations, RLS-backed Supabase auth, and per-user request limits. */
export async function authorizeApiRequest(
  request: Request,
  options: { mutating?: boolean; rateLimit?: RateLimitOptions } = {},
): Promise<ApiAuthorization> {
  const mutating = options.mutating ?? !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  if (mutating && !hasTrustedOrigin(request)) return { ok: false, response: apiError(403, 'Request origin was not allowed.', 'ORIGIN_REJECTED') };

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, response: apiError(503, 'Supabase is not configured for this deployment.', 'BACKEND_NOT_CONFIGURED') };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false, response: apiError(401, 'Sign in to continue.', 'UNAUTHENTICATED') };

  if (options.rateLimit) {
    const result = await checkRateLimit(user.id, options.rateLimit);
    if (!result.allowed) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Too many requests. Please try again shortly.', code: 'RATE_LIMITED' }, {
          status: 429,
          headers: { 'Retry-After': String(result.retryAfterSeconds), 'Cache-Control': 'no-store' },
        }),
      };
    }
  }
  return { ok: true, context: { supabase, user } };
}

/** Confirms that the caller is an active member before a handler touches conversation data. */
export async function requireConversationMembership(
  context: AuthenticatedApiContext,
  conversationId: string,
): Promise<boolean> {
  const { data, error } = await context.supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', context.user.id)
    .is('left_at', null)
    .maybeSingle();
  return !error && Boolean(data);
}

/** Parses JSON request bodies without allowing malformed data to escape a route handler. */
export async function readJsonBody(request: Request): Promise<unknown | null> {
  try { return await request.json() as unknown; }
  catch { return null; }
}
