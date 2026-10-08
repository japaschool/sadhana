import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import type { YatraUserPracticeItem } from '../../../../types/api'
import type { PickerGroups } from '../linking'
import { TypeIcon, typeLabelKey } from './TypeChip'

const ROW = 'flex min-h-[54px] w-full items-center gap-2.5 bg-ui-surface px-3.5 py-2 text-left'

function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {label && <h3 className="px-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">{label}</h3>}
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-ui-hairline bg-ui-hairline">{children}</div>
    </section>
  )
}

function Line({ title, hint, muted }: { title: string; hint?: string; muted?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={`truncate text-[15px] font-bold ${muted ? 'text-ui-faint2' : 'text-ui-ink'}`}>{title}</span>
      {hint && <span className="text-xs font-medium text-ui-muted">{hint}</span>}
    </span>
  )
}

export function LinkPickerSheet({ item, groups, onPick, onClose }: {
  item: YatraUserPracticeItem; groups: PickerGroups; onPick: (name: string | null) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const y = item.yatra_practice
  const typeName = (type: typeof y.data_type) => t(typeLabelKey(type))
  const pick = (name: string | null) => { onPick(name); onClose() }
  const choices = [
    ...(groups.current ? [{ p: groups.current, current: true }] : []),
    ...groups.compatible.map((p) => ({ p, current: false })),
  ]

  return (
    <BottomSheet label={t('yatraSettings.pickerTitle', { name: y.practice })} onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-extrabold text-ui-ink">{t('yatraSettings.pickerTitle', { name: y.practice })}</h2>
          <p className="text-sm text-ui-muted">{t('yatraSettings.pickerOnly', { type: typeName(y.data_type) })}</p>
        </div>
        <button type="button" aria-label={t('yatraSettings.close')} onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-chip text-lg text-ui-ink">×</button>
      </div>

      {groups.suggested && (
        <Group label={t('yatraSettings.groupSuggested')}>
          <button type="button" onClick={() => pick(groups.suggested!.practice)} className={ROW}>
            <TypeIcon type={y.data_type} /><Line title={groups.suggested.practice} hint={typeName(y.data_type)} />
          </button>
        </Group>
      )}
      {choices.length > 0 && (
        <Group label={t('yatraSettings.groupOther', { type: typeName(y.data_type) })}>
          {choices.map(({ p, current }) => (
            <button key={p.id} type="button" onClick={() => pick(p.practice)} className={ROW}>
              <TypeIcon type={y.data_type} /><Line title={p.practice} />
              {current && <span className="text-xs font-extrabold text-ui-good">✓ {t('yatraSettings.current')}</span>}
            </button>
          ))}
        </Group>
      )}
      <Group>
        <button type="button" onClick={() => pick(null)} className={ROW}>
          <Line title={t('yatraSettings.dontLink')} hint={t('yatraSettings.dontLinkHint')} />
        </button>
      </Group>
      {groups.linkedElsewhere.length > 0 && (
        <Group label={t('yatraSettings.groupLinkedHere')}>
          {groups.linkedElsewhere.map(({ practice, linkedTo }) => (
            <div key={practice.id} className={ROW}>
              <TypeIcon type={y.data_type} />
              <Line title={practice.practice} hint={t('yatraSettings.linkedTo', { name: linkedTo.practice })} />
              <button type="button" onClick={() => pick(practice.practice)}
                className="h-9 shrink-0 rounded-[10px] border border-ui-control px-3 text-[13px] font-extrabold text-ui-ink">
                {t('yatraSettings.moveHere')}
              </button>
            </div>
          ))}
        </Group>
      )}
      {groups.cantLink.length > 0 && (
        <Group label={t('yatraSettings.groupCant')}>
          {groups.cantLink.map(({ practice, reason }) => (
            <div key={practice.id} aria-disabled className={ROW}>
              <TypeIcon type={practice.data_type} />
              <Line muted title={practice.practice}
                hint={reason === 'inactive'
                  ? t('yatraSettings.inactive')
                  : t('yatraSettings.needsType', { has: typeName(practice.data_type), needs: typeName(y.data_type) })} />
            </div>
          ))}
        </Group>
      )}
      {(y.data_type === 'Time' || y.data_type === 'Duration') && (
        <section className="flex flex-col gap-2 rounded-2xl bg-ui-field p-3.5">
          <h3 className="text-[13px] font-extrabold text-ui-ink">{t('yatraSettings.timeOrDuration')}</h3>
          <p className="flex items-center gap-2 text-[13px] text-ui-ink2">
            <TypeIcon type="Time" /><b>{t('yatraSettings.typeTime')}</b>
            <span className="font-ui-mono">05:30</span><span className="text-ui-muted">{t('yatraSettings.timeHint')}</span>
          </p>
          <p className="flex items-center gap-2 text-[13px] text-ui-ink2">
            <TypeIcon type="Duration" /><b>{t('yatraSettings.typeDuration')}</b>
            <span className="font-ui-mono">1:30</span><span className="text-ui-muted">{t('yatraSettings.durationHint')}</span>
          </p>
        </section>
      )}
    </BottomSheet>
  )
}
