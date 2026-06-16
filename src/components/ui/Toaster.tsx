import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

function Toast({ id, message, type, onClose }) {
  const icons  = { error: AlertCircle, success: CheckCircle, info: Info, warning: AlertTriangle }
  const colors = {
    error:   'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  }
  const Icon = icons[type] || AlertCircle

  useEffect(() => {
    const t = setTimeout(() => onClose(id), 4000)
    return () => clearTimeout(t)
  }, [id, onClose])

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border shadow-md max-w-sm w-full ${colors[type] || colors.error}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <p className="text-sm flex-1 leading-snug">{message}</p>
      <button onClick={() => onClose(id)} className="opacity-50 hover:opacity-100 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function Toaster() {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    function handler(e) {
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev.slice(-4), { id, ...e.detail }])
    }
    window.addEventListener('app-toast', handler)
    return () => window.removeEventListener('app-toast', handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast id={t.id} message={t.message} type={t.type || 'error'} onClose={remove} />
        </div>
      ))}
    </div>
  )
}
