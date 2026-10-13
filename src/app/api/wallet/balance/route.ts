import { apiError, authorizeApiRequest } from '@/lib/server/api';

/** Reads the caller's own wallet and a bounded transaction history without exposing the PIN hash. */
export async function GET(request: Request): Promise<Response> {
  const authorization = await authorizeApiRequest(request, {
    rateLimit: { limit: 120, windowSeconds: 60, namespace: 'wallet-read' },
  });
  if (!authorization.ok) return authorization.response;
  const { data: wallet, error } = await authorization.context.supabase.from('wallets')
    .select('id,user_id,balance,currency,is_active,created_at,updated_at')
    .eq('user_id', authorization.context.user.id)
    .maybeSingle();
  if (error) {
    console.error('[NexaChat wallet] Wallet balance could not be loaded.', error.code);
    return apiError(500, 'Wallet information could not be loaded.', 'WALLET_READ_FAILED');
  }
  if (!wallet) return Response.json({ wallet: null, transactions: [], balance: 0, currency: 'USD' }, { headers: { 'Cache-Control': 'no-store' } });
  const { data: transactions, error: transactionError } = await authorization.context.supabase.from('wallet_transactions')
    .select('id,type,amount,fee,reference_id,counterpart_id,description,status,created_at')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (transactionError) {
    console.error('[NexaChat wallet] Wallet transactions could not be loaded.', transactionError.code);
    return apiError(500, 'Wallet transactions could not be loaded.', 'WALLET_READ_FAILED');
  }
  return Response.json({ wallet, transactions: transactions ?? [], balance: wallet.balance, currency: wallet.currency }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
