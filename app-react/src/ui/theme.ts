export type ThemePref = 'auto' | 'light' | 'dark'

const KEY = 'ui-theme'

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function applyAttr(pref: ThemePref) {
  const html = document.documentElement
  if (pref === 'auto') html.removeAttribute('data-ui-theme')
  else html.setAttribute('data-ui-theme', pref)
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // Blocked storage: the choice still applies until reload.
  }
  applyAttr(pref)
}

/** Call once before the first render so the stored theme shows without a flash. */
export function applyThemePref(): void {
  applyAttr(getThemePref())
}
