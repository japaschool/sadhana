import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { GeneralMobile } from './GeneralMobile'

// Tasks 6–11 add: general, practices, members, statistics, invite, danger.
const SECTIONS: Record<string, ReactNode> = {
  general: <GeneralMobile />,
}

/** /yatra/:id/admin/:section on mobile; unknown sections go to the hub. */
export function AdminSectionMobile() {
  const { id = '', section = '' } = useParams()
  return SECTIONS[section] ?? <Navigate to={`/yatra/${id}/admin/settings`} replace />
}
