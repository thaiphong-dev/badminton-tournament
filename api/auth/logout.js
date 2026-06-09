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

  // CSRF validation
  const csrfHeader = req.headers['x-csrf-token'] ?? ''
  const cookies = parseCookies(req.headers.cookie)
  if (!csrfHeader || csrfHeader !== cookies.csrf_token) {
    return res.status(403).json({ error: 'invalid_csrf' })
  }

  // Revoke DB session — optional, never block the response
  const token = cookies.bt_session
  if (token) {
    try {
      const url = process.env.SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        const supabase = createClient(url, key)
        await supabase.rpc('logout_session', { p_token: token })
      }
    } catch { /* ignore — cookie will be cleared anyway */ }
  }

  res.setHeader('Set-Cookie', [
    'bt_session=; Path=/; HttpOnly; Secure; Max-Age=0; SameSite=Strict',
    'csrf_token=; Path=/; Secure; Max-Age=0; SameSite=Strict',
  ])
  return res.status(200).json({ ok: true })
}
