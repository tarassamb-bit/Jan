import { createClient } from '@supabase/supabase-js';

export function accessError(status, message, code) {
  return Object.assign(new Error(message), { status, code });
}

export async function authenticateRequest(req, env) {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) throw accessError(401, 'Sign in to send messages. Live AI is unavailable in the local demo.', 'AUTH_REQUIRED');
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw accessError(503, 'Account verification is not configured.', 'AUTH_NOT_CONFIGURED');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error?.message?.toLowerCase().includes('invalid api key')) throw accessError(503, 'Account verification is not configured.', 'AUTH_NOT_CONFIGURED');
  if (error || !data?.user) throw accessError(401, 'Your session has expired. Please sign in again.', 'AUTH_REQUIRED');
  return { user: data.user, db };
}

export async function consumeMessage({ user, db }) {
  const { data, error } = await db.rpc('consume_chat_message', { p_user_id: user.id });
  if (error) {
    if (error.message?.includes('DAILY_MESSAGE_LIMIT')) throw accessError(429, 'You have used your 100 messages for today. Your allowance resets at midnight UTC.', 'DAILY_MESSAGE_LIMIT');
    if (error.code === 'PGRST202') throw accessError(503, 'Chat needs a database update before it can respond.', 'DATABASE_SETUP_REQUIRED');
    throw accessError(503, 'Usage verification is unavailable. Please try again later.', 'USAGE_UNAVAILABLE');
  }
  return data;
}
