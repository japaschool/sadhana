import { useCallback, useState } from 'react'
import { getThemePref, setThemePref, type ThemePref } from './theme'

export function useTheme() {
  const [pref, setPref] = useState(getThemePref)
  const update = useCallback((p: ThemePref) => { setThemePref(p); setPref(p) }, [])
  return [pref, update] as const
}
