import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Copy, Check, CheckCircle, Upload,
  AlertCircle, Loader2, QrCode,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils/cn'

function formatVND(n) {
  return Number(n).toLocaleString('vi-VN') + ' đ'
}

function StepDot({ n, active, done }) {
  return (
    <div className={cn(
      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
      done  && 'bg-green-500 text-white',
      active && !done && 'bg-blue-600 text-white ring-4 ring-blue-100',
      !active && !done && 'bg-gray-100 text-gray-400',
    )}>
      {done ? <Check className="w-3.5 h-3.5" /> : n}
    </div>
  )
}

export default function CheckoutPage() {
  const { planId }       = useParams()
  const [searchParams]   = useSearchParams()
  const navigate         = useNavigate()
  const { profile, role } = useAuth()
  const fileInputRef     = useRef(null)

  const orderId  = searchParams.get('orderId')
  const type     = searchParams.get('type')
  const isAddon  = type === 'addon' && !!orderId

  const [plan, setPlan]         = useState(null)
  const [bankInfo, setBankInfo] = useState(null)
  const [order, setOrder]       = useState(null)
  const [step, setStep]         = useState(1)

  const [proofFile, setProofFile]   = useState(null)
  const [proofNote, setProofNote]   = useState('')
  const [copied, setCopied]         = useState(false)
  const [creating, setCreating]     = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [loadError, setLoadError]   = useState(null)
  const [actionError, setActionError] = useState(null)
  const [loading, setLoading]       = useState(true)

  // Redirect if not a creator
  useEffect(() => {
    if (!loading && (!profile || (role !== 'creator' && role !== 'admin'))) {
      navigate('/plans')
    }
  }, [profile, role, loading, navigate])

  // Load data
  useEffect(() => {
    if (isAddon) {
      loadAddonFlow()
    } else {
      if (!planId) { navigate('/plans'); return }
      loadSubscriptionFlow()
    }
  }, [planId, orderId, isAddon])

  async function loadAddonFlow() {
    const [orderRes, bankRes] = await Promise.all([
      supabase
        .from('payment_orders')
        .select('*, addon:subscription_addons!addon_id(addon_type, quantity)')
        .eq('id', orderId)
        .single(),
      supabase.from('app_config').select('value').eq('key', 'bank_info').maybeSingle(),
    ])
    if (orderRes.error || !orderRes.data) {
      setLoadError('Không tìm thấy đơn hàng.'); setLoading(false); return
    }
    setOrder(orderRes.data)
    setBankInfo(bankRes.data?.value ?? null)

    const addonPricingRes = await supabase
      .from('app_config').select('value').eq('key', 'addon_pricing').maybeSingle()
    const addonType = orderRes.data?.addon?.addon_type ?? 'tournament_slot'
    const qty       = orderRes.data?.addon?.quantity ?? 1
    const label     = addonPricingRes.data?.value?.[addonType]?.label ?? '+1 Slot giải đấu'
    setPlan({
      name:  qty > 1 ? `${label} ×${qty}` : label,
      price: orderRes.data?.amount,
    })
    setStep(2)
    setLoading(false)
  }

  async function loadSubscriptionFlow() {
    const [planRes, bankRes] = await Promise.all([
      supabase.from('subscription_plans').select('*').eq('id', planId).single(),
      supabase.from('app_config').select('value').eq('key', 'bank_info').maybeSingle(),
    ])
    if (planRes.error || !planRes.data) {
      setLoadError('Không tìm thấy gói dịch vụ.'); setLoading(false); return
    }
    if (planRes.data.slug === 'free') { navigate('/plans'); return }
    setPlan(planRes.data)
    setBankInfo(bankRes.data?.value ?? null)
    setLoading(false)
  }

  const qrUrl = bankInfo?.bank_bin && bankInfo?.bank_account && order
    ? `https://img.vietqr.io/image/${bankInfo.bank_bin}-${bankInfo.bank_account}-compact2.jpg` +
      `?amount=${order?.amount ?? plan?.price ?? 0}&addInfo=${encodeURIComponent(order.transfer_content)}&accountName=${encodeURIComponent(bankInfo.bank_owner ?? '')}`
    : null

  async function handleCreateOrder() {
    if (!profile?.id || !planId) return
    setCreating(true)
    setActionError(null)
    const { data, error } = await supabase.rpc('create_payment_order', {
      p_creator_id: profile.id,
      p_plan_id:    planId,
    })

    if (error) {
      if (error.message.includes('order_already_pending')) {
        // Load the existing waiting order and proceed to step 2
        const { data: existing } = await supabase
          .from('payment_orders')
          .select('id, amount, transfer_content, status')
          .eq('creator_id', profile.id)
          .eq('status', 'waiting')
          .maybeSingle()
        setCreating(false)
        if (existing) {
          setOrder(existing)
          setStep(2)
        } else {
          setActionError('Đã có đơn hàng đang chờ xử lý. Vui lòng kiểm tra trang lịch sử thanh toán.')
        }
        return
      }
      setActionError(error.message)
      setCreating(false)
      return
    }

    // RPC returns { order_id, subscription_id, transfer_content, amount }
    const newOrderId = data?.order_id
    if (!newOrderId) {
      setActionError('Không thể tạo đơn hàng. Vui lòng thử lại.')
      setCreating(false)
      return
    }
    const { data: orderRow, error: fetchErr } = await supabase
      .from('payment_orders')
      .select('id, amount, transfer_content, status')
      .eq('id', newOrderId)
      .single()
    setCreating(false)
    if (fetchErr || !orderRow) {
      setActionError('Đơn hàng đã được tạo nhưng không thể tải thông tin. Vui lòng liên hệ admin.')
      return
    }
    setOrder(orderRow)
    setStep(2)
  }

  async function handleSubmitProof() {
    if (!order?.id || !profile?.id) return
    if (!proofFile && !proofNote.trim()) return
    setUploading(true)
    setActionError(null)

    let uploadedPath = null
    if (proofFile) {
      const MIME_TO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
      const ext      = MIME_TO_EXT[proofFile.type] ?? 'jpg'
      const fileName = `${profile.id}/${order.id}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, proofFile, { upsert: false })
      if (uploadErr) {
        setActionError('Upload ảnh thất bại: ' + uploadErr.message)
        setUploading(false)
        return
      }
      uploadedPath = uploadData.path
    }

    const { error: proofErr } = await supabase.rpc('submit_payment_proof', {
      p_creator_id: profile.id,
      p_order_id:   order.id,
      p_proof_url:  uploadedPath,
      p_proof_note: proofNote.trim() || null,
    })
    setUploading(false)
    if (proofErr) {
      setActionError(proofErr.message)
      return
    }
    setStep(3)
  }

  async function copyTransferContent() {
    if (!order?.transfer_content) return
    await navigator.clipboard.writeText(order.transfer_content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Loading / error ───────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  if (loadError) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <p className="text-red-600 mb-4">{loadError}</p>
      <Link to="/plans" className="text-blue-600 underline text-sm">← Xem danh sách gói</Link>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">

      {/* Back */}
      <Link to="/plans" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Quay lại bảng giá
      </Link>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[
          { n: 1, label: 'Xác nhận' },
          { n: 2, label: 'Chuyển khoản' },
          { n: 3, label: 'Hoàn thành' },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-3">
            {i > 0 && <div className={cn('h-px flex-1 w-10', step > i ? 'bg-blue-500' : 'bg-gray-200')} />}
            <div className="flex items-center gap-2">
              <StepDot n={s.n} active={step === s.n} done={step > s.n} />
              <span className={cn('text-xs hidden sm:block', step === s.n ? 'font-semibold text-gray-900' : 'text-gray-400')}>
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Step 1: Confirm order ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4 text-lg">Xác nhận đơn hàng</h2>

            {/* Plan summary */}
            <div className="bg-blue-50 rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Gói dịch vụ</p>
                  <p className="font-bold text-gray-900 text-lg">{plan.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {plan.duration_days ? `${plan.duration_days} ngày` : 'Vĩnh viễn'}
                  </p>
                </div>
                <p className="text-2xl font-extrabold text-blue-600">{formatVND(plan.price)}</p>
              </div>
            </div>

            {/* Bank info */}
            {bankInfo ? (
              <div className="space-y-2 mb-5">
                <h3 className="text-sm font-semibold text-gray-700">Thông tin nhận thanh toán</h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <Row label="Ngân hàng">{bankInfo.bank_name}</Row>
                  <Row label="Số tài khoản">
                    <span className="font-mono font-semibold">{bankInfo.bank_account}</span>
                  </Row>
                  <Row label="Chủ tài khoản">
                    <span className="font-semibold">{bankInfo.bank_owner}</span>
                  </Row>
                  {bankInfo.bank_branch && <Row label="Chi nhánh">{bankInfo.bank_branch}</Row>}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-5 text-sm text-yellow-700">
                Thông tin ngân hàng chưa được cấu hình. Vui lòng liên hệ admin.
              </div>
            )}

            <p className="text-xs text-gray-400 mb-5">
              Sau khi nhấn "Tạo đơn hàng", bạn sẽ nhận được mã nội dung chuyển khoản riêng.
              Admin xác nhận trong <strong>24h làm việc</strong>.
            </p>

            {actionError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {actionError}
              </div>
            )}

            <button
              onClick={handleCreateOrder}
              disabled={creating || !bankInfo}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...</> : 'Tạo đơn hàng →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: QR + Proof upload ── */}
      {step === 2 && order && (
        <div className="space-y-5">

          {/* Transfer info */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4 text-lg">Thông tin chuyển khoản</h2>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm mb-4">
              <Row label="Số tiền">
                <span className="font-bold text-red-600 text-base">{formatVND(order.amount ?? plan.price)}</span>
              </Row>
              <Row label="Nội dung CK">
                <span className="font-mono bg-white border border-gray-200 px-2 py-0.5 rounded text-sm font-semibold">
                  {order.transfer_content}
                </span>
                <button
                  onClick={copyTransferContent}
                  className="ml-2 text-blue-600 hover:text-blue-700 transition-colors"
                  title="Copy"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </Row>
              {bankInfo && (
                <>
                  <Row label="Ngân hàng">{bankInfo.bank_name}</Row>
                  <Row label="Số TK"><span className="font-mono font-semibold">{bankInfo.bank_account}</span></Row>
                  <Row label="Chủ TK">{bankInfo.bank_owner}</Row>
                </>
              )}
            </div>

            <p className="text-xs text-red-600 font-medium mb-4">
              ⚠ Nhập đúng nội dung chuyển khoản để admin xác nhận nhanh hơn.
            </p>

            {/* QR Code */}
            {qrUrl && (
              <div className="flex flex-col items-center py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-3 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" /> Quét QR để thanh toán nhanh
                </p>
                <img
                  src={qrUrl}
                  alt="VietQR"
                  className="w-52 h-52 rounded-xl border border-gray-100 object-contain bg-white"
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
              </div>
            )}
          </div>

          {/* Proof upload */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="font-semibold text-gray-900 mb-1 text-lg">Nộp bằng chứng thanh toán</h2>
            <p className="text-sm text-gray-400 mb-5">
              Sau khi chuyển khoản, upload ảnh xác nhận hoặc nhập mã giao dịch.
            </p>

            {/* File upload dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-4',
                proofFile
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null
                  if (!file) return
                  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
                  if (!ALLOWED_MIME.includes(file.type)) {
                    setActionError('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.')
                    e.target.value = ''
                    return
                  }
                  if (file.size > 10 * 1024 * 1024) {
                    setActionError('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 10MB.')
                    e.target.value = ''
                    return
                  }
                  setProofFile(file)
                  setActionError(null)
                }}
              />
              {proofFile ? (
                <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">{proofFile.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setProofFile(null) }}
                    className="ml-2 text-gray-400 hover:text-red-500"
                  >✕</button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Chọn ảnh chụp màn hình thanh toán</p>
                  <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP</p>
                </>
              )}
            </div>

            <p className="text-xs text-gray-400 text-center mb-4">— hoặc —</p>

            <div className="mb-5">
              <label className="block text-xs text-gray-500 mb-1">Mã giao dịch / Reference code</label>
              <input
                value={proofNote}
                onChange={e => setProofNote(e.target.value)}
                placeholder="VD: FT24050100012345"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            {actionError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {actionError}
              </div>
            )}

            <button
              onClick={handleSubmitProof}
              disabled={uploading || (!proofFile && !proofNote.trim())}
              className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...</>
                : 'Xác nhận đã chuyển khoản'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ── */}
      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-9 h-9 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Đơn hàng đã được gửi!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Admin sẽ xác nhận thanh toán trong <strong>24h làm việc</strong>.
            Gói của bạn được kích hoạt ngay khi được duyệt.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-2 mb-6">
            <Row label="Gói">{plan.name}</Row>
            <Row label="Số tiền">{formatVND(plan.price)}</Row>
            {order && (
              <>
                <Row label="Mã đơn hàng">
                  <span className="font-mono text-xs">{order.id.slice(0, 8).toUpperCase()}</span>
                </Row>
                <Row label="Nội dung CK">
                  <span className="font-mono text-xs font-semibold">{order.transfer_content}</span>
                </Row>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Về trang chủ
            </button>
            <button
              onClick={() => navigate('/creator/subscription')}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              {isAddon ? 'Xem add-on của tôi →' : 'Xem trạng thái đơn →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 w-28 shrink-0 text-xs">{label}</span>
      <div className="flex items-center gap-1 text-gray-800">{children}</div>
    </div>
  )
}
