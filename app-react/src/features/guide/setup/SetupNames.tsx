import { useTranslation } from 'react-i18next'
import { CARD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { typeLabelKey } from '../../yatras/settings/mobile/TypeChip'
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
  const mine = fitting(slot)
  const time = setup.kind === 'time'
  const full = v.names.length >= max
  const set_ = (names: string[]) => set({ names } as never)
  return (
    <>
      {mine.length > 0 && (
        <Section title={t('guide.setup.fit')} tag={t(typeLabelKey(slot.types[0]))}>
          <FitList options={mine} isOn={(n) => v.names.includes(n)} disabled={full}
            onUse={(n, on) => set_(on ? [...v.names.filter((x) => x !== n), n] : v.names.filter((x) => x !== n))} />
        </Section>
      )}
      <Section title={t(mine.length ? 'guide.setup.startNew' : time ? 'guide.setup.whatTime' : 'guide.setup.whatDays')} tag={t('guide.setup.oneOrMore')}>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((name) => {
            const on = v.names.includes(name)
            return <Chip key={name} on={on} note={check(name, slot).existing ? t('guide.setup.tracked') : undefined} disabled={!on && full} onClick={() => set_(on ? v.names.filter((n) => n !== name) : [...v.names, name])}>{name}</Chip>
          })}
          <Chip dashed disabled={full} onClick={() => set_([...v.names, ''])}>{t('guide.setup.ownName')}</Chip>
        </div>
        {full && <p className={HINT}>{t('templateForm.tooMany', { count: max })}</p>}
        {v.names.length > 0 && (
          <RowList>
            {v.names.map((name, i) => (
              <PracticeRow key={i} name={name} label={name || t('guide.setup.nameField')} type={slot.types[0]} startEditing={!name} vanish fit={{ options: mine, fallback: '', elsewhere: true }}
                note={suggestions.includes(name) ? undefined : t('guide.setup.ownType', { type: t(`yatraSettings.type${slot.types[0]}`) })}
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
