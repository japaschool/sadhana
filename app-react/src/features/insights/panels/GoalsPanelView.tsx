import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLayout } from '../../../layouts/useLayout'
import type { Goal, ReportDataEntry } from '../../../api/charts'
import { fromDateStr } from '../../today/date'
import { formatDuration } from '../../today/values'
import { formatDay } from '../insightsLogic'
import { daysLeft, goalAvailable, goalSquares, loggedDays, type GoalSquare, type SquareState } from './goalLogic'
import type { Lookup } from './panelLogic'

interface GoalsPanelProps {
  goals: Goal[]
  /** The report data, which tells which days were logged at all. */
  entries: ReportDataEntry[]
  lookup: Lookup
  todayCob: string
  /** The report's form, where a gone practice is replaced; null on shared pages. */
  formLink: string | null
  /** 2 on mobile and in previews: smaller squares. */
  cols?: 2 | 4
  /** Off in examples: squares show nothing on tap or hover. */
  interactive?: boolean
}

/** A square (16m4): the met fill rises from the bottom over a track; over is the missed colour; running is dashed and open. */
function Square({ state, fill, running, size }: { state: SquareState; fill: number; running: boolean; size: number }) {
  const line = running ? 'dashed' : 'solid'
  const bg = state === 'blank' ? 'transparent' : state === 'over' ? 'var(--ui-state-under-fill)'
    : running ? 'transparent' : 'var(--ui-control)'
  const border = state === 'blank' ? '1px solid var(--ui-faint)'
    : state === 'over' ? `1.6px ${line} var(--ui-state-under)`
      : state === 'limit' ? `1.6px ${line} var(--ui-state-ok-solid)`
        : running ? '1.5px dashed var(--ui-faint2)' : 'none'
  const height = state === 'full' ? 100 : state === 'part' ? Math.round(fill * 100) : 0
  return (
    <span aria-hidden data-state={state} className="relative block shrink-0 overflow-hidden rounded-[5px]" style={{ width: size, height: size, background: bg }}>
      <span className="absolute inset-x-0 bottom-0 block" style={{ height: `${height}%`, background: 'var(--ui-state-ok-solid)' }} />
      <span className="absolute inset-0 block rounded-[5px]" style={{ border }} />
    </span>
  )
}

/** The period's dates: Nov 6, Oct 19 – 25, November 2026. */
function periodText(sq: GoalSquare, goal: Goal, locale: string): string {
  if (goal.period === 'Day') return formatDay(sq.from, locale)
  if (goal.period === 'Month') return fromDateStr(sq.from).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).formatRange(fromDateStr(sq.from), fromDateStr(sq.to))
}

/** The open square, "row-index", and whether a hover opened it (a leave closes that) or a tap (a second tap does). */
type Open = { key: string; hover: boolean } | null

