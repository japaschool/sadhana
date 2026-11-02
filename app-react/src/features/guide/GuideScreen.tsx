import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { ByLayout } from '../../layouts/ByLayout'
import { useLayout } from '../../layouts/useLayout'
import { BottomSheet } from '../../ui/primitives/BottomSheet'
import { PrimaryButton, SecondaryButton } from '../auth/kit'
import { FinishStep } from './FinishStep'
import { ChooseMobile } from './mobile/ChooseMobile'
import { SetupMobile } from './mobile/SetupMobile'
import { ReaderStep } from './ReaderStep'
import { useGuide } from './useGuide'
import { ChooseWide } from './wide/ChooseWide'
import { SetupWide } from './wide/SetupWide'

/** /guide. Opened by sign-up (state.firstRun) or from the app (no state): the latter has no reader question. */
export function GuideScreen() {
  const { t } = useTranslation()
  const state = useLocation().state as { firstRun?: boolean; back?: string } | null
  const guide = useGuide({ firstRun: state?.firstRun === true, back: state?.back ?? '/', carousel: useLayout() === 'mobile' })
  const { step } = guide

  return (
    <>
      {step.at === 'choose' && <ByLayout mobile={<ChooseMobile guide={guide} />} tablet={<ChooseWide guide={guide} />} desktop={<ChooseWide guide={guide} />} />}
      {step.at === 'setup' && <ByLayout key={step.kind} mobile={<SetupMobile guide={guide} kind={step.kind} />} tablet={<SetupWide guide={guide} kind={step.kind} />} desktop={<SetupWide guide={guide} kind={step.kind} />} />}
      {step.at === 'reader' && <ReaderStep guide={guide} />}
      {step.at === 'finish' && <FinishStep guide={guide} />}
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
