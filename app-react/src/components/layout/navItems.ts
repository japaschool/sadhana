import { FaHome, FaChartBar, FaUsers, FaCog } from 'react-icons/fa'

// Single source of truth for the primary destinations, shared by the desktop
// TopBar nav and the mobile BottomNav.
export const navItems = [
  { to: '/',         navKey: 'home',     icon: FaHome,     exact: true  },
  { to: '/charts',   navKey: 'charts',   icon: FaChartBar, exact: false },
  { to: '/yatras',   navKey: 'yatras',   icon: FaUsers,    exact: false },
  { to: '/settings', navKey: 'settings', icon: FaCog,      exact: false },
] as const
