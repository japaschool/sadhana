import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HINT } from '../../yatras/settings/mobile/AdminPage'
import { typeLabelKey } from '../../yatras/settings/mobile/TypeChip'
import { GAPS_EVENT_SLOT, GAPS_ROWS_SLOT, MAX_ROWS } from '../../insights/panels/templates'
import { Chip, FitList, PracticeRow, RowList, Section } from './PracticeRow'
import type { Setup } from './useSetup'

const SUGGESTIONS = [1, 2, 3, 4]

/** One event, named like Daily count's count, and optional rows to compare on the days around it: practices there already or planned before this. */
export function SetupGaps({ setup }: { setup: Setup<'gaps'> }) {
  const { t } = useTranslation()
  const { value: v, set, check, fitting, usable, canSleep } = setup
  const [own, setOwn] = useState(false)
  const [ownTap, setOwnTap] = useState(0)
  const mine = fitting(GAPS_EVENT_SLOT)
  const rows = usable(GAPS_ROWS_SLOT)
  const full = v.rows.length + (v.sleep ? 1 : 0) >= MAX_ROWS
  return (
    <>
      {mine.length > 0 && (
        <Section title={t('guide.setup.fit')} tag={t(typeLabelKey('Bool'))}>
          <FitList options={mine} isOn={(n) => v.event === n} onUse={(n, on) => set({ event: on ? n : '' })} />
        </Section>
      )}
      <Section title={t(mine.length ? 'guide.setup.startNew' : 'guide.setup.whatEvent')}>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((n) => {
            const name = t(`guide.suggest.gaps${n}`)
            return <Chip key={n} on={v.event === name} note={check(name, GAPS_EVENT_SLOT).existing ? t('guide.setup.tracked') : undefined} onClick={() => { setOwn(true); set({ event: name }) }}>{name}</Chip>
          })}
          <Chip dashed onClick={() => { setOwn(true); setOwnTap((n) => n + 1); set({ event: '' }) }}>{t('guide.setup.ownName')}</Chip>
        </div>
        {(v.event || own) && (
          <RowList>
            <PracticeRow key={ownTap} name={v.event} label={t('templateForm.event')} type="Bool" note={t('guide.setup.eventNote')} startEditing={!v.event} vanish fit={{ options: mine, fallback: '', elsewhere: true }}
              onRename={(event) => set({ event })} check={check(v.event, GAPS_EVENT_SLOT)} />
          </RowList>
        )}
      </Section>
      <Section title={t('guide.setup.compare')} tag={t('templateForm.optional')}>
        {rows.length > 0 || canSleep ? (
          <div className="flex flex-wrap gap-2">
            {canSleep && <Chip on={v.sleep} disabled={!v.sleep && full} onClick={() => set({ sleep: !v.sleep })}>{t('templateForm.sleepCalculated')}</Chip>}
            {rows.map((name) => {
              const on = v.rows.includes(name)
              return <Chip key={name} on={on} disabled={!on && full} onClick={() => set({ rows: on ? v.rows.filter((n) => n !== name) : [...v.rows, name] })}>{name}</Chip>
            })}
          </div>
        ) : <p className={HINT}>{t('guide.setup.noCompare')}</p>}
        <p className={HINT}>{t('templateForm.compareHint')}</p>
      </Section>
    </>
  )
}
