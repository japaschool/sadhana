/** Local-calendar yyyy-mm-dd. Never use toISOString() for this: it shifts the day in non-UTC zones. */
export function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateStr(a) === toDateStr(b)
}

export function isFuture(d: Date, today: Date = new Date()): boolean {
  return toDateStr(d) > toDateStr(today)
}

/** Sunday before d's Mon–Sun week, the week itself, and the Monday after. */
export function nineDayWindow(d: Date): Date[] {
  const monday = addDays(d, -((d.getDay() + 6) % 7))
  return Array.from({ length: 9 }, (_, i) => addDays(monday, i - 1))
}

/** Monday-first month grid: `null` for leading blanks, then each day of the month. */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  return [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1)),
  ]
}
