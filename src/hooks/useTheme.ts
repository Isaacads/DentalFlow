import * as React from "react"

type Theme = "light" | "dark"

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("dentalflow.theme")
  if (stored === "light" || stored === "dark") return stored
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function useTheme() {
  const [theme, setTheme] = React.useState<Theme>(() => getInitialTheme())

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    localStorage.setItem("dentalflow.theme", theme)
  }, [theme])

  return { theme, setTheme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }
}
