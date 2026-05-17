import { createClient } from '@supabase/supabase-js'

function parseCookies(str = '') {
  return Object.fromEntries(
    str.split(';')
      .map(c => { const [k, ...v] = c.trim().split('='); return [k.trim(), v.join('=')] })
      .filter(([k]) => k),
  )
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const cookies = parseCookies(req.headers.cookie)
  const token = cookies.bt_session
  if (!token) return res.status(401).json({ error: 'no_session' })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const { data, error } = await supabase.rpc('verify_session', { p_token: token })

  if (error || !data?.length) {
    res.setHeader('Set-Cookie', 'bt_session=; Path=/; HttpOnly; Secure; Max-Age=0; SameSite=Strict')
    return res.status(401).json({ error: 'invalid_session' })
  }

  return res.status(200).json({ profile: data[0] })
}
