"use client"

import { createContext, useContext, useEffect, useState } from "react"

const ThemeContext = createContext({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children, defaultTheme = "light", storageKey = "theme" }) {
  const [theme, setThemeState] = useState(defaultTheme)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check for saved theme preference or default to defaultTheme
    const savedTheme = localStorage.getItem(storageKey) || defaultTheme
    setThemeState(savedTheme)
    applyTheme(savedTheme)
  }, [defaultTheme, storageKey])

  useEffect(() => {
    if (mounted) {
      applyTheme(theme)
    }
  }, [theme, mounted])

  const applyTheme = (newTheme) => {
    const root = document.documentElement

    // Remove existing theme classes
    root.classList.remove("light", "dark")

    if (newTheme === "system") {
      // Handle system theme
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.add(systemTheme)
      root.setAttribute("data-theme", systemTheme)
      root.style.colorScheme = systemTheme
    } else {
      // Handle explicit light/dark theme
      root.classList.add(newTheme)
      root.setAttribute("data-theme", newTheme)
      root.style.colorScheme = newTheme
    }
  }

  const setTheme = (newTheme) => {
    setThemeState(newTheme)
    localStorage.setItem(storageKey, newTheme)
    applyTheme(newTheme)
  }

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
  }

  // Listen for system theme changes when theme is set to "system"
  useEffect(() => {
    if (theme === "system" && mounted) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = () => applyTheme("system")

      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme, mounted])

  // Prevent hydration mismatch by not rendering theme-dependent content until mounted
  if (!mounted) {
    return <>{children}</>
  }

  const value = {
    theme,
    setTheme,
    toggleTheme,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
