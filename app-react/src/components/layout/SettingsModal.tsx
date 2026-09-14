import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { LuX } from 'react-icons/lu'
import { useUiStore } from '../../store/uiStore'
import { SettingsPage } from '../../pages/settings/SettingsPage'

/**
 * Settings rendered as a glass popup instead of a routed page. Opened from the
 * Settings nav item (desktop TopBar + mobile BottomNav). Closes on the ✕, the
 * backdrop, Escape, or when a settings menu item navigates away.
 */
export function SettingsModal() {
  const open = useUiStore((s) => s.settingsOpen)
  const close = useUiStore((s) => s.closeSettings)
  const location = useLocation()

  // Navigating (e.g. tapping a settings menu item) dismisses the popup.
  useEffect(() => {
    if (open) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center sm:p-4"
      onClick={close}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(11,16,26,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      />
      <div
        className="relative w-full sm:max-w-md max-h-[100dvh] sm:max-h-[85vh] overflow-y-auto sm:rounded-3xl"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#f2f4f6', border: 'none', cursor: 'pointer' }}
        >
          <LuX className="w-5 h-5" />
        </button>
        <SettingsPage />
      </div>
    </div>
  )
}
