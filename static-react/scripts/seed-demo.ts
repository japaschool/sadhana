// Seeds a demo account per language (plus yatra members) into the local dev server, for the landing screenshots.
// Run: npx -y tsx scripts/seed-demo.ts   (server at $API or localhost:8080; $DATABASE_URL or the Makefile's dev DB)
// It deletes and recreates every user whose email ends in DEMO_DOMAIN, so it can be rerun.
import { execFileSync } from 'node:child_process'
import { durationPanels, japaPanels, sleepPanels } from '../../app-react/src/features/insights/panels/templates'

const API = process.env.API ?? 'http://localhost:8080/api'
const DB = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@192.168.68.102:5432/sadhana_pro'
export const DEMO_DOMAIN = 'demo.sadhana.pro'
export const PASSWORD = 'demo-password'
const DAYS = 400

type Lang = 'en' | 'ru' | 'uk'
type Val = { Int: number } | { Bool: boolean } | { Time: { h: number; m: number } } | { Text: string } | { Duration: number }

const T = {
  en: {
    me: 'Sam', byTime: 'By 7:30', members: ['Arjun', 'Maya', 'Daniel', 'Priya'], yatra: 'Morning sadhana',
    groups: ['Morning', 'Study', 'Body'],
    p: { wake: 'Wake up', morning: 'Rounds by 7:30', rounds: 'Rounds', meditation: 'Meditation', reading: 'Reading', lectures: 'Lectures', yoga: 'Yoga', bed: 'Bedtime', note: 'Note' },
    r: { sleep: 'Sleep', japa: 'Japa', study: 'Study', table: 'Sadhana chart' },
    periods: { travel: 'Summer travel', kartik: 'Kartik' },
    notes: ['Early start, quiet mind', 'Long day at work', 'Kirtan in the evening', 'Read on the train', 'Felt rested'],
  },
  ru: {
    me: 'Саша', byTime: 'До 7:30', members: ['Андрей', 'Мария', 'Дмитрий', 'Ольга'], yatra: 'Утренняя садхана',
    groups: ['Утро', 'Изучение', 'Тело'],
    p: { wake: 'Подъём', morning: 'Круги до 7:30', rounds: 'Круги', meditation: 'Медитация', reading: 'Чтение', lectures: 'Лекции', yoga: 'Йога', bed: 'Отбой', note: 'Заметка' },
    r: { sleep: 'Сон', japa: 'Джапа', study: 'Изучение', table: 'Таблица садханы' },
    periods: { travel: 'Летняя поездка', kartik: 'Картика' },
    notes: ['Ранний подъём, спокойный ум', 'Долгий рабочий день', 'Вечером киртан', 'Читал в электричке', 'Хорошо выспался'],
  },
  uk: {
    me: 'Саша', byTime: 'До 7:30', members: ['Олександр', 'Ірина', 'Тарас', 'Оксана'], yatra: 'Ранкова садгана',
    groups: ['Ранок', 'Вивчення', 'Тіло'],
    p: { wake: 'Підйом', morning: 'Кола до 7:30', rounds: 'Кола', meditation: 'Медитація', reading: 'Читання', lectures: 'Лекції', yoga: 'Йога', bed: 'Відбій', note: 'Нотатка' },
    r: { sleep: 'Сон', japa: 'Джапа', study: 'Вивчення', table: 'Таблиця садгани' },
    periods: { travel: 'Літня поїздка', kartik: 'Картіка' },
    notes: ['Ранній підйом, спокійний розум', 'Довгий робочий день', 'Увечері кіртан', 'Читав у потязі', 'Добре виспався'],
  },
} satisfies Record<Lang, unknown>

// Deterministic, so reruns give the same pictures.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d }
const time = (min: number): Val => { const m = ((Math.round(min / 5) * 5) % 1440 + 1440) % 1440; return { Time: { h: Math.floor(m / 60), m: m % 60 } } }

function psql(sql: string) {
  return execFileSync('docker', ['run', '--rm', 'postgres:16-alpine', 'psql', DB, '-tAc', sql], { encoding: 'utf8' }).trim()
}

async function call<R = unknown>(method: string, path: string, token: string | null, body?: unknown): Promise<R> {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Token ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as R
}

async function signup(email: string, name: string, lang: Lang): Promise<string> {
  const confirmation = psql(`insert into confirmations (id, email, expires_at) values (gen_random_uuid(), '${email}', now() + interval '1 day')
    on conflict (email) do update set expires_at = excluded.expires_at returning id`).split('\n')[0]
  const res = await call<{ user: { token: string } }>('POST', '/users', null, {
    user: { email, name, password: PASSWORD, lang, confirmation_id: confirmation, skip_defaults: true },
  })
  return res.user.token
}

