import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import {
  Upload, Plus, Trash2, Download, CheckCircle,
  AlertCircle, FileSpreadsheet, Pencil, X, Check, ExternalLink, Loader2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import Button from '@/components/ui/Button'
import { sanitizeAndTrim } from '@/lib/utils/sanitize'

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * Props:
 *  tournamentId      – always required
 *  eventId           – optional; scopes players to this event
 *  discipline        – affects Excel column hints for doubles disciplines
 *  existingPlayers   – pre-loaded players to seed the table
 *  requirePlayerCode – when true, "Mã số" column is required (professional mode)
 *  onImportComplete  – callback(count) after save
 */
export default function PlayerImport({
  tournamentId,
  eventId = null,
  discipline = '',
  existingPlayers = [],
  maxTeams = null,
  requirePlayerCode = false,
  onImportComplete,
}) {
  const { profile } = useAuth()
  const isDoubles = ['mens_doubles', 'womens_doubles', 'mixed_doubles'].includes(discipline)

  const [players, setPlayers] = useState(
    existingPlayers.map(p => ({ ...p, _local: false, _key: p.id }))
  )
  const [newName, setNewName]           = useState('')
  const [newClub, setNewClub]           = useState('')
  const [newCode, setNewCode]           = useState('')
  const [addErrors, setAddErrors]       = useState({})
  const [globalError, setGlobalError]   = useState(null)
  const [parseError, setParseError]     = useState(null)
  const [importing, setImporting]       = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)
  const [limitWarning, setLimitWarning] = useState(null)
  const [showConfirmSave, setShowConfirmSave] = useState(false)
  const [downloading, setDownloading]   = useState(false)

  // ── File parsing ────────────────────────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return

    setParseError(null)
    setImportSuccess(false)

    const MAX_MB = 5
    if (file.size > MAX_MB * 1024 * 1024) {
      setParseError(`File quá lớn — tối đa ${MAX_MB}MB (file của bạn: ${(file.size / 1024 / 1024).toFixed(1)}MB)`)
      return
    }

    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data     = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001 })
        const sheet    = workbook.Sheets[workbook.SheetNames[0]]
        const json     = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (json.length === 0) {
          setParseError('File rỗng hoặc không có dữ liệu.')
          return
        }

        const firstRow      = json[0]
        const hasPartner1   = 'VĐV 1' in firstRow || 'VDV 1' in firstRow
        const hasPartner2   = 'VĐV 2' in firstRow || 'VDV 2' in firstRow
        const hasName       = 'Tên' in firstRow || 'Ten' in firstRow || 'Name' in firstRow
        const hasClub       = 'CLB' in firstRow || 'Club' in firstRow
        const hasCode       = 'Mã số' in firstRow || 'Ma so' in firstRow || 'CCCD' in firstRow || 'ID' in firstRow

        if (requirePlayerCode && !hasCode) {
          setParseError('File thiếu cột "Mã số" (CCCD / ID). Giải chuyên nghiệp yêu cầu mã định danh.')
          return
        }

        const useDoublesColumns = isDoubles && hasPartner1 && hasPartner2

        if (!useDoublesColumns && !hasName) {
          setParseError(
            isDoubles
              ? 'File cần có cột "VĐV 1", "VĐV 2" và "CLB" cho nội dung đôi.'
              : 'File thiếu cột bắt buộc. Cần có cột "Tên" (hoặc "Name") và "CLB".'
          )
          return
        }
        if (!hasClub) {
          setParseError('File thiếu cột "CLB" (hoặc "Club").')
          return
        }

        const parsed = json
          .map(row => {
            let name
            if (useDoublesColumns) {
              const p1 = sanitizeAndTrim(String(row['VĐV 1'] || row['VDV 1'] || '').trim(), 100)
              const p2 = sanitizeAndTrim(String(row['VĐV 2'] || row['VDV 2'] || '').trim(), 100)
              name = p1 && p2 ? `${p1} / ${p2}` : (p1 || p2)
            } else {
              name = sanitizeAndTrim(String(row['Tên'] || row['Ten'] || row['Name'] || '').trim(), 100)
            }
            const club = sanitizeAndTrim(String(row['CLB'] || row['Club'] || '').trim(), 100) || 'Tự do'
            const player_code = hasCode
              ? String(row['Mã số'] || row['Ma so'] || row['CCCD'] || row['ID'] || '').trim() || null
              : null
            return { name, club, player_code }
          })
          .filter(p => p.name)

        if (parsed.length === 0) {
          setParseError('Không tìm thấy dòng dữ liệu hợp lệ nào.')
          return
        }

        setPlayers(prev => {
          const existingCodes = requirePlayerCode
            ? new Set(prev.map(p => p.player_code).filter(Boolean))
            : null
          /* COMMENTED OUT: Duplicate names are allowed (same name is common)
          const existingNames = !requirePlayerCode
            ? new Set(prev.map(p => p.name.toLowerCase()))
            : null
          */

          // Dedup nội bộ trong file (tránh import 2 dòng giống nhau từ cùng 1 file)
          const seenInFile = new Set()
          const dedupedParsed = parsed.filter(p => {
            if (requirePlayerCode) {
              const key = p.player_code
              if (!key || seenInFile.has(key)) return false
              seenInFile.add(key)
              return true
            }
            /* COMMENTED OUT: Same name in file is allowed
            const key = p.name.toLowerCase()
            if (!key || seenInFile.has(key)) return false
            seenInFile.add(key)
            */
            return true
          })

          const added = dedupedParsed.filter(p => {
            if (requirePlayerCode) return p.player_code && !existingCodes.has(p.player_code)
            // Name duplicates are allowed:
            return true
            /* COMMENTED OUT:
            return !existingNames.has(p.name.toLowerCase())
            */
          }).map(p => ({ ...p, _local: true, _key: crypto.randomUUID() }))

          const skipped = parsed.length - added.length
          if (skipped > 0) {
            setParseError(`Đã bỏ qua ${skipped} VĐV vì mã số đã tồn tại hoặc trùng lặp trong file.`)
          }
          return [...prev, ...added]
        })
      } catch {
        setParseError('Không thể đọc file. Vui lòng dùng file .xlsx hoặc .csv hợp lệ.')
      }
    }

    reader.readAsArrayBuffer(file)
  }, [requirePlayerCode, isDoubles, maxTeams])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  })

  // ── Player list actions ─────────────────────────────────────────────────────
  function updatePlayer(key, field, value) {
    setPlayers(prev => prev.map(p => p._key === key ? { ...p, [field]: value } : p))
  }

  function deletePlayer(key) {
    setPlayers(prev => prev.filter(p => p._key !== key))
  }

  // ── Add manually ───────────────────────────────────────────────────────────
  function addPlayer() {
    const name = sanitizeAndTrim(newName.trim(), 100)
    const club = sanitizeAndTrim(newClub.trim(), 100)
    const code = newCode.trim() || null
    const errs = {}

    if (!name) errs.name = 'Nhập tên VĐV'
    if (!club) errs.club = 'Nhập tên CLB'
    if (requirePlayerCode && !code) errs.code = 'Nhập mã số VĐV'

    if (requirePlayerCode && code && players.some(p => p.player_code === code)) {
      errs.code = 'Mã số này đã có trong danh sách'
    }
    /* COMMENTED OUT: Duplicate names are allowed (same name is common)
    if (!requirePlayerCode && name && players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      errs.name = 'Tên này đã có trong danh sách'
    }
    */

    if (Object.keys(errs).length > 0) { setAddErrors(errs); return }

    setPlayers(prev => [...prev, { name, club, player_code: code, _local: true, _key: crypto.randomUUID() }])
    setNewName('')
    setNewClub('')
    setNewCode('')
    setAddErrors({})
    setImportSuccess(false)
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validatePlayers(list) {
    const empty = list.find(p => !p.name.trim() || !p.club.trim())
    if (empty) return 'Có dòng thiếu Tên hoặc CLB.'

    if (requirePlayerCode) {
      const missingCode = list.find(p => !p.player_code?.trim())
      if (missingCode) return `VĐV "${missingCode.name}" chưa có mã số. Giải chuyên nghiệp yêu cầu mã số cho tất cả VĐV.`

      const codes = list.map(p => p.player_code?.trim())
      const dupeCodes = codes.filter((c, i) => c && codes.indexOf(c) !== i)
      if (dupeCodes.length > 0) return `Mã số bị trùng: ${[...new Set(dupeCodes)].join(', ')}`
    }

    return null
  }

  // ── Import to Supabase ──────────────────────────────────────────────────────
  async function handleImport(force = false) {
    const totalCount = players.length
    const hasExceeded = maxTeams !== null && totalCount > maxTeams

    if (hasExceeded && !force) {
      setShowConfirmSave(true)
      return
    }

    const playersToSave = hasExceeded ? players.slice(0, maxTeams) : players

    const err = validatePlayers(playersToSave)
    if (err) {
      setGlobalError(err)
      return
    }
    setGlobalError(null)

    const newOnes = playersToSave.filter(p => p._local)
    if (newOnes.length === 0) {
      if (hasExceeded) {
        setPlayers(playersToSave)
        onImportComplete?.(playersToSave.length)
        setImportSuccess(true)
        setShowConfirmSave(false)
      } else {
        setGlobalError('Không có VĐV mới để import.')
      }
      return
    }

    setImporting(true)
    try {
      // Check player limit (ignore RPC errors to avoid blocking on infra issues)
      const { data: playerCheck } = await supabase.rpc('check_player_limit', {
        p_creator_id:   profile?.id,
        p_tournament_id: tournamentId,
        p_adding_count: newOnes.length,
      })
      if (playerCheck?.allowed === false) {
        setGlobalError(
          `Gói ${playerCheck.plan_slug ?? 'hiện tại'} chỉ cho phép ${playerCheck.max} VĐV/giải. ` +
          `Hiện có ${playerCheck.current}, đang thêm ${playerCheck.adding}.`
        )
        return
      }

      const { error } = await supabase.from('players').insert(
        newOnes.map(p => ({
          name:          sanitizeAndTrim(p.name.trim(), 100),
          club:          sanitizeAndTrim(p.club.trim(), 100),
          tournament_id: tournamentId,
          ...(eventId ? { event_id: eventId } : {}),
          ...(p.player_code ? { player_code: p.player_code.trim() } : {}),
        }))
      )
      if (error) throw error

      setPlayers(playersToSave.map(p => ({ ...p, _local: false })))
      setImportSuccess(true)
      onImportComplete?.(playersToSave.length)
      setShowConfirmSave(false)
    } catch (err) {
      if (err.code === '23505') {
        setGlobalError(
          requirePlayerCode
            ? 'Một số mã số VĐV đã tồn tại trong nội dung này (mã số trùng).'
            : 'Đã có lỗi trùng lặp khi lưu. Vui lòng kiểm tra lại danh sách.'
        )
      } else {
        setGlobalError(`Lỗi khi import: ${err.message}`)
      }
    } finally {
      setImporting(false)
    }
  }

  // ── Sample file download ───────────────────────────────────────────────────
  function downloadSample() {
    setDownloading(true)
    setTimeout(() => {
      let data, filename
      if (isDoubles) {
        const header = requirePlayerCode
          ? ['Mã số', 'VĐV 1', 'VĐV 2', 'CLB']
          : ['VĐV 1', 'VĐV 2', 'CLB']
        data = [
          header,
          ...(requirePlayerCode
            ? [['001001', 'Nguyễn Văn An', 'Trần Văn Bình', 'CLB Thành Công'],
               ['001002', 'Lê Thị Cúc', 'Phạm Thị Dung', 'CLB Sao Việt']]
            : [['Nguyễn Văn An', 'Trần Văn Bình', 'CLB Thành Công'],
               ['Lê Thị Cúc', 'Phạm Thị Dung', 'CLB Sao Việt']]),
        ]
        filename = 'mau_danh_sach_doi.xlsx'
      } else {
        const header = requirePlayerCode ? ['Mã số', 'Tên', 'CLB'] : ['Tên', 'CLB']
        data = [
          header,
          ...(requirePlayerCode
            ? [['001001', 'Nguyễn Văn An', 'CLB Thành Công'],
               ['001002', 'Trần Thị Bình', 'CLB Sao Việt'],
               ['001003', 'Lê Văn Cường', 'CLB Tiến Phát']]
            : [['Nguyễn Văn An', 'CLB Thành Công'],
               ['Trần Thị Bình', 'CLB Sao Việt'],
               ['Lê Văn Cường', 'CLB Tiến Phát']]),
        ]
        filename = requirePlayerCode ? 'mau_danh_sach_chuyen_nghiep.xlsx' : 'mau_danh_sach_vdv.xlsx'
      }
      const ws = XLSX.utils.aoa_to_sheet(data)
      const colWidths = requirePlayerCode
        ? (isDoubles ? [{ wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 20 }] : [{ wch: 12 }, { wch: 25 }, { wch: 20 }])
        : (isDoubles ? [{ wch: 22 }, { wch: 22 }, { wch: 20 }] : [{ wch: 25 }, { wch: 20 }])
      ws['!cols'] = colWidths
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, isDoubles ? 'Danh sách đôi' : 'Danh sách VĐV')
      XLSX.writeFile(wb, filename)
      setDownloading(false)
    }, 500)
  }

  const newCount = players.filter(p => p._local).length

  return (
    <div className="space-y-5">

      {/* ── Professional mode badge ── */}
      {requirePlayerCode && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Giải chuyên nghiệp — file phải có cột <strong>Mã số</strong> (CCCD / ID)</span>
        </div>
      )}

      {/* ── Dropzone ── */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none ${
          isDragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <FileSpreadsheet className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? 'text-blue-500' : 'text-gray-300'}`} />
        <p className="text-sm font-medium text-gray-700">
          {isDragActive ? 'Thả file vào đây...' : 'Kéo thả file Excel / CSV vào đây'}
        </p>
        <p className="text-xs text-gray-400 mt-1">hoặc click để chọn file · Hỗ trợ .xlsx .xls .csv</p>
        <p className="text-xs text-gray-400 mt-2">
          {isDoubles ? (
            <>
              Cột bắt buộc:{' '}
              {requirePlayerCode && <><span className="font-mono bg-gray-100 px-1 rounded">Mã số</span>{' '}</>}
              <span className="font-mono bg-gray-100 px-1 rounded">VĐV 1</span>{' '}
              <span className="font-mono bg-gray-100 px-1 rounded">VĐV 2</span>{' '}
              <span className="font-mono bg-gray-100 px-1 rounded">CLB</span>
            </>
          ) : (
            <>
              Cột bắt buộc:{' '}
              {requirePlayerCode && <><span className="font-mono bg-gray-100 px-1 rounded">Mã số</span>{' '}</>}
              <span className="font-mono bg-gray-100 px-1 rounded">Tên</span>{' '}
              <span className="font-mono bg-gray-100 px-1 rounded">CLB</span>
            </>
          )}
        </p>
      </div>

      {/* Parse error */}
      {parseError && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {parseError}
        </div>
      )}

      {/* Sample download */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Chưa có file? Dùng file mẫu.</span>
        <button
          onClick={downloadSample}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
        >
          {downloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang tải...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Tải file mẫu .xlsx
            </>
          )}
        </button>
      </div>

      {/* ── Player table ── */}
      {players.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">
              Danh sách VĐV
              <span className="ml-2 text-gray-400 font-normal">({players.length} người)</span>
              {newCount > 0 && (
                <span className="ml-1.5 text-blue-600 font-normal">· {newCount} chưa lưu</span>
              )}
            </h3>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 w-10">#</th>
                  {requirePlayerCode && (
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 w-32">Mã số</th>
                  )}
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                    {isDoubles ? 'Tên đôi (VĐV1 / VĐV2)' : 'Tên VĐV'}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Câu lạc bộ</th>
                  <th className="px-4 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {players.map((player, idx) => (
                  <PlayerRow
                    key={player._key}
                    player={player}
                    index={idx + 1}
                    showCode={requirePlayerCode}
                    isOverLimit={maxTeams !== null && (idx + 1) > maxTeams}
                    onChange={updatePlayer}
                    onDelete={deletePlayer}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add manually ── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Thêm thủ công</p>
        <div className="grid gap-2">
          {requirePlayerCode && (
            <div>
              <input
                placeholder="Mã số"
                value={newCode}
                onChange={e => { setNewCode(e.target.value); setAddErrors(p => ({ ...p, code: null })) }}
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                  addErrors.code ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {addErrors.code && <p className="text-xs text-red-600 mt-1">{addErrors.code}</p>}
            </div>
          )}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <input
                placeholder={isDoubles ? 'VĐV1 / VĐV2' : 'Tên VĐV'}
                value={newName}
                onChange={e => { setNewName(e.target.value); setAddErrors(p => ({ ...p, name: null })) }}
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                  addErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {addErrors.name && <p className="text-xs text-red-600 mt-1">{addErrors.name}</p>}
            </div>
            <div className="flex-1 min-w-0">
              <input
                placeholder="Câu lạc bộ"
                value={newClub}
                onChange={e => { setNewClub(e.target.value); setAddErrors(p => ({ ...p, club: null })) }}
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                  addErrors.club ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {addErrors.club && <p className="text-xs text-red-600 mt-1">{addErrors.club}</p>}
            </div>
            <button
              onClick={addPlayer}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Thêm</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Feedback ── */}
      {globalError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{globalError}</span>
          </div>
          {globalError.includes('chỉ cho phép') && (
            <Link
              to="/plans"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium text-xs mt-2"
            >
              <ExternalLink className="w-3 h-3" />
              Xem các gói dịch vụ để nâng cấp
            </Link>
          )}
        </div>
      )}

      {importSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Import thành công! Tổng cộng <strong>{players.length}</strong> VĐV đã được lưu.</span>
        </div>
      )}

      {newCount > 0 && (
        <Button onClick={handleImport} loading={importing} className="w-full" size="lg">
          {importing ? 'Đang lưu...' : `Lưu ${newCount} VĐV mới vào giải đấu`}
        </Button>
      )}

      {/* Warning capacity limit modal */}
      {limitWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all p-6">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-gray-900">{limitWarning.title}</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              {limitWarning.message}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setLimitWarning(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save confirmation modal */}
      {showConfirmSave && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-gray-900">Xác nhận loại bỏ VĐV vượt giới hạn</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Danh sách hiện có <strong>{players.length}</strong> {isDoubles ? 'đôi' : 'VĐV'}, vượt quá giới hạn tối đa cho phép của nội dung này (<strong>{maxTeams}</strong> {isDoubles ? 'đôi' : 'VĐV'}). 
              <br /><br />
              Khi lưu, các vận động viên vượt giới hạn (từ số thứ tự <strong>{maxTeams + 1}</strong> trở đi) sẽ bị tự động loại bỏ khỏi danh sách. Bạn có đồng ý tiếp tục?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmSave(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => handleImport(true)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Xác nhận lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────

function PlayerRow({ player, index, showCode, isOverLimit = false, onChange, onDelete }) {
  const [editing, setEditing] = useState(false)
  const key = player._key

  return (
    <tr className={`group transition-colors ${
      isOverLimit
        ? 'bg-red-50/40 hover:bg-red-100/60 text-red-900 border-red-100'
        : player._local ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'hover:bg-gray-50'
    }`}>
      <td className="px-4 py-2 text-xs text-gray-400">
        {index}
        {isOverLimit && (
          <span className="block text-[9px] text-red-500 font-semibold uppercase tracking-wide mt-0.5">
            Vượt
          </span>
        )}
      </td>

      {showCode && (
        <td className="px-4 py-2">
          {editing ? (
            <input
              value={player.player_code ?? ''}
              onChange={e => onChange(key, 'player_code', e.target.value || null)}
              className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Mã số"
            />
          ) : (
            <span className={`text-sm font-mono ${player.player_code ? (isOverLimit ? 'text-red-700' : 'text-gray-700') : 'text-red-400 italic'}`}>
              {player.player_code ?? '— chưa có —'}
            </span>
          )}
        </td>
      )}

      <td className="px-4 py-2">
        {editing ? (
          <input
            autoFocus
            value={player.name}
            onChange={e => onChange(key, 'name', e.target.value)}
            className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isOverLimit ? 'text-red-700' : 'text-gray-900'}`}>{player.name}</span>
            {isOverLimit && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 shrink-0">
                Vượt giới hạn
              </span>
            )}
          </div>
        )}
      </td>

      <td className="px-4 py-2">
        {editing ? (
          <input
            value={player.club}
            onChange={e => onChange(key, 'club', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setEditing(false)}
            className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        ) : (
          <span className={`text-sm ${isOverLimit ? 'text-red-600/80' : 'text-gray-500'}`}>{player.club}</span>
        )}
      </td>

      <td className="px-4 py-2">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {editing ? (
            <button
              onClick={() => setEditing(false)}
              className="p-1 text-green-600 hover:text-green-700 rounded"
              title="Xong"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="p-1 text-gray-400 hover:text-blue-600 rounded"
              title="Sửa"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(key)}
            className="p-1 text-gray-400 hover:text-red-500 rounded"
            title="Xóa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}
