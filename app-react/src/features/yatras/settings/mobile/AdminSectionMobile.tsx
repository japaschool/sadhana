import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { DangerZoneMobile } from './DangerZoneMobile'
import { GeneralMobile } from './GeneralMobile'
import { InviteMobile } from './InviteMobile'
import { MembersMobile } from './MembersMobile'
import { PracticesMobile } from './PracticesMobile'
import { StatisticsMobile } from './StatisticsMobile'

const SECTIONS: Record<string, ReactNode> = {
  general: <GeneralMobile />,
  practices: <PracticesMobile />,
  members: <MembersMobile />,
  statistics: <StatisticsMobile />,
  invite: <InviteMobile />,
  danger: <DangerZoneMobile />,
}

/** /yatra/:id/admin/:section; unknown sections go to the hub. */
export function AdminSectionMobile() {
  const { id = '', section = '' } = useParams()
  return SECTIONS[section] ?? <Navigate to={`/yatra/${id}/settings`} replace />
}
