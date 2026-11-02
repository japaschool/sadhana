import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../api/charts'
import { practicesApi } from '../../api/practices'
import { PrimaryButton, SecondaryButton } from '../auth/kit'
import { REPORTS_KEY } from '../insights/useReports'
import { shareUrl } from '../today/actions'
import { GuideFrame } from './GuideFrame'
import { buildPlan, itemsOf, KINDS, runPlan } from './guideLogic'
import type { GuideApi, GuideKind } from './guideLogic'
import type { Guide } from './useGuide'

const api: GuideApi = {
  getPractices: () => practicesApi.getUserPractices(),
  createPractice: (p) => practicesApi.createUserPractice({ practice: p.name, data_type: p.data_type, dropdown_variants: p.dropdown_variants }),
  getReports: () => chartsApi.getReports(),
  createReport: (name, d) => chartsApi.createReport(name, d),
}

type Row = 'pending' | 'working' | 'done'

/** Creates the practices and reports, then closes. Choices stay in the guide, so a failure can be retried or reviewed. */
export function FinishStep({ guide }: { guide: Guide }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { chosen, plan, creating, setCreating } = guide
  const kinds = KINDS.filter((k) => chosen[k])
  const [rows, setRows] = useState<Partial<Record<GuideKind, Row>>>({})
  const [failure, setFailure] = useState<'connection' | 'names' | null>(null)
  const [copied, setCopied] = useState(false)
  const started = useRef(false)

  /** `rebuild`: back at Finish after a failure, so choices may have changed. A plain retry keeps the plan. */
  async function run(rebuild: boolean) {
    setFailure(null)
    setCreating('running')
    setRows({})
    try {
      if (!plan.current || rebuild) {
        // Read fresh: the cache is persisted and can be stale. Reports an earlier attempt planned keep their names, not "Sleep 2".
        const prev = plan.current
        const [practices, reports] = await Promise.all([api.getPractices(), api.getReports()])
        const taken = new Set(prev?.reports.map((r) => r.name))
        const built = buildPlan(chosen, practices, reports.filter((r) => !taken.has(r.name)), (slug) => t(`templateForm.${slug}Name`))
        for (const r of built.reports) r.name = prev?.reports.find((o) => o.kind === r.kind)?.name ?? r.name
        plan.current = built
      }
      await runPlan(plan.current, api, (kind, state) => setRows((r) => ({ ...r, [kind]: state })))
      void qc.invalidateQueries({ queryKey: ['practices'] })
      void qc.invalidateQueries({ queryKey: REPORTS_KEY })
      setCreating('done')
    } catch (e) {
      setFailure(isAxiosError(e) ? 'connection' : 'names')
      setCreating(null)
    }
  }
  useEffect(() => {
    if (started.current) return
    started.current = true
    void run(plan.current !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arriving at Finish
  }, [])

  const done = creating === 'done'
  const wide = !guide.carousel
  const names = (k: GuideKind) => itemsOf(k, chosen[k]!).map((it) => it.name)
  const practices = new Set(kinds.flatMap(names)).size
  const link = guide.reader ? shareUrl() : null
  const rowNote = (k: GuideKind) => {
    const s = rows[k]
    return s === 'done' ? t('guide.finish.created') : s === 'working' && !failure ? t('guide.finish.working') : failure ? t('guide.finish.notSaved') : t('guide.finish.waiting')
  }

  const list = (
    <ul className="flex flex-col divide-y divide-ui-hairline overflow-hidden rounded-[18px] border border-ui-card-border bg-ui-card">
      {kinds.map((k) => (
        <li key={k} className="flex min-h-14 items-start gap-3 px-3.5 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-extrabold">{t(`guide.kinds.${k}.name`)}</span>
            <span className="text-[13px] leading-snug text-ui-ink2">{names(k).join(', ')}</span>
            {done && (
              <span className="text-xs leading-snug text-ui-muted text-pretty">
                <b className="text-ui-accent">{t(k === 'sleep' ? 'guide.finish.second' : 'guide.finish.first')} · </b>{t(`guide.finish.note.${k}`)}
              </span>
            )}
          </div>
          {!done && <span className={`text-xs font-bold ${rows[k] === 'done' ? 'text-ui-accent' : 'text-ui-muted'}`}>{rowNote(k)}</span>}
        </li>
      ))}
    </ul>
  )

  let body
  if (done) {
    body = (
      <>
        <h1 className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em]">{t('guide.finish.title')}</h1>
        <p className="text-sm leading-normal text-ui-muted">{t('guide.finish.summary', { reports: kinds.length, practices })}</p>
        {list}
        {link && (
          <div className="flex flex-col gap-2.5 rounded-[18px] border border-ui-card-border bg-ui-card p-[18px]">
            <span className="text-base font-extrabold">{t('guide.finish.linkTitle')}</span>
            <div className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-ui-control bg-ui-surface py-1 pr-1.5 pl-3.5">
              <span className="min-w-0 font-ui-mono text-sm [overflow-wrap:anywhere]">{link}</span>
              <button type="button" className="min-h-10 shrink-0 rounded-[10px] bg-ui-tint px-3.5 text-[13px] font-extrabold text-ui-accent"
                onClick={() => { void navigator.clipboard.writeText(link); setCopied(true) }}>
                {t(copied ? 'guide.finish.copied' : 'guide.finish.copy')}
              </button>
            </div>
            <span className="text-xs leading-snug text-ui-muted">{t('guide.finish.linkNote')}</span>
          </div>
        )}
        <PrimaryButton type="button" onClick={() => guide.finish(guide.reader ?? undefined)}>{t('guide.finish.start')}</PrimaryButton>
      </>
    )
  } else {
    body = (
      <>
        <h1 className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em]">{t(failure ? 'guide.finish.failTitle' : 'guide.finish.creatingTitle')}</h1>
        <p role={failure ? 'alert' : undefined} className="text-sm leading-normal text-ui-muted">
          {failure === 'names' ? t('guide.finish.failNames') : failure ? `${t('common.error')} ${t('guide.finish.failBody')}` : t('guide.finish.creatingBody')}
        </p>
        {list}
        {failure && (
          <div className="flex flex-col gap-2">
            {failure === 'connection' && <PrimaryButton type="button" onClick={() => void run(false)}>{t('guide.finish.retry')}</PrimaryButton>}
            <SecondaryButton onClick={guide.back}>{t('guide.finish.review')}</SecondaryButton>
          </div>
        )}
      </>
    )
  }
  return (
    <GuideFrame guide={guide}>
      <div className={`flex flex-col gap-4 ${wide ? 'max-w-3xl' : 'px-[22px] pt-1'}`}>{body}</div>
    </GuideFrame>
  )
}
