import * as React from "react"

export type Theme = "classic" | "muse" | "volt"
export type Appearance = "light" | "dark"

const ThemeContext = React.createContext<{
  theme: Theme
  appearance: Appearance
  resolvedTheme: Appearance
  setTheme: (t: Theme) => void
  setAppearance: (a: Appearance) => void
}>({
  theme: "classic",
  appearance: "light",
  resolvedTheme: "light",
  setTheme: () => {},
  setAppearance: () => {},
})

const THEMES: Theme[] = ["classic", "muse", "volt"]
const APPEARANCES: Appearance[] = ["light", "dark"]

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const stored = localStorage.getItem("theme") as Theme | null
    if (stored && THEMES.includes(stored)) return stored
    return "classic"
  })
  const [appearance, setAppearanceState] = React.useState<Appearance>(() => {
    const stored = localStorage.getItem("appearance") as Appearance | null
    if (stored && APPEARANCES.includes(stored)) return stored
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  })

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.remove("dark", "theme-muse", "theme-volt")
    if (theme === "classic" && appearance === "dark") root.classList.add("dark")
    if (theme === "muse") root.classList.add("theme-muse")
    if (theme === "volt") root.classList.add("theme-volt")
    root.dataset.theme = theme
    root.dataset.appearance = appearance
  }, [theme, appearance])

  const setTheme = (t: Theme) => {
    localStorage.setItem("theme", t)
    setThemeState(t)
  }

  const setAppearance = (a: Appearance) => {
    localStorage.setItem("appearance", a)
    setAppearanceState(a)
  }

  return (
    <ThemeContext.Provider value={{ theme, appearance, resolvedTheme: appearance, setTheme, setAppearance }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => React.useContext(ThemeContext)
