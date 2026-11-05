import { BdaCards } from './BdaCard'
import { LessRegular } from './LessRegular'
import { MeVsNormal } from './MeVsNormal'
import { OpenPeriodCard } from './OpenPeriodCard'
import { OverviewLinks } from './OverviewLinks'
import { OverviewSheets, OverviewStatus } from './OverviewShared'
import { SuggestionCard } from './SuggestionCard'
import { useOverview } from './useOverview'
import { useOverviewActions } from './useOverviewActions'
import { WelcomeBack } from './WelcomeBack'

/** The Overview segment on mobile: prompts, then Me vs my normal (regular) or days practised (less regular). */
export function OverviewMobile() {
  const ov = useOverview()
  const actions = useOverviewActions(ov)
  const { suggestionProps, openPeriodProps } = actions
  if (ov.isLoading || ov.isError) return <OverviewStatus ov={ov} />

  return (
    <>
      {suggestionProps && <SuggestionCard {...suggestionProps} />}
      {openPeriodProps && <OpenPeriodCard {...openPeriodProps} />}
      <WelcomeBack logged={ov.logged} todayCob={ov.todayCob} />
      {ov.regular ? (
        <>
          <MeVsNormal normal={ov.normal} practices={ov.practices} variant="stacked" />
          <BdaCards rows={ov.rows} series={ov.series} periods={ov.periods} practices={ov.practices} todayCob={ov.todayCob} />
          <OverviewLinks />
        </>
      ) : (
        <LessRegular logged={ov.logged} todayCob={ov.todayCob} streaks={ov.prefs.streaks} rows={ov.rows} series={ov.series} practices={ov.practices} periods={ov.periods} />
      )}
      <OverviewSheets ov={ov} actions={actions} />
    </>
  )
}
