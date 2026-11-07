import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLayout } from '../../layouts/useLayout'
import { useShellBackground } from '../../layouts/useShellBackground'
import type { Guide } from './useGuide'

const EXIT = 'min-h-11 px-2.5 text-right text-sm font-semibold text-ui-muted underline decoration-ui-faint decoration-1 underline-offset-4'

function Chevron() {
  return <span aria-hidden className="h-2.5 w-2.5 rotate-45 border-b-2 border-l-2 border-current" />
}

/** The guide's page: the top bar on a phone; on tablet and desktop the header with the stepper, and the footer a step supplies. */
/** `fill`: on a phone, exactly one screen tall, so a child with flex-1 takes the height left and the page doesn't scroll. */
export function GuideFrame({ guide, footer, fill = false, children }: { guide: Guide; footer?: ReactNode; fill?: boolean; children: ReactNode }) {
  const { t } = useTranslation()
  const mobile = useLayout() === 'mobile'
  const root = useRef<HTMLDivElement>(null)
  useShellBackground(root)
  const steps = guide.firstRun ? ['choose', 'setup', 'sharing', 'finish'] : ['choose', 'setup', 'finish']
  const at = { choose: 'choose', setup: 'setup', reader: 'sharing', finish: 'finish' }[guide.step.at]
  const cur = steps.indexOf(at)
  const exit = guide.creating ? <span className="w-11" /> : <button type="button" onClick={guide.leave} className={EXIT}>{t(guide.exitKey)}</button>
  const back = guide.canBack && (
    <button type="button" onClick={guide.back} className="flex min-h-11 items-center gap-1.5 px-2 text-[15px] font-bold text-ui-accent">
      <Chevron />{t('guide.back')}
    </button>
  )

  if (mobile) {
    return (
      <div ref={root} className={`ui-root bg-ui-bg text-ui-ink ${fill ? 'flex h-dvh flex-col overflow-hidden' : 'min-h-dvh pb-8'}`}>
        <div className="flex min-h-[50px] items-center justify-between gap-2 pt-1.5 pr-3 pl-2">{back || <span className="w-11" />}{exit}</div>
        {children}
      </div>
    )
  }
  return (
    <div ref={root} className="ui-root flex min-h-dvh flex-col bg-ui-bg text-ui-ink">
      <header className="flex items-center justify-between gap-4 border-b border-ui-hairline px-8 py-5 lg:px-16">
        <span role="img" aria-label="Sadhana Pro" className="h-10 w-10 shrink-0 bg-ui-accent [mask:url(/logo.png)_center/contain_no-repeat] xl:h-12 xl:w-12" />
        <ol className="flex items-center gap-2" aria-label={t('guide.steps.label')}>
          {steps.map((s, i) => (
            <li key={s} aria-current={i === cur ? 'step' : undefined}
              className={`flex items-center gap-2 text-[13px] ${i === cur ? 'font-extrabold' : 'font-semibold'} ${i > cur ? 'text-ui-faint2' : ''}`}>
              {i > 0 && <span aria-hidden className="h-[1.5px] w-3.5 bg-ui-control" />}
              <span aria-hidden className={`flex h-[22px] w-[22px] items-center justify-center rounded-full font-ui-mono text-[11px] font-semibold ${i < cur ? 'bg-ui-accent-fill' : i === cur ? 'bg-ui-selected text-ui-on-selected' : 'border-[1.5px] border-ui-faint'}`}>{i + 1}</span>
              {t(`guide.steps.${s}`)}
            </li>
          ))}
        </ol>
        {exit}
      </header>
      <main className="flex-1 px-8 py-8 lg:px-16">{children}</main>
      {footer && <footer className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-ui-hairline bg-ui-tabbar px-8 py-4 lg:px-16">{footer}</footer>}
    </div>
  )
}
