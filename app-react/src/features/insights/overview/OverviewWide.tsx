import { LessRegular } from './LessRegular'
import { MeVsNormal } from './MeVsNormal'
import { OpenPeriodCard } from './OpenPeriodCard'
import { OverviewLinks } from './OverviewLinks'
import { OverviewSheets, OverviewStatus } from './OverviewShared'
import { SuggestionCard } from './SuggestionCard'
import { useOverview } from './useOverview'
import { useOverviewActions } from './useOverviewActions'
import { WelcomeBack } from './WelcomeBack'

/** The Overview segment on tablet and desktop: Me vs my normal across the full width, other cards in two columns below. */
export function OverviewWide() {
  const ov = useOverview()
  const actions = useOverviewActions(ov)
  const { suggestionProps, openPeriodProps } = actions
  if (ov.isLoading || ov.isError) return <OverviewStatus ov={ov} />

  return (
    <>
      {ov.regular && <MeVsNormal normal={ov.normal} practices={ov.practices} variant="columns" />}
      <div className="grid grid-cols-2 items-start gap-[22px] [&>*]:min-w-0">
        {suggestionProps && <SuggestionCard {...suggestionProps} />}
        {openPeriodProps && <OpenPeriodCard {...openPeriodProps} />}
        <WelcomeBack logged={ov.logged} todayCob={ov.todayCob} />
        {ov.regular ? <OverviewLinks /> : (
          <LessRegular logged={ov.logged} todayCob={ov.todayCob} streaks={ov.prefs.streaks} rows={ov.rows} series={ov.series} practices={ov.practices} periods={ov.periods} />
        )}
      </div>
      <OverviewSheets ov={ov} actions={actions} />
    </>
  )
}
