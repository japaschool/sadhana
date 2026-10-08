import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../../../api/yatras'
import type { YatraPractice, YatraStatisticConfig } from '../../../../types/api'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import { SegmentedControl } from '../../../../ui/primitives/SegmentedControl'
import { toDateStr } from '../../../today/date'
import type { DurationUnits } from '../../../today/values'
import { aggregationsFor, newStatistic, TIME_RANGES, withPractice } from '../statistics'
import { Tile } from '../../StatTiles'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, BTN, CARD, FIELD, HINT, LIST } from './AdminPage'
import { AutosaveText, ChoiceChips, ConfirmSheet, SheetHeader } from './fields'
import { aggLabel } from './summaries'
import { TypeIcon, typeLabelKey } from './TypeChip'

export function StatisticsMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const a = useYatraAdmin(id)
  const today = toDateStr(new Date())
  const dataQ = useQuery({ queryKey: ['yatra-data', id, today], queryFn: () => yatrasApi.getYatraData(id, today) })
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  return (
    <AdminPage admin={a} title={t('yatraSettings.statistics')}>
      {() => {
        const cfg = a.yatra!.statistics ?? { visible_to_all: false, statistics: [] }
        const list = cfg.statistics
        const practiceOf = (s: YatraStatisticConfig) => a.practices.find((p) => p.id === s.practice_id)
        const setList = (statistics: YatraStatisticConfig[], message: string, undoable = true) =>
          a.saveYatra({ statistics: { ...cfg, statistics } }, message, undoable)
        const raw = (i: number) => dataQ.data?.statistics[i]?.value
        const draft = editing === 'new' ? newStatistic(a.practices) : editing === null ? null : list[editing]

        function onChange(next: YatraStatisticConfig) {
          if (editing === 'new') {
            setList([...list, next], t('yatraSettings.statAdded'))
            setEditing(list.length)
          } else if (editing !== null) {
            setList(list.map((s, i) => (i === editing ? next : s)), t('common.saved'))
          }
        }

        return (
          <>
            <section className={`${CARD} flex flex-col gap-2 p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2">
                <span className="text-sm font-bold text-ui-ink">{t('yatraSettings.visibleTo')}</span>
                <SegmentedControl label={t('yatraSettings.visibleTo')} value={cfg.visible_to_all ? 'all' : 'admins'}
                  onChange={(v) => a.saveYatra({ statistics: { ...cfg, visible_to_all: v === 'all' } }, t('common.saved'))}
                  options={[{ value: 'admins', label: t('yatraSettings.visibleAdmins') }, { value: 'all', label: t('yatraSettings.visibleAll') }]} />
              </div>
              <p className={HINT}>{t('yatraSettings.visibleHint')}</p>
            </section>
            {list.length > 0 && (
              <section aria-label={t('yatraSettings.preview')} className="flex flex-col gap-2">
                <h2 className="px-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{t('yatraSettings.preview')}</h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {list.map((s, i) => <Tile key={i} stat={s} dt={practiceOf(s)?.data_type} raw={raw(i)} units={units} />)}
                </div>
              </section>
            )}
            {list.length > 0 && (
              <div className={LIST}>
                {list.map((s, i) => {
                  const p = practiceOf(s)
                  return (
                    <button key={i} type="button" onClick={() => setEditing(i)} className="flex min-h-[60px] items-center gap-3 bg-ui-surface px-4 py-2 text-left">
                      {p && <TypeIcon type={p.data_type} />}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-bold text-ui-ink">{s.label}</span>
                        <span className="text-xs text-ui-muted">
                          {`${p?.practice ?? '—'} · ${aggLabel(t, s.aggregation, p?.data_type)} · ${t(`yatraSettings.range${s.time_range}`)}`}
                        </span>
                      </span>
                      <span aria-hidden className="text-lg text-ui-faint2">›</span>
                    </button>
                  )
                })}
              </div>
            )}
            <button type="button" disabled={!a.practices.length} onClick={() => setEditing('new')}
              className={`${BTN} border border-dashed border-ui-control bg-ui-surface text-ui-accent disabled:opacity-50`}>
              {t('yatraSettings.addStatistic')}
            </button>
            {draft && (
              // One sheet for add and edit: a new statistic becomes an edited one after its first change.
              <StatisticSheet key="statistic" initial={draft} isNew={editing === 'new'} practices={a.practices} units={units}
                raw={typeof editing === 'number' ? raw(editing) : undefined} onChange={onChange} onClose={() => setEditing(null)}
                onDelete={() => {
                  setList(list.filter((_, i) => i !== editing), t('yatraSettings.statDeleted'), false)
                  setEditing(null)
                }} />
            )}
          </>
        )
      }}
    </AdminPage>
  )
}

function StatisticSheet({ initial, isNew, practices, units, raw, onChange, onDelete, onClose }: {
  initial: YatraStatisticConfig; isNew: boolean; practices: YatraPractice[]; units: DurationUnits; raw: unknown
  onChange: (s: YatraStatisticConfig) => void; onDelete: () => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(initial)
  const [confirming, setConfirming] = useState(false)
  const dt = practices.find((p) => p.id === draft.practice_id)?.data_type ?? 'Int'
  const change = (next: YatraStatisticConfig) => {
    setDraft(next)
    if (next.label.trim()) onChange(next)
  }
  if (confirming) {
    return (
      <ConfirmSheet title={t('yatraSettings.deleteStatTitle', { label: draft.label })} text={t('yatraSettings.deleteStatText')}
        confirm={t('yatraSettings.deleteStat')} onConfirm={onDelete} onClose={() => setConfirming(false)} />
    )
  }
  // Today's value was worked out for the statistic as it was opened; after a change it would mislead.
  const measured = draft.practice_id === initial.practice_id && draft.aggregation === initial.aggregation && draft.time_range === initial.time_range
  // Done keeps what the preview shows, even untouched; × on a new statistic adds nothing.
  const done = () => {
    if (isNew && draft.label.trim()) onChange(draft)
    onClose()
  }
  const title = t(isNew ? 'yatraSettings.newStatistic' : 'yatraSettings.editStatistic')
  return (
    <BottomSheet label={title} onClose={onClose}>
      <SheetHeader title={title} onClose={onClose} />
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-ui-muted">{t('yatraSettings.tilePreview')}</span>
        <Tile stat={draft} dt={dt} raw={measured ? raw : undefined} units={units} />
      </div>
      <AutosaveText id="stat-label" label={t('yatraSettings.label')} value={draft.label}
        validate={(v) => (v.trim() ? null : t('yatraSettings.labelEmpty'))} onCommit={(v) => change({ ...draft, label: v.trim() })} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="stat-practice" className="text-[13px] font-bold text-ui-muted">{t('yatraSettings.practice')}</label>
        <select id="stat-practice" className={FIELD} value={draft.practice_id}
          onChange={(e) => change(withPractice(draft, practices.find((p) => p.id === e.target.value)!))}>
          {practices.map((p) => <option key={p.id} value={p.id}>{`${p.practice} · ${t(typeLabelKey(p.data_type))}`}</option>)}
        </select>
      </div>
      <ChoiceChips label={t('yatraSettings.aggregation')} value={draft.aggregation} onChange={(g) => change({ ...draft, aggregation: g })}
        options={aggregationsFor(dt).map((g) => ({ value: g, label: aggLabel(t, g, dt) }))} />
      {dt === 'Time' && <p className={HINT}>{t('yatraSettings.noSumForTime')}</p>}
      <ChoiceChips label={t('yatraSettings.timeRange')} value={draft.time_range} onChange={(r) => change({ ...draft, time_range: r })}
        options={TIME_RANGES.map((r) => ({ value: r, label: t(`yatraSettings.range${r}`) }))} />
      <div className="flex gap-2.5">
        {!isNew && (
          <button type="button" onClick={() => setConfirming(true)} className={`${BTN} flex-1 border border-ui-control text-ui-danger`}>
            {t('yatraSettings.deleteStat')}
          </button>
        )}
        <button type="button" onClick={done} className={`${BTN} flex-1 bg-ui-primary text-ui-on-primary`}>{t('yatraSettings.done')}</button>
      </div>
    </BottomSheet>
  )
}
