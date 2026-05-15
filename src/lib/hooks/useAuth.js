import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const SESSION_KEY = 'bt_session'

function normalizePhone(phone) {
  return phone.replace(/\D/g, '')
}

// Đọc session object { token, profile, expiresAt } từ localStorage.
// Hỗ trợ backward-compat: nếu value cũ là raw profile (không có token), trả về null.
function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (!s) return null
    // Nếu là format cũ (raw profile không có token), clear và trả null
    if (!s.token) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    // Client-side expiry check
    if (s.expiresAt && new Date(s.expiresAt) < new Date()) {
      localStorage.removeItem(SESSION_KEY)
      return null
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

/**
 * Hook đọc session từ localStorage.
 * Lần đầu mount: khởi tạo profile từ cache, sau đó verify token với server.
 * verified = true sau khi server confirm (hoặc xác nhận không có session).
 * verifyFailed = true nếu verify_session gặp lỗi mạng — dùng để fail-closed trên admin routes.
 */
export function useAuth() {
  const initialSession = readSession()
  const [profile, setProfile]       = useState(initialSession?.profile ?? null)
  const [verified, setVerified]     = useState(false)
  const [verifyFailed, setVerifyFailed] = useState(false)

  // Verify token với server khi mount
  useEffect(() => {
    const s = readSession()
    if (!s?.token) {
      setVerified(true)
      return
    }
    supabase.rpc('verify_session', { p_token: s.token }).then(({ data }) => {
      if (!data?.[0]) {
        // Token hết hạn hoặc bị revoke
        clearSession()
        setProfile(null)
      } else {
        // Cập nhật profile mới nhất từ server
        const updated = { ...s, profile: data[0] }
        localStorage.setItem(SESSION_KEY, JSON.stringify(updated))
        setProfile(data[0])
      }
      setVerified(true)
    }).catch(() => {
      // Lỗi mạng — đánh dấu verifyFailed để admin routes fail-closed
      setVerifyFailed(true)
      setVerified(true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function sync() {
      const s = readSession()
      setProfile(s?.profile ?? null)
    }
    window.addEventListener('auth-change', sync)
    return () => window.removeEventListener('auth-change', sync)
  }, [])

  async function signOut() {
    const s = readSession()
    if (s?.token) {
      try { await supabase.rpc('logout_session', { p_token: s.token }) } catch { /* ignore */ }
    }
    clearSession()
    setProfile(null)
    setVerified(true)
  }

  return {
    profile,
    role: profile?.role ?? null,
    verified,
    verifyFailed,
    signOut,
  }
}

/**
 * Đăng nhập bằng số điện thoại + mật khẩu.
 * RPC authenticate() trả về session_token + expires_at (sau khi chạy migration).
 * Fallback: nếu RPC chưa migrate (không có session_token), lưu raw profile tạm.
 */
export async function loginWithPhone(phone, password) {
  const { data, error } = await supabase.rpc('authenticate', {
    p_phone:    normalizePhone(phone),
    p_password: password,
  })

  if (error) {
    if (error.message?.includes('TOO_MANY_ATTEMPTS')) throw new Error('Quá nhiều lần thử. Vui lòng đợi 15 phút.')
    throw new Error('Đã có lỗi xảy ra. Vui lòng thử lại.')
  }
  if (!data || data.length === 0) throw new Error('Số điện thoại hoặc mật khẩu không đúng.')

  const row = data[0]
  if (!row.session_token) {
    throw new Error('Lỗi hệ thống: không nhận được session token. Vui lòng liên hệ admin.')
  }
  const { session_token, expires_at, ...profile } = row
  saveSession(session_token, profile, expires_at)
  return profile
}

/**
 * Đăng ký tài khoản mới.
 */
export async function registerWithPhone(phone, password, name, role, club = null) {
  const { data, error } = await supabase.rpc('register_user', {
    p_phone:    normalizePhone(phone),
    p_password: password,
    p_name:     name,
    p_role:     role,
    p_club:     club,
  })

  if (error) {
    if (error.message?.includes('phone_already_registered')) {
      throw new Error('Số điện thoại này đã được đăng ký.')
    }
    if (error.message?.includes('TOO_MANY_ATTEMPTS')) {
      throw new Error('Quá nhiều lần đăng ký. Vui lòng đợi 10 phút.')
    }
    throw new Error('Đăng ký thất bại. Vui lòng thử lại.')
  }

  if (!data || data.length === 0) throw new Error('Đăng ký thất bại. Vui lòng thử lại.')

  // register_user trả về id/phone/name/role — không có session_token.
  // Tự động authenticate để lấy session token thực.
  return loginWithPhone(phone, password)
}

/** Redirect mặc định theo role */
export function defaultPathForRole(role) {
  switch (role) {
    case 'umpire':  return '/umpire'
    case 'athlete': return '/athlete'
    case 'admin':   return '/admin'
    default:        return '/'
  }
}
