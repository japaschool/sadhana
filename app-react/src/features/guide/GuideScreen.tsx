import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { ByLayout } from '../../layouts/ByLayout'
import { BottomSheet } from '../../ui/primitives/BottomSheet'
import { PrimaryButton, SecondaryButton } from '../auth/kit'
import { GuideFrame } from './GuideFrame'
import { ChooseMobile } from './mobile/ChooseMobile'
import { useGuide } from './useGuide'
import type { Guide } from './useGuide'
import { ChooseWide } from './wide/ChooseWide'

/** ponytail: Tasks 11 and 12 replace these three with the setup, reader and finish screens. */
function Placeholder({ guide, title, action, onAction }: { guide: Guide; title: string; action: string; onAction: () => void }) {
  return (
    <GuideFrame guide={guide}>
      <div className="flex flex-col gap-4 px-[22px] py-4">
        <h1 className="text-[26px] font-extrabold">{title}</h1>
        <PrimaryButton type="button" onClick={onAction}>{action}</PrimaryButton>
      </div>
    </GuideFrame>
  )
}

/** /guide. Opened by sign-up (state.firstRun) or from the app (no state): the latter has no reader question. */
export function GuideScreen() {
  const { t } = useTranslation()
  const state = useLocation().state as { firstRun?: boolean; back?: string } | null
  const guide = useGuide({ firstRun: state?.firstRun === true, back: state?.back ?? '/' })
  const { step } = guide

  return (
    <>
      {step.at === 'choose' && <ByLayout mobile={<ChooseMobile guide={guide} />} tablet={<ChooseWide guide={guide} />} desktop={<ChooseWide guide={guide} />} />}
      {step.at === 'setup' && <Placeholder guide={guide} title={t(`guide.kinds.${step.kind}.name`)} action={t('guide.next')} onAction={guide.next} />}
      {step.at === 'reader' && <Placeholder guide={guide} title={t('guide.steps.sharing')} action={t('guide.next')} onAction={guide.next} />}
      {step.at === 'finish' && <Placeholder guide={guide} title={t('guide.steps.finish')} action={t('guide.done')} onAction={() => guide.finish()} />}
      {guide.confirming && (
        <BottomSheet label={t('guide.leave.title')} onClose={guide.keepGoing}>
          <h2 className="text-xl font-extrabold">{t('guide.leave.title')}</h2>
          <p className="text-sm leading-normal text-ui-ink2">{t('guide.leave.body')}</p>
          <PrimaryButton type="button" onClick={guide.keepGoing}>{t('guide.leave.keep')}</PrimaryButton>
          <SecondaryButton onClick={guide.confirmLeave}>{t('guide.leave.confirm')}</SecondaryButton>
        </BottomSheet>
      )}
    </>
  )
}
