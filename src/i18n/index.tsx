import { createContext, useContext, useState } from 'react'
import vi from './locales/vi'
import en from './locales/en'

const LOCALES = { vi, en }

export const LangContext = createContext({ lang: 'vi', setLang: () => {} })

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem('lang')
    return saved === 'en' ? 'en' : 'vi'
  })

  function setLang(l) {
    localStorage.setItem('lang', l)
    setLangState(l)
  }

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useI18n() {
  const { lang, setLang } = useContext(LangContext)

  function t(keyPath, vars = {}) {
    const keys = keyPath.split('.')
    let val = LOCALES[lang]
    for (const k of keys) {
      val = val?.[k]
      if (val === undefined) break
    }
    // Fallback to Vietnamese
    if (typeof val !== 'string') {
      let fb = LOCALES.vi
      for (const k of keys) {
        fb = fb?.[k]
        if (fb === undefined) break
      }
      val = typeof fb === 'string' ? fb : keyPath
    }
    // Interpolate {varName} placeholders
    return val.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`))
  }

  return { t, lang, setLang }
}
