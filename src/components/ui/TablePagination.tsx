import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function TablePagination({ page, totalPages, onPageChange, pageSize, total }) {
  if (!total || totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white text-sm">
      <p className="text-gray-500 text-xs">
        {from}–{to} / {total} bản ghi
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="px-3 py-1 text-gray-600 font-medium">{page} / {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  )
}
