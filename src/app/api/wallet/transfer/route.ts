import { z } from 'zod';
import { apiError, authorizeApiRequest, readJsonBody } from '@/lib/server/api';

const requestSchema = z.object({
  recipientUserId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000).refine((amount) => Number.isFinite(amount) && Math.round(amount * 100) === amount * 100, 'Amount may have at most two decimal places.'),
  pin: z.string().regex(/^\d{4,8}$/),
  description: z.string().trim().max(240).optional(),
  referenceId: z.string().uuid().optional(),
}).strict();

/** Performs an idempotent wallet-to-wallet transfer through an atomic, PIN-checked database function. */
export async function POST(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 10, windowSeconds: 60, namespace: 'wallet-transfer' },
  });
  if (!authorization.ok) return authorization.response;
  const parsed = requestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError(400, 'The transfer request is invalid.', 'INVALID_REQUEST');
  if (parsed.data.recipientUserId === authorization.context.user.id) {
    return apiError(400, 'Choose a different recipient.', 'RECIPIENT_INVALID');
  }
  const { data: wallet, error: walletError } = await authorization.context.supabase.from('wallets')
    .select('id')
    .eq('user_id', authorization.context.user.id)
    .maybeSingle();
  if (walletError) return apiError(500, 'Wallet information could not be loaded.', 'WALLET_READ_FAILED');
  if (!wallet) return apiError(404, 'Set up a wallet before sending a transfer.', 'WALLET_NOT_FOUND');
  const referenceId = parsed.data.referenceId ?? crypto.randomUUID();
  const { data, error } = await authorization.context.supabase.rpc('wallet_transact', {
    source_wallet_id: wallet.id,
    destination_user_id: parsed.data.recipientUserId,
    transaction_amount: parsed.data.amount,
    transaction_description: parsed.data.description ?? null,
    transaction_type: 'transfer',
    transaction_pin: parsed.data.pin,
    transaction_reference_id: referenceId,
  });
  if (error) {
    if (error.code === '42501' && error.message.toLowerCase().includes('pin')) {
      return apiError(403, 'The wallet PIN is incorrect or has not been configured.', 'WALLET_PIN_INVALID');
    }
    if (error.code === 'P0002') return apiError(404, 'A wallet for the sender or recipient could not be found.', 'WALLET_NOT_FOUND');
    if (error.code === '23514') return apiError(409, 'The wallet balance is insufficient for this transfer.', 'INSUFFICIENT_BALANCE');
    if (error.code === '22023') return apiError(400, 'The transfer details are invalid.', 'TRANSFER_INVALID');
    console.error('[NexaChat wallet] Transfer was rejected.', error.code);
    return apiError(500, 'The transfer could not be completed.', 'TRANSFER_FAILED');
  }
  return Response.json({ transfer: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
