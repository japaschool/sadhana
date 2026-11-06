import { useTranslation } from 'react-i18next'
import { typeLabelKey } from '../../yatras/settings/mobile/TypeChip'
import { GoalCard } from '../../insights/panels/TemplateForm'
import { GOAL_SLOT, MAX_GOALS } from '../../insights/panels/templates'
import type { GuideGoal } from '../guideLogic'
import { Chip, FitList, PracticeRow, RowList, Section } from './PracticeRow'
import type { Setup } from './useSetup'

const DAYS = [1, 2, 3, 4, 5]
const unit = (g: Pick<GuideGoal, 'type' | 'counts'>) => (g.type === 'Duration' ? g.counts : 'count')

/**
 * Goals on practices by name: the person's, ones planned before this, suggestions or their own (a new yes/no one).
 * Each goal is the editor's card, with the name in place of its picker.
 */
export function SetupGoals({ setup }: { setup: Setup<'goals'> }) {
  const { t } = useTranslation()
  const { value: v, set, check, fitting, usable, typeOf } = setup
  const mine = fitting(GOAL_SLOT)
  const planned = usable(GOAL_SLOT).filter((n) => !mine.some((p) => p.practice === n))
  const suggestions = [...planned, ...DAYS.map((n) => t(`guide.suggest.days${n}`)).filter((n) => !planned.includes(n))]
  const full = v.goals.length >= MAX_GOALS
  const has = (name: string) => v.goals.some((g) => g.name === name)
  const goals = (list: GuideGoal[]) => set({ goals: list })
  const add = (name: string): GuideGoal => ({ name, type: typeOf(name), direction: 'AtLeast', amount: null, period: 'Week', counts: 'Total' })
  const toggle = (name: string, on: boolean) => goals(on ? [...v.goals.filter((g) => g.name !== name), add(name)] : v.goals.filter((g) => g.name !== name))
  // A new name may be another type: an amount in another unit would mean something else, so it starts over.
  const rename = (g: GuideGoal, name: string): GuideGoal => {
    const next = { ...g, name, type: typeOf(name) }
    if (next.type !== 'Duration') next.counts = 'Total'
    return unit(next) === unit(g) ? next : { ...next, amount: null }
  }
  return (
    <>
      {mine.length > 0 && (
        <Section title={t('guide.setup.fit')}>
          <FitList options={mine} isOn={has} disabled={full} onUse={toggle} />
        </Section>
      )}
      <Section title={t(mine.length ? 'guide.setup.startNew' : 'guide.setup.whatGoals')} tag={t('guide.setup.oneOrMore')}>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((name) => {
            const on = has(name)
            return <Chip key={name} on={on} disabled={!on && full} onClick={() => toggle(name, !on)}>{name}</Chip>
          })}
          <Chip dashed disabled={full} onClick={() => goals([...v.goals, add('')])}>{t('guide.setup.ownName')}</Chip>
        </div>
      </Section>
      {v.goals.map((g, i) => (
        // ponytail: index keys, as in the editor's goal list.
        <GoalCard key={i} n={i + 1} goal={{ ...g, practice: g.name }} practices={[{ id: g.name, practice: g.name, data_type: g.type, is_active: true }]}
          onChange={({ direction, amount, period, counts }) => goals(v.goals.map((x, j) => (j === i ? { ...x, direction, amount, period, counts } : x)))}
          onRemove={() => goals(v.goals.filter((_, j) => j !== i))}
          field={(
            <RowList>
              <PracticeRow name={g.name} label={g.name || t('guide.setup.nameField')} type={g.type} startEditing={!g.name} fit={{ options: mine, fallback: '', elsewhere: true }}
                note={mine.some((p) => p.practice === g.name) || planned.includes(g.name) ? t(typeLabelKey(g.type)) : t('guide.setup.ownType', { type: t(`yatraSettings.type${g.type}`) })}
                onRename={(name) => goals(v.goals.map((x, j) => (j === i ? rename(x, name) : x)))} check={check(g.name, GOAL_SLOT)} />
            </RowList>
          )} />
      ))}
    </>
  )
}
