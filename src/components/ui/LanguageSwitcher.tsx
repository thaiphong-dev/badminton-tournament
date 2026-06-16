import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils/cn'

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n()

  return (
    <div className="flex items-center text-xs font-semibold select-none">
      <button
        onClick={() => setLang('vi')}
        className={cn(
          'px-2 py-1 rounded-l-md border border-r-0 transition-colors',
          lang === 'vi'
            ? 'bg-blue-50 text-blue-600 border-blue-200'
            : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50',
        )}
      >
        VI
      </button>
      <button
        onClick={() => setLang('en')}
        className={cn(
          'px-2 py-1 rounded-r-md border transition-colors',
          lang === 'en'
            ? 'bg-blue-50 text-blue-600 border-blue-200'
            : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50',
        )}
      >
        EN
      </button>
    </div>
  )
}
