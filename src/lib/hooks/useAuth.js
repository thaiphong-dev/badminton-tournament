import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ── Dev/Prod auth strategy ────────────────────────────────────────────────────
// IS_DEV = true  (npm run dev):
//   • Session token lưu localStorage (bt_session)
//   • Verify qua Supabase RPC verify_session trực tiếp
//   • Cross-tab sync qua window Event 'auth-change'
//   • Đơn giản, không cần backend, phù hợp cho local dev
//
// IS_DEV = false (build/deploy Vercel):
//   • Session lưu httpOnly cookie do server set (không đọc được từ JS)
//   • Verify qua /api/auth/me (Vercel Edge Function)
//   • Login qua /api/auth/login, logout qua /api/auth/logout + CSRF token
//   • Bảo mật hơn vì token không bị XSS đọc được
//
// Để chuyển môi trường: chỉ cần build (vite build) hoặc chạy dev (vite).
// Không cần thay đổi code. IS_DEV được set tự động bởi Vite.
// ─────────────────────────────────────────────────────────────────────────────

// true khi chạy `npm run dev`, false khi build/deploy lên Vercel
const IS_DEV = import.meta.env.DEV

const SESSION_KEY = 'bt_session'

// ─── Dev helpers (localStorage) ───────────────────────────────────────────────

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (!s?.token) { localStorage.removeItem(SESSION_KEY); return null }
    if (s.expiresAt && new Date(s.expiresAt) < new Date()) {
      localStorage.removeItem(SESSION_KEY); return null
    }
    return s
  } catch { return null }
}

function saveSession(token, profile, expiresAt) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, profile, expiresAt }))
  window.dispatchEvent(new Event('auth-change'))
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new Event('auth-change'))
}

// ─── CSRF helpers (production only) ───────────────────────────────────────────

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return match?.[1] ?? ''
}

async function ensureCsrfToken() {
  if (!getCsrfToken()) {
    await fetch('/api/auth/csrf', { credentials: 'include' }).catch(() => {})
  }
  return getCsrfToken()
}

function broadcastSignOut() {
  window.dispatchEvent(new Event('auth-signout'))
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const initialProfile = IS_DEV ? (readSession()?.profile ?? null) : null
  const [profile, setProfile]           = useState(initialProfile)
  const [verified, setVerified]         = useState(false)
  const [verifyFailed, setVerifyFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (IS_DEV) {
      // Dev: verify qua Supabase RPC trực tiếp
      const s = readSession()
      if (!s?.token) { setVerified(true); return }

      supabase.rpc('verify_session', { p_token: s.token })
        .then(({ data }) => {
          if (cancelled) return
          if (!data?.[0]) { clearSession(); setProfile(null) }
          else {
            localStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, profile: data[0] }))
            setProfile(data[0])
          }
          setVerified(true)
        })
        .catch(() => {
          if (cancelled) return
          setVerifyFailed(true)
          setVerified(true)
        })
    } else {
      // Production: verify qua httpOnly cookie
      fetch('/api/auth/me', { credentials: 'include' })
        .then(async res => {
          if (cancelled) return
          if (res.ok) { const { profile: p } = await res.json(); setProfile(p) }
          else setProfile(null)
          setVerified(true)
        })
        .catch(() => {
          if (cancelled) return
          setVerifyFailed(true)
          setVerified(true)
        })
    }

    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-tab sync
  useEffect(() => {
    if (IS_DEV) {
      function sync() { setProfile(readSession()?.profile ?? null) }
      window.addEventListener('auth-change', sync)
      return () => window.removeEventListener('auth-change', sync)
    } else {
      function onSignOut() { setProfile(null) }
      window.addEventListener('auth-signout', onSignOut)
      return () => window.removeEventListener('auth-signout', onSignOut)
    }
  }, [])

  async function signOut() {
    if (IS_DEV) {
      const s = readSession()
      if (s?.token) {
        try { await supabase.rpc('logout_session', { p_token: s.token }) } catch { /* ignore */ }
      }
      clearSession()
    } else {
      const csrf = await ensureCsrfToken()
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': csrf },
        })
      } catch { /* cookie sẽ expire tự nhiên */ }
      broadcastSignOut()
    }
    setProfile(null)
    setVerified(true)
    setVerifyFailed(false)
  }

  function updateProfileName(name) {
    if (IS_DEV) {
      const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
      if (stored) {
        stored.profile = { ...stored.profile, name }
        localStorage.setItem(SESSION_KEY, JSON.stringify(stored))
      }
    }
    setProfile(prev => prev ? { ...prev, name } : prev)
  }

  return { profile, role: profile?.role ?? null, verified, verifyFailed, signOut, updateProfileName }
}

