// Pure logic for service_worker.js. A classic script: the worker loads it with importScripts,
// and src/sw-lib.test.js runs it against a fake `self`. Both read self.swLib.
self.swLib = (() => {
  const ENTRY = /^\/api\/diary\/(\d{4}-\d{2}-\d{2})\/entry$/
  const DAY = /^\/api\/diary\/(\d{4}-\d{2}-\d{2})$/

  /** The yyyy-mm-dd of a diary entry PUT path, or null. */
  const entryDate = (path) => ENTRY.exec(path)?.[1] ?? null
  /** The yyyy-mm-dd of a diary day GET path, or null. */
  const dayDate = (path) => DAY.exec(path)?.[1] ?? null
  const pathOf = (url) => new URL(url, 'https://x').pathname

  /** One outbox record per (account, date, practice), so a newer value replaces the older one. */
  function outboxKey(auth, url, body) {
    const date = entryDate(pathOf(url))
    let practice
    try { practice = JSON.parse(body).entry.practice } catch { /* not an entry */ }
    return date && practice !== undefined ? `${auth}|${date}|${practice}` : `${auth}|${url}`
  }

  /** The diary day response with the values still waiting in the outbox for that date and account. */
  function overlay(body, pending, date, auth) {
    const days = [...body.diary_day]
    for (const r of pending) {
      if (r.auth !== auth || entryDate(pathOf(r.url)) !== date) continue
      const { practice, value } = JSON.parse(r.body).entry
      const i = days.findIndex((e) => e.practice === practice)
      if (i >= 0) days[i] = { ...days[i], value }
      else days.push({ practice, value })
    }
    return { ...body, diary_day: days }
  }

  /** Sends records oldest first. Stops at the first network error, timeout or 5xx, keeping the rest.
   *  2xx and 4xx are settled (a 4xx won't succeed on retry). Resolves key → { seq, res } of what was sent. */
  async function flushRecords(records, send, settle) {
    const results = new Map()
    for (const r of [...records].sort((a, b) => a.seq - b.seq)) {
      let res
      try { res = await send(r) } catch { break }
      if (res.status >= 500) break
      results.set(r.key, { seq: r.seq, res })
      await settle(r)
    }
    return results
  }

  /** A sent record may be deleted only if no newer value replaced it while it was in flight. */
  const isUnchanged = (stored, sent) => !!stored && stored.seq === sent.seq

  return { entryDate, dayDate, outboxKey, overlay, flushRecords, isUnchanged }
})()
