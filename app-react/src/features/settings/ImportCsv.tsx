import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { practicesApi } from '../../api/practices'
import { PracticeSheet } from '../practices/mobile/PracticeSheet'
import { usePractices } from '../practices/usePractices'
import { useLayout } from '../../layouts/useLayout'
import { CARD, LIST } from '../yatras/settings/mobile/AdminPage'
import { TypeChip } from '../yatras/settings/mobile/TypeChip'
import { readCsv, toDays } from './csvImport'
import type { CellError, CsvFile, Day } from './csvImport'
import { ErrorBanner, PRIMARY, SettingsDetail, SPINNER } from './SettingsDetail'

const INPUT_ID = 'import-file'
const SECTION = 'flex items-center gap-2 px-1 text-[17px] font-extrabold text-ui-ink'
const COUNT = 'rounded-full bg-ui-chip px-2 py-0.5 font-ui-mono text-xs font-semibold text-ui-muted'
const CODE = 'rounded-md bg-ui-chip px-1.5 py-0.5 font-ui-mono text-[13px] font-semibold text-ui-ink'
const CHECK = 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ui-good text-[11px] font-bold text-white'

type Step = 'file' | 'review' | 'result'
type Chosen = { file: File; csv: CsvFile }
type Picked = { file: File; text: string }

const describe = (t: TFunction, e: CellError) => e.kind === 'date'
  ? t('import.errDate', { value: e.value })
  : t(`import.err${e.kind}`, { value: e.value, column: e.column })