// ─── loginWithPhone ────────────────────────────────────────────────────────────

export async function loginWithPhone(phone, password) {
  const normalizedPhone = phone.replace(/\D/g, '')

  if (IS_DEV) {
    // Dev: Supabase RPC trực tiếp + localStorage
    const { data, error } = await supabase.rpc('authenticate', {
      p_phone:    normalizedPhone,
      p_password: password,
    })
    if (error) {
      if (error.message?.includes('TOO_MANY_ATTEMPTS')) throw new Error('Quá nhiều lần thử. Vui lòng đợi 15 phút.')
      // RPC có thể throw exception thay vì return empty array khi sai credentials
      throw new Error('Số điện thoại hoặc mật khẩu không đúng.')
    }
    if (!data?.length) throw new Error('Số điện thoại hoặc mật khẩu không đúng.')
    const row = data[0]
    if (!row.session_token) throw new Error('Lỗi hệ thống: không nhận được session token.')
    const { session_token, expires_at, ...profile } = row
    saveSession(session_token, profile, expires_at)
    return profile
  }

  // Production: gọi API route → server set httpOnly cookie
  const csrf = await ensureCsrfToken()
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ phone: normalizedPhone, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    if (res.status === 429) throw new Error('Quá nhiều lần thử. Vui lòng đợi 15 phút.')
    if (res.status === 401) throw new Error('Số điện thoại hoặc mật khẩu không đúng.')
    throw new Error(body.error ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.')
  }
  const { profile } = await res.json()
  return profile
}

// ─── registerWithPhone ────────────────────────────────────────────────────────

export async function registerWithPhone(phone, password, name, role, club = null, gender = null, dob = null) {
  const normalizedPhone = phone.replace(/\D/g, '')

  const { data, error } = await supabase.rpc('register_user', {
    p_phone:    normalizedPhone,
    p_password: password,
    p_name:     name,
    p_role:     role,
    p_club:     club,
  })

  if (error) {
    if (error.message?.includes('phone_already_registered')) throw new Error('Số điện thoại này đã được đăng ký.')
    if (error.message?.includes('TOO_MANY_ATTEMPTS'))        throw new Error('Quá nhiều lần đăng ký. Vui lòng đợi 10 phút.')
    throw new Error('Đăng ký thất bại. Vui lòng thử lại.')
  }
  if (!data?.length) throw new Error('Đăng ký thất bại. Vui lòng thử lại.')

  const profile = await loginWithPhone(phone, password)

  if (role === 'athlete' && gender && dob) {
    await supabase.rpc('set_athlete_profile_details', {
      p_user_id:       profile.id,
      p_gender:        gender,
      p_date_of_birth: dob,
    }).catch(err => console.warn('set_athlete_profile_details:', err.message))
  }

  return profile
}

// ─── Helper ───────────────────────────────────────────────────────────────────

export function defaultPathForRole(role) {
  switch (role) {
    case 'umpire':  return '/umpire'
    case 'athlete': return '/athlete'
    case 'admin':   return '/admin'
    default:        return '/'
  }
}
