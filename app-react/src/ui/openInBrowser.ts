import type { MouseEvent } from 'react'

/** iOS 17+ in a home-screen app: other sites open in an in-app sheet, not Safari. */
export function iosStandalone17(): boolean {
  if (!(navigator as Navigator & { standalone?: boolean }).standalone) return false
  const major = Number(/OS (\d+)_/.exec(navigator.userAgent)?.[1] ?? 0)
  return major >= 17
}

/** onClick for an external https link: on an iOS home-screen app, hand it to Safari itself.
 *  ponytail: x-safari-https:// is undocumented (iOS 17+); elsewhere the link's own target="_blank" does the job. */
export function openInBrowser(e: MouseEvent<HTMLAnchorElement>) {
  const { href } = e.currentTarget
  if (!href.startsWith('https://') || !iosStandalone17()) return
  e.preventDefault()
  window.location.href = `x-safari-${href}`
}
