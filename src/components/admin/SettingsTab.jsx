import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Check, Plus, Trash2 } from 'lucide-react'
import { invalidateFeatureRegistryCache } from '@/lib/hooks/useFeatureRegistry'

const BANKS = [
  { name: 'Vietcombank',  bin: '970436' },
  { name: 'Vietinbank',   bin: '970415' },
  { name: 'BIDV',         bin: '970418' },
  { name: 'Agribank',     bin: '970405' },
  { name: 'Techcombank',  bin: '970407' },
  { name: 'MB Bank',      bin: '970422' },
  { name: 'ACB',          bin: '970416' },
  { name: 'VPBank',       bin: '970432' },
  { name: 'TPBank',       bin: '970423' },
  { name: 'Sacombank',    bin: '970403' },
]

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function SettingsTab({ adminId }) {
  const [form, setForm] = useState({
    bank_name:    '',
    bank_account: '',
    bank_owner:   '',
    bank_branch:  '',
    bank_bin:     '970436',
  })
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [err, setErr]             = useState(null)

  const [addonPricing, setAddonPricing] = useState({ tournament_slot: { price: 50000 } })
  const [savingAddon, setSavingAddon]   = useState(false)
  const [savedAddon, setSavedAddon]     = useState(false)
  const [errAddon, setErrAddon]         = useState(null)

  // Feature registry
  const [regEntries, setRegEntries] = useState([])
  const [newEntry, setNewEntry]     = useState({ key: '', label: '', upgrade_hint: '' })
  const [savingReg, setSavingReg]   = useState(false)
  const [savedReg, setSavedReg]     = useState(false)
  const [errReg, setErrReg]         = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('app_config').select('value').eq('key', 'bank_info').maybeSingle(),
      supabase.from('app_config').select('value').eq('key', 'addon_pricing').maybeSingle(),
      supabase.from('app_config').select('value').eq('key', 'feature_registry').maybeSingle(),
    ]).then(([bankRes, addonRes, regRes]) => {
      if (bankRes.data?.value) setForm(prev => ({ ...prev, ...bankRes.data.value }))
      if (addonRes.data?.value) setAddonPricing(addonRes.data.value)
      if (regRes.data?.value) {
        setRegEntries(
          Object.entries(regRes.data.value).map(([key, meta]) => ({
            key,
            label:        meta.label ?? '',
            upgrade_hint: meta.upgrade_hint ?? '',
          }))
        )
      }
      setLoading(false)
    })
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  function setF(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  function handleBankSelect(e) {
    const bank = BANKS.find(b => b.name === e.target.value)
    if (bank) setForm(prev => ({ ...prev, bank_name: bank.name, bank_bin: bank.bin }))
  }

  async function handleSave() {
    setSaving(true)
    setErr(null)
    const { error } = await supabase.rpc('admin_update_bank_info', {
      p_admin_id: adminId,
      p_info:     form,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function addRegEntry() {
    const key = newEntry.key.trim().toLowerCase().replace(/\s+/g, '_')
    if (!key || !newEntry.label.trim()) return
    if (regEntries.some(e => e.key === key)) return
    setRegEntries(prev => [...prev, { key, label: newEntry.label.trim(), upgrade_hint: newEntry.upgrade_hint.trim() }])
    setNewEntry({ key: '', label: '', upgrade_hint: '' })
  }

  function removeRegEntry(key) {
    setRegEntries(prev => prev.filter(e => e.key !== key))
  }

  async function handleSaveRegistry() {
    setSavingReg(true)
    setErrReg(null)
    const registry = Object.fromEntries(
      regEntries.map(e => [e.key, { label: e.label, upgrade_hint: e.upgrade_hint }])
    )
    const { error } = await supabase.rpc('admin_upsert_feature_registry', {
      p_admin_id: adminId,
      p_registry: registry,
    })
    setSavingReg(false)
    if (error) { setErrReg(error.message); return }
    invalidateFeatureRegistryCache()
    setSavedReg(true)
    setTimeout(() => setSavedReg(false), 2500)
  }

  async function handleSaveAddon() {
    setSavingAddon(true)
    setErrAddon(null)
    const { error } = await supabase.rpc('admin_update_addon_pricing', {
      p_admin_id: adminId,
      p_pricing:  addonPricing,
    })
    setSavingAddon(false)
    if (error) { setErrAddon(error.message); return }
    setSavedAddon(true)
    setTimeout(() => setSavedAddon(false), 2500)
  }

  const qrUrl =
    form.bank_bin && form.bank_account && form.bank_owner
      ? `https://img.vietqr.io/image/${form.bank_bin}-${form.bank_account}-compact2.jpg` +
        `?amount=299000&addInfo=BTSUB-PREVIEW&accountName=${encodeURIComponent(form.bank_owner)}`
      : null

  if (loading) return (
    <div className="py-16 flex justify-center">
      <span className="text-gray-400 text-sm">Đang tải...</span>
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      {/* Bank Info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Thông tin nhận thanh toán</h3>
        <p className="text-xs text-gray-400 mb-5">Hiển thị trên trang checkout khi creator mua gói</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ngân hàng *</label>
            <select
              value={form.bank_name}
              onChange={handleBankSelect}
              className={inputCls}
            >
              <option value="">Chọn ngân hàng...</option>
              {BANKS.map(b => (
                <option key={b.bin} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Số tài khoản *</label>
            <input
              value={form.bank_account}
              onChange={e => setF('bank_account', e.target.value.replace(/\D/g, ''))}
              className={inputCls}
              placeholder="1234567890"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Tên chủ tài khoản *</label>
            <input
              value={form.bank_owner}
              onChange={e => setF('bank_owner', e.target.value.toUpperCase())}
              className={inputCls}
              placeholder="NGUYEN VAN A"
            />
            <p className="text-xs text-gray-400 mt-0.5">Viết hoa, không dấu — đúng với tên tài khoản ngân hàng</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Chi nhánh</label>
              <input
                value={form.bank_branch}
                onChange={e => setF('bank_branch', e.target.value)}
                className={inputCls}
                placeholder="CN Hà Nội"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mã BIN ngân hàng</label>
              <input
                value={form.bank_bin}
                onChange={e => setF('bank_bin', e.target.value.replace(/\D/g, ''))}
                className={inputCls}
                placeholder="970436"
              />
              <p className="text-xs text-gray-400 mt-0.5">Tự điền khi chọn ngân hàng</p>
            </div>
          </div>
        </div>

        {err && (
          <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2 mt-4">{err}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-5 flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saved
            ? <><Check className="w-4 h-4" /> Đã lưu</>
            : saving
              ? 'Đang lưu...'
              : 'Lưu thay đổi'}
        </button>
      </div>

      {/* Addon Pricing */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Giá dịch vụ add-on</h3>
        <p className="text-xs text-gray-400 mb-5">Giá hiển thị trên trang mua add-on cho creator</p>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Giá 1 slot giải đấu (VND)</label>
          <input
            type="number"
            min={0}
            step={1000}
            value={addonPricing.tournament_slot?.price ?? 50000}
            onChange={e => setAddonPricing(prev => ({
              ...prev,
              tournament_slot: { ...prev.tournament_slot, price: Number(e.target.value) },
            }))}
            className={inputCls}
            placeholder="50000"
          />
        </div>

        {errAddon && (
          <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2 mt-4">{errAddon}</p>
        )}

        <button
          onClick={handleSaveAddon}
          disabled={savingAddon}
          className="mt-5 flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {savedAddon
            ? <><Check className="w-4 h-4" /> Đã lưu</>
            : savingAddon
              ? 'Đang lưu...'
              : 'Lưu giá add-on'}
        </button>
      </div>

      {/* Feature Registry */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Feature Registry</h3>
        <p className="text-xs text-gray-400 mb-5">
          Danh sách tính năng có thể gán vào gói. Thêm tính năng mới ở đây rồi gán vào gói tại tab Gói dịch vụ.
        </p>

        {/* Existing entries */}
        {regEntries.length > 0 && (
          <div className="space-y-2 mb-4">
            {regEntries.map(entry => (
              <div key={entry.key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0 grid grid-cols-3 gap-2">
                  <input
                    value={entry.key}
                    readOnly
                    className="text-xs font-mono bg-transparent text-gray-500 truncate outline-none"
                  />
                  <input
                    value={entry.label}
                    onChange={e => setRegEntries(prev => prev.map(r => r.key === entry.key ? { ...r, label: e.target.value } : r))}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="Nhãn hiển thị"
                  />
                  <input
                    value={entry.upgrade_hint}
                    onChange={e => setRegEntries(prev => prev.map(r => r.key === entry.key ? { ...r, upgrade_hint: e.target.value } : r))}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="Gợi ý nâng cấp"
                  />
                </div>
                <button
                  onClick={() => removeRegEntry(entry.key)}
                  className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new entry */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 grid grid-cols-3 gap-2">
            <input
              value={newEntry.key}
              onChange={e => setNewEntry(prev => ({ ...prev, key: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addRegEntry()}
              className={inputCls + ' text-xs'}
              placeholder="feature_key"
            />
            <input
              value={newEntry.label}
              onChange={e => setNewEntry(prev => ({ ...prev, label: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addRegEntry()}
              className={inputCls + ' text-xs'}
              placeholder="Tên tính năng"
            />
            <input
              value={newEntry.upgrade_hint}
              onChange={e => setNewEntry(prev => ({ ...prev, upgrade_hint: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addRegEntry()}
              className={inputCls + ' text-xs'}
              placeholder="Gợi ý nâng cấp (tuỳ chọn)"
            />
          </div>
          <button
            onClick={addRegEntry}
            disabled={!newEntry.key.trim() || !newEntry.label.trim()}
            className="shrink-0 p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {errReg && (
          <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2 mb-3">{errReg}</p>
        )}

        <button
          onClick={handleSaveRegistry}
          disabled={savingReg}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {savedReg
            ? <><Check className="w-4 h-4" /> Đã lưu</>
            : savingReg
              ? 'Đang lưu...'
              : 'Lưu registry'}
        </button>
      </div>

      {/* QR Preview */}
      {qrUrl && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Preview QR thanh toán</h3>
          <p className="text-xs text-gray-400 mb-4">
            Ví dụ với gói Cơ bản 299.000đ · nội dung: BTSUB-PREVIEW
          </p>
          <img
            src={qrUrl}
            alt="VietQR Preview"
            className="w-52 h-52 rounded-xl border border-gray-100 object-contain bg-white"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
          <p className="text-xs text-gray-500 mt-3">
            {form.bank_name}
            {form.bank_account && <> · {form.bank_account}</>}
            {form.bank_owner && <> · {form.bank_owner}</>}
          </p>
        </div>
      )}
    </div>
  )
}
