// Cloud build (VITE_CLOUD=1) — auto-sync through Supabase instead of the Node backend.
//
// The app is already local-first: state lives in localStorage and is pushed/pulled as one
// JSON blob stamped with `_ts`. This module only swaps the transport. Auth is Supabase email +
// password over plain REST (no SDK), and the blob lives in `public.user_state`, one row per
// user, protected by row-level security — the publishable key below is safe to ship.
export const CLOUD = import.meta.env.VITE_CLOUD === '1'

const URL_ = import.meta.env.VITE_SUPABASE_URL || 'https://lmkbmpbwzmqtfhdnptev.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_xSVR1pKicG1dGTSU9NC7WQ_t59BI7R9'
const SESSION = 'gym_sb_session'

const headers = token => ({ 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + (token || KEY) })

function readSession() { try { return JSON.parse(localStorage.getItem(SESSION)) } catch { return null } }
function writeSession(s) {
  if (!s) { localStorage.removeItem(SESSION); return null }
  const ses = {
    access_token: s.access_token, refresh_token: s.refresh_token,
    expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
    user: s.user || readSession()?.user
  }
  localStorage.setItem(SESSION, JSON.stringify(ses))
  return ses
}

async function call(path, opts = {}, token) {
  const r = await fetch(URL_ + path, { ...opts, headers: { ...headers(token), ...(opts.headers || {}) } })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(data.error_description || data.msg || data.message || data.error || ('HTTP ' + r.status))
    e.status = r.status
    throw e
  }
  return data
}

export const cloudUser = () => {
  const u = readSession()?.user
  return u ? { id: u.id, name: (u.email || '').split('@')[0], email: u.email } : null
}

export async function signUp(email, password) {
  const d = await call('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password }) })
  // With "Confirm email" on, Supabase returns the user but no session yet.
  if (!d.access_token) return { needsConfirm: true }
  writeSession(d)
  return { user: cloudUser() }
}

export async function signIn(email, password) {
  const d = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) })
  writeSession(d)
  return { user: cloudUser() }
}

export function signOutCloud() { writeSession(null) }

// A valid access token, refreshed when it is about to lapse. Throws with status 401 when there is
// no session (or the refresh token was revoked); a network failure throws without a status.
async function token() {
  const s = readSession()
  if (!s) { const e = new Error('Not signed in'); e.status = 401; throw e }
  if (s.expires_at - 60 > Date.now() / 1000) return s.access_token
  try {
    const d = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh_token }) })
    return writeSession(d).access_token
  } catch (e) {
    if (e.status === 400 || e.status === 401) { writeSession(null); e.status = 401 }
    throw e
  }
}

export async function pullCloud() {
  const tk = await token()
  const uid = readSession().user.id
  const rows = await call('/rest/v1/user_state?select=state&user_id=eq.' + uid, {}, tk)
  return rows[0]?.state || null
}

export async function pushCloud(state) {
  const tk = await token()
  const uid = readSession().user.id
  await call('/rest/v1/user_state?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: uid, state, updated_at: new Date().toISOString() })
  }, tk)
}
