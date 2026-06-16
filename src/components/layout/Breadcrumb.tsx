import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Breadcrumb navigation.
 *
 * @param {Array} items  – [{ label, href? }, ...]
 *   Last item is the current page (no link, rendered as plain text).
 */
export default function Breadcrumb({ items = [], className }) {
  if (items.length === 0) return null

  return (
    <nav aria-label="breadcrumb" className={cn('flex items-center gap-1 text-sm', className)}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <span key={idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
            {isLast || !item.href ? (
              <span className={cn(
                'font-medium truncate max-w-[180px]',
                isLast ? 'text-gray-900' : 'text-gray-500'
              )}>
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="text-gray-500 hover:text-blue-600 transition-colors truncate max-w-[180px]"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
