import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_TOURNAMENT_CONFIG } from '@/lib/constants'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card'

export default function TournamentCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    num_groups: DEFAULT_TOURNAMENT_CONFIG.num_groups,
    num_first_place_qualify: DEFAULT_TOURNAMENT_CONFIG.num_first_place_qualify,
    num_second_place_qualify: DEFAULT_TOURNAMENT_CONFIG.num_second_place_qualify,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Tên giải đấu là bắt buộc'
    if (form.num_groups < 1) errs.num_groups = 'Số bảng phải >= 1'
    if (form.num_first_place_qualify < 1) errs.num_first_place_qualify = 'Phải >= 1'
    if (form.num_second_place_qualify < 0) errs.num_second_place_qualify = 'Phải >= 0'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setLoading(true)
    setSubmitError(null)

    try {
      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          name: form.name.trim(),
          status: 'setup',
          num_groups: Number(form.num_groups),
          num_first_place_qualify: Number(form.num_first_place_qualify),
          num_second_place_qualify: Number(form.num_second_place_qualify),
          scoring_rules: DEFAULT_TOURNAMENT_CONFIG.scoring_rules,
        })
        .select()
        .single()

      if (error) throw error
      navigate(`/tournament/${data.id}/setup`)
    } catch (err) {
      console.error('Error creating tournament:', err)
      setSubmitError('Không thể tạo giải đấu. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Quay lại
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Tạo giải đấu mới</h1>
              <p className="text-sm text-gray-500">Điền thông tin để bắt đầu</p>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardBody className="space-y-5">
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <Input
              label="Tên giải đấu *"
              placeholder="VD: Giải Cầu Lông Mùa Hè 2026"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              error={errors.name}
              autoFocus
            />

            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Cấu hình giải đấu</h3>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Số bảng"
                  type="number"
                  min="1"
                  max="24"
                  value={form.num_groups}
                  onChange={e => handleChange('num_groups', e.target.value)}
                  error={errors.num_groups}
                />
                <Input
                  label="Nhất bảng lấy"
                  type="number"
                  min="1"
                  value={form.num_first_place_qualify}
                  onChange={e => handleChange('num_first_place_qualify', e.target.value)}
                  error={errors.num_first_place_qualify}
                />
                <Input
                  label="Nhì bảng lấy"
                  type="number"
                  min="0"
                  value={form.num_second_place_qualify}
                  onChange={e => handleChange('num_second_place_qualify', e.target.value)}
                  error={errors.num_second_place_qualify}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Tổng vào knockout: {Number(form.num_first_place_qualify) + Number(form.num_second_place_qualify)} VĐV
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
              <strong>Luật thi đấu mặc định:</strong>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-blue-600">
                <li>Vòng bảng & 1/16, 1/8, 1/4: 1 set × 21 điểm</li>
                <li>Bán kết & Chung kết: 3 set × 15 điểm</li>
              </ul>
            </div>
          </CardBody>

          <CardFooter className="flex justify-end gap-3">
            <Link to="/">
              <Button variant="secondary" type="button">Hủy</Button>
            </Link>
            <Button type="submit" loading={loading}>
              Tạo giải đấu
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