function GoalRow({ goal, row, lookup, logged, todayCob, formLink, size, gap, open, setOpen, interactive, hover }: {
  goal: Goal; row: number; lookup: Lookup; logged: Set<string>; todayCob: string; formLink: string | null
  size: number; gap: number; open: Open; setOpen: (o: Open) => void; interactive: boolean; hover: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const name = lookup.name(goal.practice)
  const time = lookup.type(goal.practice) === 'Duration' && goal.counts === 'Total'
  const days = lookup.type(goal.practice) === 'Duration' && goal.counts === 'Days'
  const num = (v: number) => (time ? formatDuration(v, { h: t('today.unitH'), min: t('today.unitMin') }) : String(v))
  const amount = days
    ? t(goal.direction === 'AtLeast' ? 'reportPanels.goalsDaysAtLeast' : 'reportPanels.goalsDaysAtMost', { count: goal.amount })
    : num(goal.amount)
  const words = t(goal.direction === 'AtLeast' ? 'reportPanels.goalsAtLeast' : 'reportPanels.goalsAtMost',
    { amount, per: t(`reportPanels.goalsPer${goal.period}`) })
  const ok = goalAvailable(goal, lookup)
  const squares = ok ? goalSquares(goal, lookup, logged, todayCob) : []
  const now = squares[squares.length - 1]
  const of = (v: number) => t('reportPanels.goalsOf', { value: num(v), amount: num(goal.amount) })
  const left = now && daysLeft(now, todayCob)
  const progress = !now ? '' : left === null
    ? t('reportPanels.goalsToday', { value: num(now.value), amount: num(goal.amount) })
    : `${of(now.value)} · ${t('reportPanels.goalsDaysLeft', { count: left })}`

  return (
    <div className="flex flex-col gap-2.5 bg-ui-surface px-4 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        {name && <span className={`text-[15px] leading-[1.4] font-extrabold ${ok ? 'text-ui-ink' : 'text-ui-muted'}`}>{name}</span>}
        <span className="text-[13px] leading-[1.4] text-ui-muted">{words}</span>
        {ok && <span className="ml-auto text-[13px] leading-[1.4] font-bold text-ui-ink2 tabular-nums">{progress}</span>}
      </div>
      {ok ? (
        <div className="flex justify-end">
          {squares.map((sq, i) => {
            const key = `${row}-${i}`
            const dates = periodText(sq, goal, locale)
            const value = sq.state === 'blank' ? t('reportPanels.goalsNothing') : of(sq.value)
            const on = open?.key === key
            return (
              <button key={sq.from} type="button" aria-label={`${dates} · ${value}`}
                className="relative flex h-11 shrink-0 items-center justify-center" style={{ width: size + gap }}
                onClick={interactive ? () => setOpen(on && !open.hover ? null : { key, hover: false }) : undefined}
                onMouseEnter={hover ? () => setOpen({ key, hover: true }) : undefined}
                onMouseLeave={hover ? () => setOpen(open?.hover ? null : open) : undefined}>
                <span className={`rounded-[7px] ${on ? 'outline-2 outline-offset-2 outline-ui-ink' : ''}`}>
                  <Square state={sq.state} fill={sq.fill} running={sq.running} size={size} />
                </span>
                {on && (
                  <span aria-hidden className={`pointer-events-none absolute bottom-[calc(100%-2px)] z-10 flex items-baseline gap-1.5 whitespace-nowrap rounded-xl border border-ui-hairline bg-ui-sheet px-3 py-2 shadow-lg ${i >= squares.length - 6 ? 'right-0' : 'left-0'}`}>
                    <span className="text-[13px] font-extrabold text-ui-ink">{dates}</span>
                    <span className="text-[13px] text-ui-muted">·</span>
                    <span className="font-ui-mono text-[13px] font-medium text-ui-ink">{value}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2.5">
          <p className="text-sm leading-normal text-ui-ink2">{t('reportPanels.goalsGone')}</p>
          {formLink && (
            <Link to={formLink} className="flex min-h-11 items-center rounded-[10px] bg-ui-primary px-3.5 text-[13px] font-extrabold text-ui-on-primary">
              {t('reportPanels.choosePractice')}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

/** One row per goal, then the key (16m4, 16t2, 16d3). */
export function GoalsPanelView({ goals, entries, lookup, todayCob, formLink, cols = 4, interactive = true }: GoalsPanelProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Open>(null)
  // Hover is for the desktop's mouse; on a phone it would fire with the tap and undo it.
  const hover = useLayout() === 'desktop' && interactive
  const logged = loggedDays(entries)
  const [size, gap] = cols === 2 ? [22, 5] : [28, 6]
  const key: [string, SquareState, number, boolean][] = [
    [t('reportPanels.goalsKeyMet'), 'full', 1, false],
    [t('reportPanels.goalsKeyPart'), 'part', 0.5, false],
    [t('reportPanels.goalsKeyLimit'), 'limit', 0, false],
    [t('reportPanels.goalsKeyOver'), 'over', 0, false],
    [t('reportPanels.goalsNothing'), 'blank', 0, false],
    [t('reportPanels.goalsKeyRunning'), 'part', 0.4, true],
  ]
  return (
    <section className="flex flex-col rounded-[20px] border border-ui-hairline bg-ui-surface pt-1">
      <div className="flex flex-col gap-px border-t border-ui-hairline bg-ui-hairline">
        {goals.map((g, i) => (
          <GoalRow key={i} goal={g} row={i} lookup={lookup} logged={logged} todayCob={todayCob} formLink={formLink}
            size={size} gap={gap} open={open} setOpen={setOpen} interactive={interactive} hover={hover} />
        ))}
      </div>
      <ul aria-label={t('reportPanels.legend')} className="flex flex-wrap gap-x-3.5 gap-y-2 border-t border-ui-hairline px-4 pt-3 pb-3.5">
        {key.map(([text, state, fill, running]) => (
          <li key={text + String(running)} className="inline-flex items-center gap-1.5 text-xs leading-[1.3] font-bold text-ui-ink2">
            <Square state={state} fill={fill} running={running} size={14} />{text}
          </li>
        ))}
      </ul>
    </section>
  )
}
