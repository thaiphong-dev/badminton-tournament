import { randomBytes } from 'crypto'

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = randomBytes(32).toString('hex')
  // Không httpOnly — JS phải đọc được để gửi lại qua header X-CSRF-Token
  res.setHeader('Set-Cookie', `csrf_token=${token}; Path=/; Secure; SameSite=Strict; Max-Age=86400`)
  return res.status(200).json({ token })
}
