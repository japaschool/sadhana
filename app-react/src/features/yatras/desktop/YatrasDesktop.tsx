import { DesktopShell } from '../../../layouts/desktop/DesktopShell'
import { YatrasTablet } from '../tablet/YatrasTablet'

// Same screen as tablet; useYatras shares the log's date, so the log panel picks the day.
export function YatrasDesktopScreen() {
  return (
    <DesktopShell>
      {() => <YatrasTablet fixedDate />}
    </DesktopShell>
  )
}
