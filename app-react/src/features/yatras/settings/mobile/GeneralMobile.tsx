import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ListGroup } from '../../../../ui/primitives/ListGroup'
import { Toggle } from '../../../../ui/primitives/Toggle'
import { useYatraAdmin } from '../useYatraAdmin'
import { isScored } from '../zones'
import { AdminPage, CARD, HINT } from './AdminPage'
import { AutosaveText } from './fields'
import { scoreSummary } from './summaries'
import { TypeIcon } from './TypeChip'

export function GeneralMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const a = useYatraAdmin(id)
  return (
    <AdminPage admin={a} title={t('yatraSettings.general')}>
      {() => {
        const y = a.yatra!
        const scored = a.practices.filter((p) => isScored(p.data_type))
        const withScore = scored.filter((p) => scoreSummary(p, t)).length
        return (
          <>
            <section className={`${CARD} p-4`}>
              <AutosaveText id="yatra-name" label={t('yatraSettings.yatraName')} hint={t('yatraSettings.yatraNameHint')} value={y.name}
                validate={(v) => (v.trim() ? null : t('yatraSettings.nameEmpty'))}
                onCommit={(v) => a.saveYatra({ name: v.trim() }, t('yatraSettings.renamed'))} />
            </section>
            <section className={`${CARD} flex items-start gap-3 p-4`}>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] font-bold text-ui-ink">{t('yatraSettings.metrics')}</span>
                <span className={HINT}>{t('yatraSettings.metricsHint')}</span>
              </div>
              <Toggle checked={y.show_stability_metrics} label={t('yatraSettings.metrics')}
                onChange={(v) => a.saveYatra({ show_stability_metrics: v }, t(v ? 'yatraSettings.metricsOn' : 'yatraSettings.metricsOff'))} />
            </section>
            {scored.length > 0 && (
              <div className="flex flex-col gap-2">
                <ListGroup label={t('yatraSettings.thresholdsCount', { k: withScore, count: scored.length })}>
                  {scored.map((p) => {
                    const s = scoreSummary(p, t)
                    return (
                      <Link key={p.id} to={`/yatra/${id}/practice/${p.id}/edit`} className="flex min-h-[52px] items-center gap-3 bg-ui-surface px-4 py-2">
                        <TypeIcon type={p.data_type} />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ui-ink">{p.practice}</span>
                        {s
                          ? <span className="shrink-0 font-ui-mono text-[13px] text-ui-muted">{s}</span>
                          : <span className="shrink-0 text-[13px] font-bold text-ui-accent">{t('yatraSettings.setThreshold')}</span>}
                      </Link>
                    )
                  })}
                </ListGroup>
                <p className={`${HINT} px-1.5`}>{t('yatraSettings.thresholdsNote')}</p>
              </div>
            )}
          </>
        )
      }}
    </AdminPage>
  )
}
