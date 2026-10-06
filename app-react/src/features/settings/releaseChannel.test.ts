import { describe, it, expect, afterEach } from 'vitest'
import { isPreview, setPreview } from './releaseChannel'

function stubCookie(jar: string) {
  const writes: string[] = []
  Object.defineProperty(document, 'cookie', { configurable: true, get: () => jar, set: (v: string) => { writes.push(v) } })
  return writes
}

describe('releaseChannel', () => {
  afterEach(() => { Reflect.deleteProperty(document, 'cookie') })

  it('parses a preview cookie among others', () => {
    stubCookie('foo=bar; sadhana_release_channel=preview; x=1')
    expect(isPreview()).toBe(true)
  })

  it('reads a missing or other value as stable', () => {
    stubCookie('foo=bar')
    expect(isPreview()).toBe(false)
    stubCookie('sadhana_release_channel=stable')
    expect(isPreview()).toBe(false)
  })

  it('ignores look-alike names and values', () => {
    stubCookie('xsadhana_release_channel=preview; sadhana_release_channel=preview2')
    expect(isPreview()).toBe(false)
  })

  it('setPreview writes the exact cookie string', () => {
    const writes = stubCookie('')
    setPreview(true)
    setPreview(false)
    expect(writes).toEqual([
      'sadhana_release_channel=preview; Path=/; Secure; SameSite=Lax; Max-Age=2592000',
      'sadhana_release_channel=stable; Path=/; Secure; SameSite=Lax; Max-Age=2592000',
    ])
  })
})
