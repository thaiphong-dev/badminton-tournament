import { createClient } from '@supabase/supabase-js'

function parseCookies(str = '') {
  return Object.fromEntries(
    str.split(';')
      .map(c => { const [k, ...v] = c.trim().split('='); return [k.trim(), v.join('=')] })
      .filter(([k]) => k),
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const cookies = parseCookies(req.headers.cookie)
  const token = cookies.bt_session

  if (token) {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )
    // Revoke session trên DB — fire-and-forget, không block response
    supabase.rpc('logout_session', { p_token: token }).catch(() => {})
  }

  res.setHeader('Set-Cookie', 'bt_session=; Path=/; HttpOnly; Secure; Max-Age=0; SameSite=Strict')
  return res.status(200).json({ ok: true })
}
