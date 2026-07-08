import { useState, useEffect, createContext, useContext } from 'react'
import api from '../lib/api'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('pirgefse-theme') || 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pirgefse-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(t => {
      const newTheme = t === 'dark' ? 'light' : 'dark'
      api.put('/auth/me/theme', { theme: newTheme }).catch(() => {})
      return newTheme
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
