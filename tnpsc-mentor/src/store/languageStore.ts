import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Lang = 'en' | 'ta' | 'both'

interface LanguageState {
  lang: Lang | null // null = not chosen yet (gate to /language)
  setLang: (lang: Lang) => void
  reset: () => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      lang: null,
      setLang: (lang) => set({ lang }),
      reset: () => set({ lang: null }),
    }),
    { name: 'tnpsc-mentor-lang' }
  )
)
