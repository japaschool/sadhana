import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CARD, HINT } from '../../yatras/settings/mobile/AdminPage'
import { LimitField } from '../../insights/panels/TemplateForm'
import { typeLabelKey } from '../../yatras/settings/mobile/TypeChip'
import { JAPA_SLOTS } from '../../insights/panels/templates'
import { scaleVariants } from '../guideLogic'
import { Chip, FitList, PracticeRow, RowList, Section } from './PracticeRow'
import type { Setup } from './useSetup'

const SUGGESTIONS = [1, 2, 3, 4]

function ScaleField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <input aria-label={label} value={value ?? ''} inputMode="numeric" autoComplete="off" maxLength={3}
      onChange={(e) => { const n = e.target.value.replace(/\D/g, ''); onChange(n ? Number(n) : null) }}
      className="h-11 w-[52px] rounded-[10px] border border-ui-control bg-ui-surface text-center font-ui-mono text-[15px] font-semibold outline-none focus:border-2 focus:border-ui-accent-fill" />
  )
}

/** One count, a required daily target that starts empty, and two optional extras that start unticked. */
export function SetupCount({ setup }: { setup: Setup<'count'> }) {
  const { t } = useTranslation()
  const { value: v, set, check, fitting } = setup
  // Once the row is there it stays, even if its name is cleared while typing.
  const [own, setOwn] = useState(false)
  // A new key for each "+ Name your own", so a row already showing a suggestion starts over as an open field.
  const [ownTap, setOwnTap] = useState(0)
  const mine = fitting(JAPA_SLOTS[0])
  const early = t('templateForm.morning')
  const how = t('templateForm.quality')
  // A practice of the person's own already has its options.
  const newHow = !check(v.how ?? how, JAPA_SLOTS[2]).existing
  const scaled = newHow && !!scaleVariants(v.scaleFrom, v.scaleTo)
  return (
    <>
      {mine.length > 0 && (
        <Section title={t('guide.setup.fit')} tag={t(typeLabelKey('Int'))}>
          <FitList options={mine} isOn={(n) => v.count === n}
            onUse={(n, on) => set({ count: on ? n : '' })} />
        </Section>
      )}
      <Section title={t(mine.length ? 'guide.setup.startNew' : 'guide.setup.whatCount')}>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((n) => {
            const name = t(`guide.suggest.count${n}`)
            return <Chip key={n} on={v.count === name} note={check(name, JAPA_SLOTS[0]).existing ? t('guide.setup.tracked') : undefined} onClick={() => { setOwn(true); set({ count: name }) }}>{name}</Chip>
          })}
          <Chip dashed onClick={() => { setOwn(true); setOwnTap((n) => n + 1); set({ count: '' }) }}>{t('guide.setup.ownName')}</Chip>
        </div>
        {(v.count || own) && (
          <RowList>
            <PracticeRow key={ownTap} name={v.count} label={t('templateForm.total')} type="Int" note={t('guide.setup.countNote')} startEditing={!v.count} vanish fit={{ options: mine, fallback: '', elsewhere: true }}
              onRename={(count) => set({ count })} check={check(v.count, JAPA_SLOTS[0])} />
          </RowList>
        )}
      </Section>
      <Section title={t('templateForm.target')} tag={t('templateForm.required')} accent>
        <div className={`${CARD} flex flex-col gap-3 p-4`}>
          <LimitField id="setup-target" label={t('guide.setup.targetLabel')} placeholder={t('guide.setup.enterNumber')} suffix={t('templateForm.targetSuffix')}
            value={v.target} onChange={(target) => set({ target })} />
          <p className={HINT}>{t('guide.setup.targetHint')}</p>
        </div>
      </Section>
      <Section title={t('guide.setup.optionalGroup')}>
        <RowList>
          <PracticeRow name={v.early ?? early} label={early} type="Int" note={t('guide.setup.earlyNote')}
            tick={{ on: v.early !== null, onChange: (on) => set({ early: on ? early : null }) }}
            onRename={(e) => set({ early: e })} check={v.early === null ? undefined : check(v.early, JAPA_SLOTS[1])} fit={{ options: fitting(JAPA_SLOTS[1]), fallback: early }} />
          <PracticeRow name={v.how ?? how} label={how} type="Text" note={scaled ? t('guide.setup.howNote', { from: v.scaleFrom, to: v.scaleTo }) : t('guide.setup.howNotePlain')}
            tick={{ on: v.how !== null, onChange: (on) => set({ how: on ? how : null }) }}
            onRename={(h) => set({ how: h })} check={v.how === null ? undefined : check(v.how, JAPA_SLOTS[2])} fit={{ options: fitting(JAPA_SLOTS[2]), fallback: how }}>
            {newHow && (
              <div className="mt-1.5 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold text-ui-ink2">{t('guide.setup.scaleLabel')}</span>
                  <ScaleField label={t('guide.setup.scaleFrom')} value={v.scaleFrom} onChange={(scaleFrom) => set({ scaleFrom })} />
                  <span className="text-[13px] text-ui-muted">{t('guide.setup.scaleSep')}</span>
                  <ScaleField label={t('guide.setup.scaleTo')} value={v.scaleTo} onChange={(scaleTo) => set({ scaleTo })} />
                </div>
                {scaled
                  ? <span className="text-xs leading-snug text-ui-muted">{t('guide.setup.scaleHint')}</span>
                  : <span role="alert" className="text-xs leading-snug font-semibold text-ui-danger">{t('guide.setup.scaleWrong')}</span>}
              </div>
            )}
          </PracticeRow>
        </RowList>
      </Section>
    </>
  )
}
