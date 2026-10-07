export const SUPPORTED = ['en', 'ru', 'uk']

// The Rust UI kept the language under `user_language` (JSON-quoted, "sys" = follow the
// browser). Carry an explicit choice over to i18next's key once.
export function migrateLegacyLanguage() {
  try {
    if (localStorage.getItem('i18nextLng')) return
    const legacy = JSON.parse(localStorage.getItem('user_language') ?? 'null')
    if (SUPPORTED.includes(legacy)) localStorage.setItem('i18nextLng', legacy)
  } catch { /* unreadable legacy value or blocked storage: detection decides */ }
}
