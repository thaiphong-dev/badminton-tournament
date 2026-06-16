import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils/cn'
import { Plus, Edit2, Eye, EyeOff, X } from 'lucide-react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useFeatureRegistry } from '@/lib/hooks/useFeatureRegistry'

function formatPrice(price) {
  if (!price) return 'Miễn phí'
  return Number(price).toLocaleString('vi-VN') + ' đ'
}

function limitLabel(v) {
  return v == null ? 'Không giới hạn' : v
}

export default function PlansTab({ adminId }) {
  const [plans, setPlans]     = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const { getAllFeatures } = useFeatureRegistry()
  const featuresList = getAllFeatures()

  const fetchPlans = useCallback(async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order')
    setPlans(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  async function handleToggleActive(plan) {
    await supabase.rpc('admin_upsert_plan', {
      p_admin_id:    adminId,
      p_plan_id:     plan.id,
      p_name:        plan.name,
      p_slug:        plan.slug,
      p_price:       plan.price,
      p_duration:    plan.duration_days ?? null,
      p_max_tourn:   plan.max_tournaments ?? null,
      p_max_players: plan.max_players ?? null,
      p_max_events:  plan.max_events ?? null,
      p_features:    plan.features ?? [],
      p_is_active:   !plan.is_active,
      p_sort_order:  plan.sort_order,
    })
    fetchPlans()
  }

  async function handleSave(form) {
    setSaving(true)
    setSaveErr(null)
    const { data: planId, error } = await supabase.rpc('admin_upsert_plan', {
      p_admin_id:    adminId,
      p_plan_id:     form.id ?? null,
      p_name:        form.name.trim(),
      p_slug:        form.slug.trim().toLowerCase(),
      p_price:       parseInt(form.price) || 0,
      p_duration:    form.duration !== '' ? parseInt(form.duration) : null,
      p_max_tourn:   form.max_tournaments !== '' ? parseInt(form.max_tournaments) : null,
      p_max_players: form.max_players !== '' ? parseInt(form.max_players) : null,
      p_max_events:  form.max_events !== '' ? parseInt(form.max_events) : null,
      p_features:    form.features,
      p_is_active:   form.is_active,
      p_sort_order:  parseInt(form.sort_order) || 0,
    })
    if (error) { setSaving(false); setSaveErr(error.message); return }

    // Save i18n fields via direct update (RPC doesn't include them)
    const targetId = planId ?? form.id
    if (targetId) {
      await supabase
        .from('subscription_plans')
        .update({
          name_en:        form.name_en?.trim() || null,
          description_vi: form.description_vi?.trim() || null,
          description_en: form.description_en?.trim() || null,
        })
        .eq('id', targetId)
    }

    setSaving(false)
    setEditing(null)
    fetchPlans()
  }

  if (loading) return <div className="py-16 flex justify-center"><LoadingSpinner /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{plans.length} gói dịch vụ</p>
        <button
          onClick={() => { setEditing('new'); setSaveErr(null) }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tạo gói mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={cn(
              'bg-white border rounded-2xl p-5 flex flex-col',
              plan.is_active ? 'border-gray-200' : 'border-gray-100 opacity-55'
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                {plan.name_en && (
                  <p className="text-xs text-blue-500 font-medium mt-0.5">EN: {plan.name_en}</p>
                )}
                <p className="text-xs text-gray-400 font-mono mt-0.5">{plan.slug}</p>
              </div>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                plan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              )}>
                {plan.is_active ? 'Active' : 'Ẩn'}
              </span>
            </div>

            <p className="text-2xl font-bold text-blue-600">{formatPrice(plan.price)}</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">
              {plan.duration_days ? `${plan.duration_days} ngày` : 'Vĩnh viễn'}
            </p>

            {/* Descriptions */}
            {(plan.description_vi || plan.description_en) && (
              <div className="mb-3 space-y-1">
                {plan.description_vi && (
                  <p className="text-xs text-gray-500 line-clamp-2">🇻🇳 {plan.description_vi}</p>
                )}
                {plan.description_en && (
                  <p className="text-xs text-gray-500 line-clamp-2">🇬🇧 {plan.description_en}</p>
                )}
              </div>
            )}

            <div className="space-y-1 text-xs text-gray-600 mb-3">
              <p>Giải đấu: <span className="font-semibold text-gray-800">{limitLabel(plan.max_tournaments)}</span></p>
              <p>VĐV/giải: <span className="font-semibold text-gray-800">{limitLabel(plan.max_players)}</span></p>
              <p>Nội dung/giải: <span className="font-semibold text-gray-800">{limitLabel(plan.max_events)}</span></p>
            </div>

            {plan.features?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {plan.features.map(f => (
                  <span key={f} className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                    {featuresList.find(fl => fl.key === f)?.label ?? f}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-auto pt-3">
              <button
                onClick={() => { setEditing(plan); setSaveErr(null) }}
                className="flex-1 flex items-center justify-center gap-1 text-xs border border-gray-200 rounded-lg py-2 hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Edit2 className="w-3 h-3" /> Sửa
              </button>
              <button
                onClick={() => handleToggleActive(plan)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 text-xs border rounded-lg py-2 transition-colors',
                  plan.is_active
                    ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                    : 'border-green-200 text-green-600 hover:bg-green-50'
                )}
              >
                {plan.is_active
                  ? <><EyeOff className="w-3 h-3" /> Ẩn</>
                  : <><Eye className="w-3 h-3" /> Hiện</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing !== null && (
        <PlanFormModal
          plan={editing === 'new' ? null : editing}
          featuresList={featuresList}
          saving={saving}
          error={saveErr}
          onSave={handleSave}
          onClose={() => { setEditing(null); setSaveErr(null) }}
        />
      )}
    </div>
  )
}

// ── Plan Form Modal ───────────────────────────────────────────────────────────

function PlanFormModal({ plan, featuresList = [], saving, error, onSave, onClose }) {
  const [form, setForm] = useState({
    id:              plan?.id ?? null,
    name:            plan?.name ?? '',
    name_en:         plan?.name_en ?? '',
    slug:            plan?.slug ?? '',
    price:           plan?.price ?? 0,
    duration:        plan?.duration_days ?? '',
    max_tournaments: plan?.max_tournaments ?? '',
    max_players:     plan?.max_players ?? '',
    max_events:      plan?.max_events ?? '',
    features:        plan?.features ?? [],
    is_active:       plan?.is_active ?? true,
    sort_order:      plan?.sort_order ?? 0,
    description_vi:  plan?.description_vi ?? '',
    description_en:  plan?.description_en ?? '',
  })

  function setF(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  function toggleFeature(key) {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(key)
        ? prev.features.filter(f => f !== key)
        : [...prev.features, key],
    }))
  }

  const isValid = form.name.trim() && form.slug.trim()

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{plan ? `Sửa gói: ${plan.name}` : 'Tạo gói mới'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[72vh] overflow-y-auto">

          {/* Names — VI + EN side by side */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tên gói (VI) *">
              <input value={form.name} onChange={e => setF('name', e.target.value)} className={inputCls} placeholder="Cơ bản" />
            </Field>
            <Field label="Plan name (EN)">
              <input value={form.name_en} onChange={e => setF('name_en', e.target.value)} className={inputCls} placeholder="Basic" />
            </Field>
          </div>

          <Field label={`Slug * ${plan ? '(không thể đổi)' : ''}`}>
            <input
              value={form.slug}
              onChange={e => setF('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              disabled={!!plan}
              className={cn(inputCls, plan && 'bg-gray-50 text-gray-400 cursor-not-allowed')}
              placeholder="basic"
            />
          </Field>

          {/* Descriptions */}
          <Field label="Mô tả (VI)">
            <textarea
              value={form.description_vi}
              onChange={e => setF('description_vi', e.target.value)}
              rows={2}
              className={cn(inputCls, 'resize-none')}
              placeholder="Phù hợp cho BTC tổ chức giải nhỏ..."
            />
          </Field>
          <Field label="Description (EN)">
            <textarea
              value={form.description_en}
              onChange={e => setF('description_en', e.target.value)}
              rows={2}
              className={cn(inputCls, 'resize-none')}
              placeholder="Ideal for organising small tournaments..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Giá (VND)">
              <input type="number" min="0" value={form.price} onChange={e => setF('price', e.target.value)} className={inputCls} placeholder="299000" />
            </Field>
            <Field label="Thời hạn (ngày)">
              <input type="number" min="1" value={form.duration} onChange={e => setF('duration', e.target.value)} className={inputCls} placeholder="Trống = vĩnh viễn" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Max giải">
              <input type="number" min="1" value={form.max_tournaments} onChange={e => setF('max_tournaments', e.target.value)} className={inputCls} placeholder="∞" />
            </Field>
            <Field label="Max VĐV/giải">
              <input type="number" min="1" value={form.max_players} onChange={e => setF('max_players', e.target.value)} className={inputCls} placeholder="∞" />
            </Field>
            <Field label="Max nội dung">
              <input type="number" min="1" value={form.max_events} onChange={e => setF('max_events', e.target.value)} className={inputCls} placeholder="∞" />
            </Field>
          </div>

          <Field label="Tính năng">
            {featuresList.length === 0 ? (
              <p className="text-xs text-gray-400 mt-1">Chưa có tính năng nào trong registry.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1">
                {featuresList.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleFeature(f.key)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      form.features.includes(f.key)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-blue-300'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Thứ tự hiển thị">
              <input type="number" value={form.sort_order} onChange={e => setF('sort_order', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Trạng thái">
              <div className="flex gap-4 mt-1">
                {[{ val: true, label: 'Active' }, { val: false, label: 'Ẩn' }].map(opt => (
                  <label key={String(opt.val)} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.is_active === opt.val}
                      onChange={() => setF('is_active', opt.val)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !isValid}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? 'Đang lưu...' : 'Lưu gói'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
