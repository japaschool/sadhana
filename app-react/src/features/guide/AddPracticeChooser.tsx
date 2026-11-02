import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../ui/primitives/BottomSheet'

const ROW = 'flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left'

/** "Add practice": Help me choose opens the guide, Add one myself the form. `back` is where the guide returns to. */
export function AddPracticeChooser({ onClose, back }: { onClose: () => void; back: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const rows = [
    { name: t('home.helpChoose'), sub: t('home.helpChooseDesc'), go: () => navigate('/guide', { state: { back } }) },
    { name: t('home.addOneMyself'), sub: t('home.addOneMyselfSub'), go: () => navigate('/settings/practices/new') },
  ]
  return (
    <BottomSheet label={t('home.addPractice')} onClose={onClose}>
      <h2 className="px-1 pb-3 text-xl font-extrabold text-ui-ink">{t('home.addPractice')}</h2>
      <div className="divide-y divide-ui-hairline overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-surface">
        {rows.map((r) => (
          <button key={r.name} type="button" onClick={() => { onClose(); r.go() }} className={ROW}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-extrabold text-ui-ink">{r.name}</span>
              <span className="text-[13px] leading-snug text-ui-muted">{r.sub}</span>
            </span>
            <span aria-hidden className="text-ui-faint">›</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
