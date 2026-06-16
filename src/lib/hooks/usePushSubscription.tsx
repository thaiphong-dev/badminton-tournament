import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// VITE_VAPID_PUBLIC_KEY must be set in .env
// Generate with: npx web-push generate-vapid-keys
// Then set VITE_VAPID_PUBLIC_KEY=<publicKey> and store private key server-side
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushSubscription(userId) {
  const [supported,   setSupported]   = useState(false)
  const [permission,  setPermission]  = useState('default') // 'default'|'granted'|'denied'
  const [subscribed,  setSubscribed]  = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
    setSupported(ok)
    if (ok) setPermission(Notification.permission)
  }, [])

  // Check if already subscribed on mount
  useEffect(() => {
    if (!supported || !userId) return
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub))
    })
  }, [supported, userId])

  async function subscribe() {
    if (!supported || !userId) return
    setSubscribing(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      await supabase.rpc('upsert_push_subscription', {
        p_user_id:  userId,
        p_endpoint: sub.endpoint,
        p_p256dh:   btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
        p_auth:     btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
      })

      setSubscribed(true)
    } catch (err) {
      console.error('usePushSubscription.subscribe:', err)
    } finally {
      setSubscribing(false)
    }
  }

  async function unsubscribe() {
    if (!supported || !userId) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await supabase.rpc('delete_push_subscription', {
        p_user_id:  userId,
        p_endpoint: sub.endpoint,
      })
    }
    setSubscribed(false)
  }

  return { supported, permission, subscribed, subscribing, subscribe, unsubscribe }
}
