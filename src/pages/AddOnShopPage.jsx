import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trophy, Loader2, AlertCircle, ArrowLeft, Minus, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'

function formatVND(n) {
  return Number(n).toLocaleString('vi-VN') + ' đ'
}

export default function AddOnShopPage() {
  const { profile, role } = useAuth()
  const navigate = useNavigate()

  const [pricing, setPricing]       = useState(null)
  const [activeSlots, setActiveSlots] = useState(0)
  const [quantity, setQuantity]     = useState(1)
  const [creating, setCreating]     = useState(false)
  const [error, setError]           = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!profile) return
    if (role !== 'creator' && role !== 'admin') {
      navigate('/plans')
      return
    }
    load()
  }, [profile?.id, role])

  async function load() {
    try {
      const [configRes, addonsRes] = await Promise.all([
        supabase.from('app_config').select('value').eq('key', 'addon_pricing').maybeSingle(),
        supabase
          .from('subscription_addons')
          .select('addon_type, quantity')
          .eq('creator_id', profile.id)
          .eq('status', 'active'),
      ])

      setPricing(
        configRes.data?.value ?? {
          tournament_slot: { price: 50000, label: '+1 Slot giải đấu', description: 'Thêm 1 slot giải đấu active. Không có thời hạn riêng.' },
        }
      )

      const slots = (addonsRes.data ?? [])
        .filter(a => a.addon_type === 'tournament_slot')
        .reduce((sum, a) => sum + a.quantity, 0)
      setActiveSlots(slots)
    } catch (err) {
      setError('Không thể tải dữ liệu shop. Vui lòng thử lại.')
      console.error('[AddOnShopPage] load error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateOrder() {
    setCreating(true)
    setError(null)
    const { data, error: rpcErr } = await supabase.rpc('create_addon_order', {
      p_creator_id: profile.id,
      p_addon_type: 'tournament_slot',
      p_quantity:   quantity,
    })
    if (rpcErr) {
      if (rpcErr.message.includes('order_already_pending')) {
        setError('Bạn đang có 1 đơn hàng chờ duyệt. Vui lòng chờ admin xác nhận.')
      } else {
        setError(rpcErr.message)
      }
      setCreating(false)
      return
    }
    navigate(`/checkout?orderId=${data.order_id}&type=addon`)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  const slotPricing = pricing?.tournament_slot
  const unitPrice   = slotPricing?.price ?? 50000
  const total       = unitPrice * quantity

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">

      <Link to="/plans" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Gói dịch vụ
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mua thêm dịch vụ</h1>
        <p className="text-gray-500 text-sm">Bổ sung tính năng riêng lẻ mà không cần thay đổi gói</p>
      </div>

      <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">

        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">{slotPricing?.label ?? '+1 Slot giải đấu'}</h2>
          <p className="text-sm text-gray-500 mb-3">
            {slotPricing?.description ?? 'Thêm 1 slot giải đấu active. Không có thời hạn riêng — tồn tại cho đến khi bạn dùng hết.'}
          </p>
          <p className="text-3xl font-bold text-blue-600">{formatVND(unitPrice)}<span className="text-base font-normal text-gray-400"> / slot</span></p>
        </div>

        {activeSlots > 0 && (
          <div className="bg-blue-50 text-blue-700 text-sm rounded-lg px-4 py-2.5 text-center mb-4">
            Bạn đang có <strong>{activeSlots}</strong> slot add-on active
          </div>
        )}

        <hr className="border-gray-100 mb-5" />

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-700">Số lượng</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(v => Math.max(1, v - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center font-semibold text-gray-900">{quantity}</span>
            <button
              onClick={() => setQuantity(v => Math.min(10, v + 1))}
              disabled={quantity >= 10}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-lg font-bold text-gray-900 mb-5">
          <span>Tổng cộng:</span>
          <span className="text-blue-600">{formatVND(total)}</span>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleCreateOrder}
          disabled={creating}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...</> : 'Tạo đơn hàng →'}
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        Thanh toán qua chuyển khoản ngân hàng · Admin xác nhận trong 24h
      </p>

      <p className="text-center text-sm text-gray-500 mt-3">
        <Link to="/plans" className="text-blue-600 hover:underline">Xem và so sánh các gói dịch vụ</Link>
      </p>
    </div>
  )
}
