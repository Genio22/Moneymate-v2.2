import { supabase } from '../lib/supabase'

export class ApiError extends Error {}

/** Turn Supabase/Postgres errors into friendly messages. */
export function humanize(error) {
  if (!error) return 'Something went wrong'
  let msg = error.message || String(error)
  // strip driver noise
  msg = msg.replace(/^(AuthApiError|PostgrestError|TypeError):?\s*/i, '')
  // friendly names for common Postgres constraint/RLS failures
  if (/row-level security/i.test(msg)) msg = 'You are not allowed to perform this action.'
  if (/duplicate key/i.test(msg)) msg = 'This record already exists.'
  if (/Failed to fetch|NetworkError/i.test(msg)) {
    msg = 'Cannot reach MoneyMate. Check your internet connection and Supabase configuration.'
  }
  if (/Invalid login credentials/i.test(msg)) msg = 'Wrong email or password.'
  if (/Email not confirmed/i.test(msg)) msg = 'Please confirm your email first — check your inbox.'
  return msg.charAt(0).toUpperCase() + msg.slice(1)
}

/** Run a supabase query builder, unwrap the error, return data. */
export async function q(builder) {
  const { data, error } = await builder
  if (error) throw new ApiError(humanize(error))
  return data
}

/** Run a SECURITY DEFINER database function. */
export async function rpc(fnName, args = {}) {
  return q(supabase.rpc(fnName, args))
}
