import React from 'react'
import { cn } from '@/lib/utils/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  error?: string | null
}

export default function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        className={cn(
          'px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors',
          error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
