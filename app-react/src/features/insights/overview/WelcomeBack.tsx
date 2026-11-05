import { useTranslation } from 'react-i18next'
import { monthCount, welcomeBack } from './streaks'
import { shift } from './usual'

/** A line after a gap of 3+ days, never mentioning what was missed. */
export function WelcomeBack({ logged, todayCob }: { logged: string[]; todayCob: string }) {
  const { t } = useTranslation()
  if (!welcomeBack(logged, todayCob)) return null
  const month = todayCob.slice(0, 7)
  const count = monthCount(logged, month)
  const more = count - monthCount(logged, shift(`${month}-01`, -1).slice(0, 7))
  return (
    <p className="px-1.5 pt-1 pb-0.5 text-[17px] leading-[1.45] font-bold text-ui-ink">
      {t('insights.overview.welcomeBack')}{' '}
      {more > 0 ? t('insights.overview.loggedMore', { count, more }) : t('insights.overview.logged', { count })}
    </p>
  )
}
