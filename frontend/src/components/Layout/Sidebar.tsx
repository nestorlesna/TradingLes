import { NavLink } from 'react-router-dom'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/grid', label: 'Grid', icon: '⚡' },
  { to: '/history', label: 'Historial', icon: '📋' },
  { to: '/backtest', label: 'Backtest', icon: '🔬' },
  { to: '/settings', label: 'Configuración', icon: '⚙️' },
]

export function Sidebar() {
  const mode = useSettingsStore((s) => s.mode)
  const logout = useAuthStore((s) => s.logout)

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-[#0d1117] border-r border-[#1e2433]">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#1e2433]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-blue-500/20">
            T
          </div>
          <span className="text-white font-semibold text-base tracking-wide">TradingLes</span>
        </div>
        {/* Mode pill */}
        <div className="mt-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              mode === 'testnet'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-red-500/15 text-red-400 border border-red-500/30'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${mode === 'testnet' ? 'bg-amber-400' : 'bg-red-400'}`} />
            {mode === 'testnet' ? 'Testnet' : 'Mainnet'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            <span className="text-base w-5 text-center">{icon}</span>
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[#1e2433]">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          <span className="text-base w-5 text-center">🚪</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
