import { createClient } from '@supabase/supabase-js'

function normalizePhone(phone) {
  return phone.replace(/\D/g, '')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { phone, password } = req.body ?? {}
  if (!phone || !password) return res.status(400).json({ error: 'missing_fields' })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const { data, error } = await supabase.rpc('authenticate', {
    p_phone:    normalizePhone(String(phone)),
    p_password: password,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('TOO_MANY_ATTEMPTS')) return res.status(429).json({ error: 'too_many_attempts' })
    return res.status(401).json({ error: 'auth_failed' })
  }

  if (!data?.length) return res.status(401).json({ error: 'invalid_credentials' })

  const row = data[0]
  if (!row.session_token) return res.status(500).json({ error: 'no_token' })

  const { session_token, expires_at, ...profile } = row

  // httpOnly — JS không đọc được dù XSS xảy ra
  res.setHeader('Set-Cookie',
    `bt_session=${session_token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
  )
  return res.status(200).json({ profile })
}
