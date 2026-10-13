import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody } from '@/lib/server/api';

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/),
  confirmation: z.string().regex(/^\d{4,8}$/),
}).strict().refine((value) => value.pin === value.confirmation, { path: ['confirmation'], message: 'PIN values do not match.' });
const weakPins = new Set(['0000', '1111', '1234', '4321', '1212', '0123', '123456', '111111', '000000', '12345678']);

/** Sets a wallet PIN once, hashing it with bcrypt before it reaches the database. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 5, windowSeconds: 300, namespace: 'wallet-pin' },
  });
  if (!authorization.ok) return authorization.response;
  const parsed = pinSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError(400, 'Enter the same 4–8 digit PIN twice.', 'INVALID_PIN');
  if (weakPins.has(parsed.data.pin) || /^([0-9])\1+$/.test(parsed.data.pin)) {
    return apiError(400, 'Choose a less predictable PIN.', 'WEAK_PIN');
  }
  const pinHash = await bcrypt.hash(parsed.data.pin, 12);
  const { error } = await authorization.context.supabase.rpc('set_wallet_pin', { new_pin_hash: pinHash });
  if (error?.code === '23505') return apiError(409, 'A wallet PIN is already set.', 'PIN_ALREADY_SET');
  if (error) {
    console.error('[NexaChat wallet] Wallet PIN could not be set.', error.code);
    return apiError(500, 'The wallet PIN could not be saved.', 'PIN_SAVE_FAILED');
  }
  return Response.json({ configured: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
