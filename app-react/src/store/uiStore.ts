import { create } from 'zustand'

// Cross-component UI signals. `yatraCreateNonce` lets the mobile bottom-nav
// center button ask the (separately mounted) YatrasPage to open its
// create-yatra modal. Consumers compare the nonce against a ref so a fresh
// mount doesn't spuriously fire.
interface UiState {
  yatraCreateNonce: number
  requestYatraCreate: () => void
  // Settings opens as a glass modal overlay instead of routing to /settings.
  settingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
}

export const useUiStore = create<UiState>((set) => ({
  yatraCreateNonce: 0,
  requestYatraCreate: () => set((s) => ({ yatraCreateNonce: s.yatraCreateNonce + 1 })),
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}))
