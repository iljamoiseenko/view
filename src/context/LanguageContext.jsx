import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { translations } from '../i18n/translations'

const LanguageContext = createContext(null)

function getInitialLang() {
  const saved = localStorage.getItem('view_lang')
  return saved === 'en' ? 'en' : 'uk'
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang)

  useEffect(() => {
    localStorage.setItem('view_lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback((path, ...args) => {
    const parts = path.split('.')
    let node = translations[lang]
    for (const p of parts) node = node?.[p]
    if (node === undefined) {
      let fallback = translations.uk
      for (const p of parts) fallback = fallback?.[p]
      node = fallback ?? path
    }
    return typeof node === 'function' ? node(...args) : node
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