function wipe() {
  // ponytail: hand-listed child tables; a new table referencing users makes this delete fail loudly, add it here.
  const users = `(select id from users where email like '%@${DEMO_DOMAIN}')`
  const yatras = `(select yatra_id from yatra_users where user_id in ${users} and is_admin)`
  psql(`begin;
    delete from yatra_user_practices where yatra_practice_id in (select id from yatra_practices where yatra_id in ${yatras});
    delete from yatra_practices where yatra_id in ${yatras};
    delete from yatra_users where yatra_id in ${yatras} or user_id in ${users};
    delete from yatras where id not in (select yatra_id from yatra_users);
    delete from diary where user_id in ${users};
    delete from report_traces where report_id in (select id from reports where user_id in ${users});
    delete from reports where user_id in ${users};
    delete from marked_periods where user_id in ${users};
    delete from share_link_reports where share_link_id in (select id from share_links where user_id in ${users});
    delete from share_links where user_id in ${users};
    delete from insight_prefs where user_id in ${users};
    delete from user_practices where user_id in ${users};
    delete from practice_groups where user_id in ${users};
    delete from guide_runs where user_id in ${users};
    delete from users where id in ${users};
    delete from confirmations where email like '%@${DEMO_DOMAIN}';
    commit;`)
}

type Keys = keyof typeof T.en.p

/** One person's day. `lvl` 0..1 is how disciplined they are; `kartik`/`travel` bend it. */
function day(r: () => number, lvl: number, dow: number, phase: 'normal' | 'travel' | 'kartik', n: (typeof T)[Lang]['notes']): Partial<Record<Keys, Val>> | null {
  const travel = phase === 'travel', kartik = phase === 'kartik'
  if (r() < (travel ? 0.25 : 0.03)) return null
  const weekend = dow === 0 || dow === 6
  const wake = 4 * 60 + 30 + (1 - lvl) * 70 + (weekend ? 25 : 0) + (travel ? 75 : 0) - (kartik ? 20 : 0) + (r() - 0.5) * 40
  const sleep = 6.6 * 60 + r() * 70
  const target = 16
  const rounds = kartik ? target + Math.round(r() * 8) : r() < lvl * 0.95 ? target : Math.round(target - 2 - r() * 8)
  const morning = Math.min(rounds, Math.round(rounds * (0.45 + lvl * 0.4 + (kartik ? 0.15 : 0) - (travel ? 0.3 : 0) + (r() - 0.5) * 0.2)))
  const v: Partial<Record<Keys, Val>> = {
    wake: time(wake),
    rounds: { Int: rounds },
    morning: { Int: Math.max(0, morning) },
    bed: time(wake + 24 * 60 - sleep),
  }
  if (r() < 0.55 + lvl * 0.3) v.meditation = { Duration: Math.round(10 + r() * 25) }
  if (r() < 0.8) v.reading = { Duration: Math.round(15 + r() * (kartik ? 75 : 45)) }
  if (r() < 0.45) v.lectures = { Duration: Math.round(20 + r() * 70) }
  v.yoga = { Bool: r() < (travel ? 0.2 : 0.65) }
  if (r() < 0.12) v.note = { Text: n[Math.floor(r() * n.length)] }
  return v
}

function phaseOf(ago: number): 'normal' | 'travel' | 'kartik' {
  if (ago >= 100 && ago <= 113) return 'travel'
  if (ago <= 13) return 'kartik'
  return 'normal'
}

