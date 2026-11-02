import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CARD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { LimitField } from '../../insights/panels/TemplateForm'
import type { Slot } from '../../insights/panels/templates'
import { Chip, FitList, PracticeRow, RowList, Section } from './PracticeRow'
import type { Setup } from './useSetup'

/**
 * Time spent and Days I did it: one or more practices, picked from suggestions or named, up to the report's limit.
 * Time spent adds a daily goal.
 */
export function SetupNames({ setup, slot, suggestions, max }: { setup: Setup<'time'> | Setup<'days'>; slot: Slot; suggestions: string[]; max: number }) {
  const { t } = useTranslation()
  const { value: v, set, check, fitting } = setup
  // Names taken from the person's own list: their rows aren't asked whether to use them.
  const [picked, setPicked] = useState<string[]>([])
  const mine = fitting(slot)
  const time = setup.kind === 'time'
  const full = v.names.length >= max
  const set_ = (names: string[]) => set({ names } as never)
  return (
    <>
      {mine.length > 0 && (
        <Section title={t('guide.setup.fit')}>
          <FitList options={mine} isOn={(n) => picked.includes(n) && v.names.includes(n)} disabled={full}
            onUse={(n, on) => { setPicked(on ? [...picked, n] : picked.filter((x) => x !== n)); set_(on ? [...v.names.filter((x) => x !== n), n] : v.names.filter((x) => x !== n)) }} />
        </Section>
      )}
      <Section title={t(mine.length ? 'guide.setup.startNew' : time ? 'guide.setup.whatTime' : 'guide.setup.whatDays')} tag={t('guide.setup.oneOrMore')}>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((name) => {
            const on = v.names.includes(name)
            return <Chip key={name} on={on} note={check(name, slot).have?.is_active ? t('guide.setup.tracked') : undefined} disabled={!on && full} onClick={() => set_(on ? v.names.filter((n) => n !== name) : [...v.names, name])}>{name}</Chip>
          })}
          <Chip dashed disabled={full} onClick={() => set_([...v.names, ''])}>{t('guide.setup.ownName')}</Chip>
        </div>
        {full && <p className={HINT}>{t('templateForm.tooMany', { count: max })}</p>}
        {v.names.length > 0 && (
          <RowList>
            {v.names.map((name, i) => (
              <PracticeRow key={i} name={name} label={name} type={slot.types[0]} startEditing={!name} picked={picked.includes(name)}
                note={suggestions.includes(name) || picked.includes(name) ? undefined : t('guide.setup.ownType', { type: t(`yatraSettings.type${slot.types[0]}`) })}
                onRename={(n) => set_(v.names.map((x, j) => (j === i ? n : x)))}
                onRemove={() => set_(v.names.filter((_, j) => j !== i))} check={check(name, slot)} />
            ))}
          </RowList>
        )}
      </Section>
      {setup.kind === 'time' && (
        <Section title={t('templateForm.dailyGoal')} tag={t('templateForm.optional')}>
          <div className={`${CARD} flex flex-col gap-2 p-4`}>
            <LimitField id="setup-goal" label={t('guide.setup.goalLabel')} placeholder={t('templateForm.noGoal')} value={setup.value.goal} onChange={(goal) => setup.set({ goal })} />
            <p className={HINT}>{t('guide.setup.goalHint')}</p>
          </div>
        </Section>
      )}
      {!time && <p className={HINT}>{t('guide.setup.daysHint')}</p>}
    </>
  )
}
