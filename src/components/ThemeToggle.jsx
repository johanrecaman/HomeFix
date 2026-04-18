import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button
      onClick={() => setDark(d => !d)}
      className="w-10 h-10 grid place-items-center rounded-lg text-ink-700 dark:text-ink-400 hover:bg-ink-900/5 dark:hover:bg-white/10 transition-colors"
      aria-label="Alternar tema"
    >
      {dark ? <Sun size={18}/> : <Moon size={18}/>}
    </button>
  )
}
