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

  /** The account behind an Authorization header ("Token <jwt>"): the JWT's user_id. The token itself changes
   *  every session (/api/user mints a new one), the user doesn't. Falls back to the raw header. */
  function accountOf(auth) {
    try {
      const payload = String(auth).split(' ').pop().split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const id = JSON.parse(atob(payload)).user_id
      if (id) return String(id)
    } catch { /* not a JWT */ }
    return auth
  }

  /** One outbox record per (account, date, practice), so a newer value replaces the older one. */
  function outboxKey(auth, url, body) {
    const account = accountOf(auth)
    const date = entryDate(pathOf(url))
    let practice
    try { practice = JSON.parse(body).entry.practice } catch { /* not an entry */ }
    return date && practice !== undefined ? `${account}|${date}|${practice}` : `${account}|${url}`
  }

  /** The diary day response with the values still waiting in the outbox for that date and account.
   *  Oldest first, so the newest wins if one practice has records under keys from before accountOf. */
  function overlay(body, pending, date, auth) {
    const account = accountOf(auth)
    const days = [...body.diary_day]
    for (const r of [...pending].sort((a, b) => a.seq - b.seq)) {
      if (accountOf(r.auth) !== account || entryDate(pathOf(r.url)) !== date) continue
      let entry
      try { entry = JSON.parse(r.body).entry } catch { /* not JSON */ }
      if (!entry) continue
      const { practice, value } = entry
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

  return { entryDate, dayDate, accountOf, outboxKey, overlay, flushRecords, isUnchanged }
})()
