import { useEffect, useState } from "react"

export function useColorMode() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")
  const [resolved, setResolved] = useState<"light" | "dark">("light")

  useEffect(() => {
    const root = window.document.documentElement
    const observer = new MutationObserver(() => {
      const dark = root.classList.contains("dark")
      setResolved(dark ? "dark" : "light")
    })
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    setResolved(root.classList.contains("dark") ? "dark" : "light")
    return () => observer.disconnect()
  }, [])

  return { theme, setTheme, isDark: resolved === "dark" }
}
