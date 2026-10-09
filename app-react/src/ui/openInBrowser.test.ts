import { afterEach, describe, expect, it } from 'vitest'
import { iosStandalone17 } from './openInBrowser'

const setNav = (standalone: boolean | undefined, ua: string) => {
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true })
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
}
const IOS = (v: string) => `Mozilla/5.0 (iPhone; CPU iPhone OS ${v} like Mac OS X) AppleWebKit/605.1.15`

describe('iosStandalone17', () => {
  afterEach(() => { Reflect.deleteProperty(navigator, 'standalone'); Reflect.deleteProperty(navigator, 'userAgent') })
  it('is true only in an iOS 17+ home-screen app', () => {
    setNav(true, IOS('17_4')); expect(iosStandalone17()).toBe(true)
    setNav(true, IOS('16_7')); expect(iosStandalone17()).toBe(false)
    setNav(false, IOS('18_0')); expect(iosStandalone17()).toBe(false)
    setNav(undefined, 'Mozilla/5.0 (Macintosh)'); expect(iosStandalone17()).toBe(false)
  })
})