async function seed(lang: Lang) {
  const t = T[lang]
  const token = await signup(`demo-${lang}@${DEMO_DOMAIN}`, t.me, lang)

  const groupIds = []
  for (const g of t.groups) groupIds.push((await call<{ id: string }>('POST', '/user/practice-groups', token, { name: g })).id)
  const layout: [Keys, string, number][] = [
    ['wake', 'Time', 0], ['morning', 'Int', 0], ['rounds', 'Int', 0], ['meditation', 'Duration', 0],
    ['reading', 'Duration', 1], ['lectures', 'Duration', 1],
    ['yoga', 'Bool', 2], ['bed', 'Time', 2], ['note', 'Text', 2],
  ]
  for (const [k, type, g] of layout) {
    await call('POST', '/user/practices', token, {
      user_practice: { practice: t.p[k], data_type: type, is_active: true, is_required: k === 'wake' || k === 'rounds', group_id: groupIds[g] },
    })
  }
  const practices = (await call<{ user_practices: { id: string; practice: string }[] }>('GET', '/user/practices', token)).user_practices
  const id = (k: Keys) => practices.find((p) => p.practice === t.p[k])!.id

  // A year of entries; today only has the morning filled in.
  const r = rng(lang.charCodeAt(0) * 97)
  for (let ago = DAYS; ago >= 0; ago--) {
    const d = daysAgo(ago)
    const lvl = 0.55 + 0.35 * (1 - ago / DAYS)
    let v = day(r, lvl, d.getDay(), phaseOf(ago), t.notes)
    if (ago === 0) v = { wake: time(4 * 60 + 25), morning: { Int: 16 }, rounds: { Int: 20 }, meditation: { Duration: 20 }, reading: { Duration: 35 }, yoga: { Bool: true } }
    if (!v) continue
    await call('PUT', `/diary/${ymd(d)}`, token, { diary_day: Object.entries(v).map(([k, value]) => ({ practice: t.p[k as Keys], value })) })
  }

  const report = (name: string, definition: unknown) => call('POST', '/reports', token, { report: { name, definition } })
  await report(t.r.sleep, { Panels: sleepPanels({ bedtime: id('bed'), wake: id('wake'), nap: null, min: 360, max: 540 }) })
  await report(t.r.japa, { Panels: japaPanels({ total: id('rounds'), target: 16, morning: id('morning'), quality: null, attunement: null }) })
  await report(t.r.study, { Panels: durationPanels({ practices: [id('reading'), id('lectures'), id('meditation')], goal: 60 }) })
  await report(t.r.table, { Grid: { practices: layout.map(([k]) => id(k)), group_columns: true } })

  await call('POST', '/marked-periods', token, { name: t.periods.travel, start_date: ymd(daysAgo(113)), end_date: ymd(daysAgo(100)), exclude_from_usual: true })
  await call('POST', '/marked-periods', token, { name: t.periods.kartik, start_date: ymd(daysAgo(13)), end_date: null, exclude_from_usual: false })

  // A yatra with four members tracking the same four practices.
  const yatra = (await call<{ yatra: { id: string } }>('POST', '/yatras', token, { name: t.yatra })).yatra.id
  const shared: [Keys, string][] = [['wake', 'Time'], ['morning', 'Int'], ['rounds', 'Int'], ['reading', 'Duration']]
  // A yatra column is narrow, so it takes a short name and is linked to each member's own practice.
  const label = (k: Keys) => (k === 'morning' ? t.byTime : t.p[k])
  for (const [k, type] of shared) await call('POST', `/yatra/${yatra}/practices`, token, { practice: { yatra_id: yatra, practice: label(k), data_type: type } })
  const zones: Partial<Record<Keys, unknown>> = {
    wake: { better_direction: 'Lower', no_value_colour: 'Neutral', bounds: [{ to: { Time: { h: 5, m: 0 } }, colour: 'DarkGreen' }, { to: { Time: { h: 6, m: 0 } }, colour: 'Green' }, { to: { Time: { h: 7, m: 0 } }, colour: 'Yellow' }, { to: null, colour: 'MutedRed' }] },
    rounds: { better_direction: 'Higher', no_value_colour: 'Neutral', bounds: [{ to: { Int: 8 }, colour: 'MutedRed' }, { to: { Int: 15 }, colour: 'Yellow' }, { to: null, colour: 'Green' }] },
    morning: { better_direction: 'Higher', no_value_colour: 'Neutral', bounds: [{ to: { Int: 7 }, colour: 'Yellow' }, { to: null, colour: 'Green' }] },
  }
  const link = async (tok: string) => {
    const items = (await call<{ practices: { yatra_practice: { id: string; practice: string } }[] }>('GET', `/yatra/${yatra}/user-practices`, tok)).practices
    await call('PUT', `/yatra/${yatra}/user-practices`, tok, {
      practices: items.map((i) => ({ ...i, user_practice: t.p[shared.find(([k]) => label(k) === i.yatra_practice.practice)![0]] })),
    })
  }
  for (const p of (await call<{ practices: { id: string; practice: string; data_type: string }[] }>('GET', `/yatra/${yatra}/practices`, token)).practices) {
    const k = shared.find(([key]) => label(key) === p.practice)![0]
    if (zones[k]) await call('PUT', `/yatra/${yatra}/practice/${p.id}`, token, { practice: { ...p, colour_zones: zones[k] } })
  }
  await link(token)

  for (const [i, name] of t.members.entries()) {
    const tok = await signup(`m${i}-${lang}@${DEMO_DOMAIN}`, name, lang)
    for (const [k, type] of shared) await call('POST', '/user/practices', tok, { user_practice: { practice: t.p[k], data_type: type, is_active: true } })
    await call('PUT', `/yatra/${yatra}/join`, tok)
    await link(tok)
    const mr = rng(i * 31 + lang.charCodeAt(1))
    for (let ago = 21; ago >= 0; ago--) {
      const d = daysAgo(ago)
      // Everyone has logged this morning, so the group's Today view is full.
      const v = (ago === 0 ? null : day(mr, [0.95, 0.7, 0.5, 0.8][i], d.getDay(), 'normal', t.notes))
        ?? { wake: time(4 * 60 + 40 + i * 20), morning: { Int: [16, 10, 6, 12][i] }, rounds: { Int: [16, 16, 12, 16][i] }, reading: { Duration: 15 + i * 10 } }
      await call('PUT', `/diary/${ymd(d)}`, tok, { diary_day: shared.filter(([k]) => v[k]).map(([k]) => ({ practice: t.p[k], value: v[k] })) })
    }
  }
  console.log(`seeded ${lang}: demo-${lang}@${DEMO_DOMAIN} / ${PASSWORD}`)
}

wipe()
await Promise.all((['en', 'ru', 'uk'] as const).map(seed))
