import { useTranslation } from 'react-i18next'
import { DAYS_SLOT, DURATION_SLOT, MAX_DAYS, MAX_PRACTICES } from '../../insights/panels/templates'
import type { GuideKind } from '../guideLogic'
import { SetupCount } from './SetupCount'
import { SetupNames } from './SetupNames'
import { SetupSleep } from './SetupSleep'
import type { Setup } from './useSetup'

const TIME = [1, 2, 3, 4, 5, 6]
const DAYS = [1, 2, 3, 4, 5]

/** The form for one report. Each kind is its own component; this picks it. */
export function SetupBody({ kind, setup }: { kind: GuideKind; setup: Setup<GuideKind> }) {
  const { t } = useTranslation()
  if (kind === 'sleep') return <SetupSleep setup={setup as Setup<'sleep'>} />
  if (kind === 'count') return <SetupCount setup={setup as Setup<'count'>} />
  return kind === 'time'
    ? <SetupNames setup={setup as Setup<'time'>} slot={DURATION_SLOT} max={MAX_PRACTICES} suggestions={TIME.map((n) => t(`guide.suggest.time${n}`))} />
    : <SetupNames setup={setup as Setup<'days'>} slot={DAYS_SLOT} max={MAX_DAYS} suggestions={DAYS.map((n) => t(`guide.suggest.days${n}`))} />
}
