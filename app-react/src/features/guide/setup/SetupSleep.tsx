import { useTranslation } from 'react-i18next'
import { CARD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { LimitField } from '../../insights/panels/TemplateForm'
import { SLEEP_SLOTS } from '../../insights/panels/templates'
import { PracticeRow, RowList, Section } from './PracticeRow'
import type { Setup } from './useSetup'

/** Bedtime and wake-up are needed; a nap is optional. The aim is a minimum and a maximum, each clearable. */
export function SetupSleep({ setup }: { setup: Setup<'sleep'> }) {
  const { t } = useTranslation()
  const { value: v, set, check } = setup
  const wrong = v.min !== null && v.max !== null && v.min > v.max
  return (
    <>
      <Section title={t('guide.setup.practices')} tag={t('guide.setup.renameHint')}>
        <RowList>
          <PracticeRow name={v.bedtime} type="Time" needed onRename={(bedtime) => set({ bedtime })} check={check(v.bedtime, SLEEP_SLOTS[0])} />
          <PracticeRow name={v.wake} type="Time" needed onRename={(wake) => set({ wake })} check={check(v.wake, SLEEP_SLOTS[1])} />
          <PracticeRow name={v.nap ?? t('reportPanels.nap')} label={t('reportPanels.nap')} type="Duration" note={t('guide.setup.napNote')}
            tick={{ on: v.nap !== null, onChange: (on) => set({ nap: on ? t('reportPanels.nap') : null }) }}
            onRename={(nap) => set({ nap })} check={v.nap === null ? undefined : check(v.nap, SLEEP_SLOTS[2])} />
        </RowList>
      </Section>
      <Section title={t('guide.setup.sleepAim')} tag={t('templateForm.optional')}>
        <div className={`${CARD} flex flex-col gap-4 p-4`}>
          <div className="grid grid-cols-2 gap-2.5">
            <LimitField id="setup-min" label={t('guide.setup.atLeast')} placeholder={t('templateForm.noMin')} value={v.min} onChange={(min) => set({ min })} />
            <LimitField id="setup-max" label={t('guide.setup.atMost')} placeholder={t('templateForm.noMax')} value={v.max} onChange={(max) => set({ max })} />
          </div>
          {wrong && <p role="alert" className="text-[13px] font-semibold text-ui-danger">{t('templateForm.minMax')}</p>}
          <p className={HINT}>{t('guide.setup.aimHint')}</p>
        </div>
      </Section>
    </>
  )
}
