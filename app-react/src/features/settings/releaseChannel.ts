// Port of frontend/src/utils/release_channel.rs. nginx routes on this cookie, so keep it identical.
const COOKIE = 'sadhana_release_channel'

export function isPreview(): boolean {
  for (const pair of document.cookie.split(';')) {
    const [name, value] = pair.trim().split('=')
    if (name === COOKIE) return value === 'preview'
  }
  return false
}

export function setPreview(on: boolean): void {
  document.cookie = `${COOKIE}=${on ? 'preview' : 'stable'}; Path=/; Secure; SameSite=Lax; Max-Age=2592000`
}

/** After setPreview: page opens are served from the worker's cache, so the cookie alone doesn't switch UIs.
 *  Fetch the other channel's worker (it takes over at once) and reload on the takeover, or after 10 s anyway. */
export async function switchChannel(timeoutMs = 10_000): Promise<void> {
  const sw = navigator.serviceWorker
  const reg = await sw?.getRegistration()
  if (reg) {
    await new Promise<void>((resolve) => {
      sw.addEventListener('controllerchange', () => resolve(), { once: true })
      setTimeout(resolve, timeoutMs)
      reg.update().catch(() => resolve())
    })
  }
  window.location.reload()
}
