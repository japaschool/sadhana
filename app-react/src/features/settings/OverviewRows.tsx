import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { practicesApi } from '../../api/practices'
import { UiLoading } from '../../layouts/ByLayout'
import { Toggle } from '../../ui/primitives/Toggle'
import { rowName } from '../insights/overview/format'
import { useInsightPrefs } from '../insights/overview/prefs'
import { overviewRows, type OverviewRow } from '../insights/overview/series'
import { groupName } from '../practices/groups'
import { SettingsRow } from './mobile/SettingsRow'
import { ROWS, SettingsSubpage } from './SettingsSubpage'

/** /settings/overview-rows: which rows the Insights overview shows, per practice group. */
export function OverviewRows() {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useInsightPrefs()
  const practicesQ = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const groupsQ = useQuery({ queryKey: ['practice-groups'], queryFn: practicesApi.getGroups })
  if (practicesQ.isLoading || groupsQ.isLoading) return <UiLoading />
  const practices = practicesQ.data ?? []

  // Sleep has its own setting, so it isn't listed. A group's total comes first in its section.
  const sections: OverviewRow[][] = []
  for (const row of overviewRows(practices, groupsQ.data ?? [], null)) {
    const last = sections.at(-1)
    if (last?.[0].group === row.group) {
      if (row.special === 'total') last.unshift(row)
      else last.push(row)
    } else sections.push([row])
  }

  return (
    <SettingsSubpage title={t('insights.rows.title')} back={{ to: '/settings/charts', label: t('insights.title') }}>
      <p className="px-1 text-sm leading-[1.45] text-ui-muted">{t('insights.rows.intro')}</p>
      {sections.map((rows) => (
        <section key={rows[0].group.id ?? ''} className="flex flex-col gap-2">
          <h2 className="px-1 text-[15px] font-extrabold text-ui-ink">{groupName(rows[0].group, t)}</h2>
          <div className={ROWS}>
            {rows.map((row) => {
              const label = rowName(row, practices, t)
              return (
                <SettingsRow key={row.key} label={label}
                  control={<Toggle label={label} checked={prefs.visibility[row.key] ?? row.defaultVisible}
                    onChange={(on) => setPrefs({ visibility: { ...prefs.visibility, [row.key]: on } })} />} />
              )
            })}
          </div>
        </section>
      ))}
    </SettingsSubpage>
  )
}
