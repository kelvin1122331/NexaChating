import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiError } from '@/lib/server/api';

export const runtime = 'nodejs';
export const maxDuration = 60;

function hasValidCronSecret(request: Request, expectedSecret: string): boolean {
  const authorization = request.headers.get('authorization');
  const supplied = authorization?.startsWith('Bearer ') ? authorization.slice(7) : request.headers.get('x-cron-secret');
  if (!supplied) return false;
  const providedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expectedSecret);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

/** Processes due scheduled messages and expired-message cleanup using the isolated service-role client. */
export async function POST(request: Request): Promise<Response> {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return apiError(503, 'Cron processing is not configured.', 'CRON_NOT_CONFIGURED');
  if (!hasValidCronSecret(request, expectedSecret)) return apiError(401, 'Cron authorization failed.', 'CRON_UNAUTHORIZED');
  const admin = createSupabaseAdminClient();
  if (!admin) return apiError(503, 'Supabase service credentials are not configured.', 'BACKEND_NOT_CONFIGURED');

  const [scheduled, expired] = await Promise.all([
    admin.rpc('process_scheduled_messages'),
    admin.rpc('cleanup_expired_messages'),
  ]);
  if (scheduled.error || expired.error) {
    console.error('[NexaChat cron] Message maintenance failed.', {
      scheduled: scheduled.error?.code,
      expired: expired.error?.code,
    });
    return apiError(500, 'Message maintenance did not complete.', 'CRON_PROCESSING_FAILED');
  }
  return NextResponse.json({
    scheduledMessagesSent: scheduled.data ?? 0,
    expiredMessagesCleaned: expired.data ?? 0,
    processedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
