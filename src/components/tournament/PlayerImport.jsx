import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import {
  Upload, Plus, Trash2, Download, CheckCircle,
  AlertCircle, FileSpreadsheet, Pencil, X, Check,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PlayerImport({ tournamentId, existingPlayers = [], onImportComplete }) {
  // Seed state with existing DB players (marked _local=false so they won't be re-inserted)
  const [players, setPlayers] = useState(
    existingPlayers.map(p => ({ ...p, _local: false, _key: p.id }))
  )
  const [newName, setNewName] = useState('')
  const [newClub, setNewClub] = useState('')
  const [addErrors, setAddErrors] = useState({})
  const [globalError, setGlobalError] = useState(null)
  const [parseError, setParseError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)

  // ── File parsing ────────────────────────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return

    setParseError(null)
    setImportSuccess(false)
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001 })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (json.length === 0) {
          setParseError('File rỗng hoặc không có dữ liệu.')
          return
        }

        const firstRow = json[0]
        const hasName = 'Tên' in firstRow || 'Ten' in firstRow || 'Name' in firstRow
        const hasClub = 'CLB' in firstRow || 'Club' in firstRow

        if (!hasName || !hasClub) {
          setParseError('File thiếu cột bắt buộc. Cần có cột "Tên" (hoặc "Name") và "CLB" (hoặc "Club").')
          return
        }

        const parsed = json
          .map(row => {
            const name = String(row['Tên'] || row['Ten'] || row['Name'] || '').trim()
            const club = String(row['CLB'] || row['Club'] || '').trim() || 'Tự do'
            return { name, club }
          })
          .filter(p => p.name) // chỉ bỏ qua dòng không có tên

        if (parsed.length === 0) {
          setParseError('Không tìm thấy dòng dữ liệu hợp lệ nào.')
          return
        }

        setPlayers(prev => {
          const existingNames = new Set(prev.map(p => p.name.toLowerCase()))
          const added = parsed
            .filter(p => !existingNames.has(p.name.toLowerCase()))
            .map(p => ({ ...p, _local: true, _key: crypto.randomUUID() }))
          const skipped = parsed.length - added.length
          if (skipped > 0) {
            setParseError(`Đã bỏ qua ${skipped} VĐV vì tên đã tồn tại trong danh sách.`)
          }
          return [...prev, ...added]
        })
      } catch {
        setParseError('Không thể đọc file. Vui lòng dùng file .xlsx hoặc .csv hợp lệ.')
      }
    }

    reader.readAsArrayBuffer(file)
  }, [])

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
    const name = newName.trim()
    const club = newClub.trim()
    const errs = {}
    if (!name) errs.name = 'Nhập tên VĐV'
    if (!club) errs.club = 'Nhập tên CLB'
    if (name && players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      errs.name = 'Tên này đã có trong danh sách'
    }
    if (Object.keys(errs).length > 0) { setAddErrors(errs); return }

    setPlayers(prev => [...prev, { name, club, _local: true, _key: crypto.randomUUID() }])
    setNewName('')
    setNewClub('')
    setAddErrors({})
    setImportSuccess(false)
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate() {
    const empty = players.find(p => !p.name.trim() || !p.club.trim())
    if (empty) return `Có dòng thiếu Tên hoặc CLB. Vui lòng điền đầy đủ.`

    const names = players.map(p => p.name.trim().toLowerCase())
    const dupes = names.filter((n, i) => names.indexOf(n) !== i)
    if (dupes.length > 0) {
      return `Có tên bị trùng: ${[...new Set(dupes)].map(n =>
        players.find(p => p.name.toLowerCase() === n)?.name
      ).join(', ')}`
    }

    return null
  }

  // ── Import to Supabase ──────────────────────────────────────────────────────
  async function handleImport() {
    const err = validate()
    if (err) { setGlobalError(err); return }
    setGlobalError(null)

    const newOnes = players.filter(p => p._local)
    if (newOnes.length === 0) {
      setGlobalError('Không có VĐV mới để import.')
      return
    }

    setImporting(true)
    try {
      const { error } = await supabase.from('players').insert(
        newOnes.map(p => ({
          name: p.name.trim(),
          club: p.club.trim(),
          tournament_id: tournamentId,
        }))
      )
      if (error) throw error

      // Mark all as saved
      setPlayers(prev => prev.map(p => ({ ...p, _local: false })))
      setImportSuccess(true)
      onImportComplete?.(players.length)
    } catch (err) {
      if (err.code === '23505') {
        setGlobalError('Một số VĐV đã tồn tại trong giải đấu này (tên trùng).')
      } else {
        setGlobalError(`Lỗi khi import: ${err.message}`)
      }
    } finally {
      setImporting(false)
    }
  }

  // ── Sample file download ───────────────────────────────────────────────────
  function downloadSample() {
    const data = [
      ['Tên', 'CLB'],
      ['Nguyễn Văn An', 'CLB Thành Công'],
      ['Trần Thị Bình', 'CLB Sao Việt'],
      ['Lê Văn Cường', 'CLB Tiến Phát'],
      ['Phạm Thị Dung', 'CLB Thể Thao'],
      ['Hoàng Văn Em', 'CLB Sao Việt'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 25 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách VĐV')
    XLSX.writeFile(wb, 'mau_danh_sach_vdv.xlsx')
  }

  const newCount = players.filter(p => p._local).length

  return (
    <div className="space-y-5">

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
          Cột bắt buộc: <span className="font-mono bg-gray-100 px-1 rounded">Tên</span> và{' '}
          <span className="font-mono bg-gray-100 px-1 rounded">CLB</span>
        </p>
      </div>

      {/* Parse error */}
      {parseError && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {parseError}
        </div>
      )}

      {/* Sample download link */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Chưa có file? Dùng file mẫu.</span>
        <button
          onClick={downloadSample}
          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium"
        >
          <Download className="w-4 h-4" />
          Tải file mẫu .xlsx
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

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 w-10">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Tên VĐV</th>
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
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <input
              placeholder="Tên VĐV"
              value={newName}
              onChange={e => { setNewName(e.target.value); setAddErrors(p => ({ ...p, name: null })) }}
              onKeyDown={e => e.key === 'Enter' && addPlayer()}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                addErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {addErrors.name && <p className="text-xs text-red-600 mt-1">{addErrors.name}</p>}
          </div>
          <div className="flex-1">
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
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Thêm
          </button>
        </div>
      </div>

      {/* ── Import button & feedback ── */}
      {globalError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {globalError}
        </div>
      )}

      {importSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Import thành công! Tổng cộng <strong>{players.length}</strong> VĐV đã được lưu.</span>
        </div>
      )}

      {newCount > 0 && (
        <Button onClick={handleImport} loading={importing} className="w-full" size="lg">
          {importing ? 'Đang lưu...' : `Lưu ${newCount} VĐV mới vào giải đấu`}
        </Button>
      )}
    </div>
  )
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────

function PlayerRow({ player, index, onChange, onDelete }) {
  const [editing, setEditing] = useState(false)
  const key = player._key

  return (
    <tr className={`group hover:bg-gray-50 transition-colors ${player._local ? 'bg-blue-50/30' : ''}`}>
      <td className="px-4 py-2 text-xs text-gray-400">{index}</td>

      <td className="px-4 py-2">
        {editing ? (
          <input
            autoFocus
            value={player.name}
            onChange={e => onChange(key, 'name', e.target.value)}
            className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        ) : (
          <span className="text-sm text-gray-900 font-medium">{player.name}</span>
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
          <span className="text-sm text-gray-500">{player.club}</span>
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
