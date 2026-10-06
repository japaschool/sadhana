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
