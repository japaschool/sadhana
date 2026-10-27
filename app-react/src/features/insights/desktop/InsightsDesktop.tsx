import { DesktopShell } from '../../../layouts/desktop/DesktopShell'
import { InsightsTablet } from '../tablet/InsightsTablet'

// Same screen as tablet; the log panel's date replaces the end date control.
export function InsightsDesktopScreen() {
  return (
    <DesktopShell>
      {(logDate, setLogDate) => <InsightsTablet logDate={logDate} onLogDate={setLogDate} chartHeight={380} />}
    </DesktopShell>
  )
}