function Stepper({ step, failed }: { step: Step; failed: boolean }) {
  const { t } = useTranslation()
  const steps: Step[] = ['file', 'review', 'result']
  const at = steps.indexOf(step)
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done = i < at || (s === 'result' && step === 'result' && !failed)
        const current = i === at && !done
        return (
          <li key={s} aria-current={current ? 'step' : undefined} className={`flex items-center gap-2 ${i ? 'flex-1' : ''}`}>
            {i > 0 && <span aria-hidden className={`h-[1.5px] flex-1 ${i <= at ? 'bg-ui-accent-fill' : 'bg-ui-control'}`} />}
            <span className={`flex items-center gap-1.5 text-[13px] ${current ? 'font-extrabold text-ui-ink' : 'font-semibold text-ui-muted'}`}>
              {done
                ? <span aria-hidden className={CHECK}>✓</span>
                : <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full font-ui-mono text-[11px] font-bold ${current
                  ? failed ? 'bg-ui-danger text-white' : 'bg-ui-accent-fill text-ui-ink'
                  : 'border border-ui-faint text-ui-muted'}`}>{i + 1}</span>}
              {t(`import.step.${s}`)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Rules() {
  const { t } = useTranslation()
  const rule = (n: number, body: ReactNode) => (
    <li key={n} className="flex gap-3 text-sm leading-normal text-ui-ink2">
      <span className="w-3 shrink-0 font-ui-mono text-[13px] font-bold text-ui-accent">{n}</span><span>{body}</span>
    </li>
  )
  return (
    <section className={`${CARD} flex flex-col gap-3 p-4`}>
      <h2 className="text-[17px] font-extrabold text-ui-ink">{t('import.rulesTitle')}</h2>
      <ol className="flex flex-col gap-2.5">
        {rule(1, <>{t('import.rule1')} <code className={CODE}>YYYY-MM-DD</code></>)}
        {[2, 3, 4, 5].map((n) => rule(n, t(`import.rule${n}`)))}
        {rule(6, <>{t('import.rule6a')} <code className={CODE}>true</code>, <code className={CODE}>false</code> {t('import.rule6b')}</>)}
      </ol>
      <p className="pt-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{t('import.example')}</p>
      <pre className="overflow-x-auto rounded-xl bg-ui-field p-3 font-ui-mono text-xs leading-relaxed text-ui-ink2">
        {'date,Japa rounds,Wake-up time,Mangala arati\n2024-10-01,16,04:30,true\n2024-10-02,"12",05:10,'}
      </pre>
    </section>
  )
}

const CsvBadge = () => (
  <span aria-hidden className="flex h-11 w-9 shrink-0 items-end justify-center rounded-lg bg-ui-accent-pill pb-1 font-ui-mono text-[9px] font-bold text-ui-ink2">CSV</span>
)

/** Step 1's picker: a card to tap on mobile, a drop zone elsewhere. */
function Picker({ chosen, onFile }: { chosen: Chosen | null; onFile: (f: File) => void }) {
  const { t } = useTranslation()
  const mobile = useLayout() === 'mobile'
  const [over, setOver] = useState(false)
  if (chosen) return (
    <label htmlFor={INPUT_ID} className={`${CARD} flex cursor-pointer items-center gap-3 p-3.5`}>
      <CsvBadge />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-ui-mono text-sm font-semibold text-ui-ink">{chosen.file.name}</span>
        <span className="text-[13px] text-ui-muted">
          {t('import.kb', { n: Math.max(1, Math.round(chosen.file.size / 1024)) })} · <span className="font-semibold text-ui-accent">{t('import.tapToChange')}</span>
        </span>
      </span>
    </label>
  )
  if (mobile) return (
    <label htmlFor={INPUT_ID} className="flex cursor-pointer items-center gap-3 rounded-[18px] border border-dashed border-ui-accent-fill bg-ui-accent-soft p-3.5">
      <CsvBadge />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-extrabold text-ui-ink">{t('import.choose')}</span>
        <span className="text-[13px] text-ui-muted">{t('import.csvOnly')}</span>
      </span>
      <span aria-hidden className="text-lg text-ui-accent">›</span>
    </label>
  )
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
      className={`flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-ui-accent-fill px-6 py-8 ${over ? 'bg-ui-accent-pill' : 'bg-ui-accent-soft'}`}>
      <CsvBadge />
      <p className="pt-1 text-[17px] font-extrabold text-ui-ink">{t('import.drop')}</p>
      <p className="flex items-center gap-2 text-[13px] text-ui-muted">
        {t('import.or')}
        <label htmlFor={INPUT_ID} className="flex min-h-9 cursor-pointer items-center rounded-full border border-ui-control bg-ui-surface px-4 text-sm font-bold text-ui-ink">{t('import.browse')}</label>
      </p>
      <p className="text-xs text-ui-muted">{t('import.csvOnly')}</p>
    </div>
  )
}

function Review({ chosen, busy, onChange, onAdd }: { chosen: Chosen; busy: boolean; onChange: () => void; onAdd: (name: string) => void }) {
  const { t } = useTranslation()
  const { columns, rows } = chosen.csv
  const matched = columns.filter((c) => c.type)
  const unmatched = columns.filter((c) => !c.type)
  const row = 'flex min-h-[54px] items-center gap-3 bg-ui-surface px-3.5 py-2'
  return (
    <div className={`flex flex-col gap-4 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
      <div className={`${CARD} flex items-center gap-3 p-3`}>
        <CsvBadge />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-ui-mono text-sm font-semibold text-ui-ink">{chosen.file.name}</span>
          <span className="text-[13px] text-ui-muted">{t('import.rows', { count: rows.length })} · {t('import.columns', { count: columns.length + 1 })}</span>
        </span>
        <button type="button" onClick={onChange} className="flex min-h-10 shrink-0 items-center rounded-full border border-ui-control px-4 text-sm font-bold text-ui-ink">
          {t('import.change')}
        </button>
      </div>
      {matched.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className={SECTION}>{t('import.matched')}<span className={COUNT}>{matched.length}</span></h2>
            <p className="px-1 text-[13px] text-ui-muted">{t('import.matchedHint')}</p>
          </div>
          <ul className={LIST}>
            <li className={row}>
              <span aria-hidden className="flex h-5 w-5 items-center justify-center text-ui-muted">◷</span>
              <span className="min-w-0 flex-1 truncate font-ui-mono text-sm font-semibold text-ui-ink">{chosen.csv.date}</span>
              <span className="text-[13px] text-ui-muted">{t('import.usedAsDay')}</span>
            </li>
            {matched.map((c) => (
              <li key={c.name} className={row}>
                <span aria-hidden className={CHECK}>✓</span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ui-ink">{c.name}</span>
                <TypeChip type={c.type!} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {unmatched.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className={SECTION}>{t('import.unmatched')}<span className={COUNT}>{unmatched.length}</span></h2>
            <p className="px-1 text-[13px] text-ui-muted">{t('import.unmatchedHint')}</p>
          </div>
          <ul className={LIST}>
            {unmatched.map((c) => (
              <li key={c.name} className={row}>
                <span aria-hidden className="h-5 w-5 shrink-0 rounded-full border-[1.5px] border-dashed border-ui-faint" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-bold text-ui-ink">{c.name}</span>
                  <span className="text-xs text-ui-muted">{t('import.notImported')}</span>
                </span>
                <button type="button" onClick={() => onAdd(c.name)} aria-label={t('import.addPractice', { name: c.name })}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ui-accent-pill bg-ui-accent-soft text-lg font-bold text-ui-accent">+</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {matched.length
        ? <p className="rounded-[14px] border border-ui-hairline bg-ui-surface/60 px-3.5 py-3 text-[13px] leading-normal text-ui-ink2">{t('import.overwriteNote')}</p>
        : (
          <div className="flex flex-col gap-1 rounded-[18px] border border-dashed border-ui-faint p-4">
            <p className="text-[15px] font-extrabold text-ui-ink">{t('import.noMatchTitle')}</p>
            <p className="text-sm leading-normal text-ui-ink2">{t('import.noMatchHint')}</p>
          </div>
        )}
    </div>
  )
}

export function ImportCsv() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const s = usePractices()
  // The column being added as a practice; once saved, the review matches it.
  const [adding, setAdding] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('file')
  const [picked, setPicked] = useState<Picked | null>(null)
  // Read against the practices as they are now: they may load after the file is picked.
  const chosen: Chosen | null = picked && { file: picked.file, csv: readCsv(picked.text, s.practices) }
  const [readFailed, setReadFailed] = useState(false)
  const [errors, setErrors] = useState<ReturnType<typeof toDays>['errors']>([])
  const [done, setDone] = useState(0)

  // All or nothing: every row is read before anything is saved.
  const save = useMutation({
    mutationFn: async (days: Day[]) => {
      setDone(0)
      await Promise.all(days.map((d) => practicesApi.saveDiaryDay(d.date, d.entries).then(() => setDone((n) => n + 1))))
    },
    onSuccess: () => { void queryClient.invalidateQueries(); setStep('result') },
  })

  async function pick(file: File | undefined) {
    if (!file) return
    setReadFailed(false)
    try {
      setPicked({ file, text: await file.text() })
      // Picking again from the result starts over at the review.
      if (step === 'result') { setErrors([]); save.reset(); setStep('review') }
    } catch {
      setReadFailed(true)
    }
  }

  function startImport() {
    if (!chosen) return
    const { days, errors } = toDays(chosen.csv)
    setErrors(errors)
    if (errors.length) setStep('result')
    else save.mutate(days)
  }

  const rows = chosen?.csv.rows.length ?? 0
  const matched = chosen?.csv.columns.some((c) => c.type)
  const failed = step === 'result' && errors.length > 0
  const toFile = () => { save.reset(); setStep('file') }
  const back = step === 'review' || failed ? { label: t('import.step.file'), onClick: toFile } : undefined

  const footer = step === 'file'
    ? <button type="button" className={PRIMARY} disabled={!chosen} onClick={() => setStep('review')}>{t('import.reviewColumns')}</button>
    : step === 'review'
      ? <>
          {!matched && <p className="text-center text-[13px] text-ui-muted">{t('import.nothingYet')}</p>}
          <button type="button" className={PRIMARY} disabled={!matched || save.isPending} onClick={startImport}>
            {save.isPending
              ? <><span aria-hidden className={SPINNER} />{t('import.importing', { count: rows })}</>
              : matched ? t('import.importRows', { count: rows }) : t('import.import')}
          </button>
        </>
      : failed
        ? <label htmlFor={INPUT_ID} className={`${PRIMARY} cursor-pointer`}>{t('import.chooseAnother')}</label>
        : <Link to="/settings" className={PRIMARY}>{t('import.backToSettings')}</Link>

  return (
    <SettingsDetail title={t('settings.importCsv')} back={back} footer={footer}
      subtitle={step === 'file' ? t('import.subtitle') : undefined}>
      <input id={INPUT_ID} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1}
        onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      <Stepper step={step} failed={failed} />
      {step === 'file' && (
        <>
          <Rules />
          <Picker chosen={chosen} onFile={(f) => void pick(f)} />
          {readFailed && <ErrorBanner title={t('import.readFailed')} text={t('import.readFailedHint')} />}
        </>
      )}
      {step === 'review' && chosen && (
        <>
          {save.isPending && (
            <div role="status" className="flex flex-col gap-2 rounded-[14px] border border-ui-accent-pill bg-ui-accent-soft px-4 py-3">
              <p className="text-sm font-extrabold text-ui-ink">{t('import.importing', { count: rows })}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-ui-surface">
                <div className="h-full rounded-full bg-ui-accent-fill transition-[width]" style={{ width: `${rows ? (done / rows) * 100 : 0}%` }} />
              </div>
              <p className="text-[13px] text-ui-ink2">{t('import.keepOpen')}</p>
            </div>
          )}
          {save.isError && <ErrorBanner title={t('import.saveFailed')} text={t('import.saveFailedHint')} />}
          <Review chosen={chosen} busy={save.isPending} onChange={toFile} onAdd={setAdding} />
          {adding !== null && (
            <PracticeSheet name={adding} others={s.practices} busy={s.create.isPending} onClose={() => setAdding(null)}
              onSave={async (d) => { await s.create.mutateAsync(d); setAdding(null) }} />
          )}
        </>
      )}
      {failed && (
        <>
          <ErrorBanner title={t('import.nothingImported')} text={t('import.rowsFailed', { count: errors.length })} />
          <ul className={LIST}>
            {errors.map(({ line, error }) => (
              <li key={line} className="flex flex-col gap-0.5 bg-ui-surface px-3.5 py-2.5 font-ui-mono">
                <span className="text-xs font-bold text-ui-danger">{t('import.line', { n: line })}</span>
                <span className="text-[13px] break-words text-ui-ink">{describe(t, error)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {step === 'result' && !failed && (
        <div role="status" className={`${CARD} flex flex-col items-center gap-2 px-6 py-8 text-center`}>
          <span aria-hidden className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-ui-good text-2xl text-white">✓</span>
          <h2 className="text-xl font-extrabold text-ui-ink">{t('import.imported', { count: rows })}</h2>
          <p className="text-sm leading-normal text-ui-ink2">{t('import.importedHint')}</p>
        </div>
      )}
    </SettingsDetail>
  )
}
