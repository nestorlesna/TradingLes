import { useLocation } from 'react-router-dom'
import { useMarketStore } from '../../store/marketStore'
import { useAuthStore } from '../../store/authStore'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/grid': 'Grid Trading',
  '/history': 'Historial de Operaciones',
  '/backtest': 'Backtesting',
  '/settings': 'Configuración',
}

export function Header() {
  const location = useLocation()
  const title = pageTitles[location.pathname] ?? 'TradingLes'
  const hyperliquidStatus = useMarketStore((s) => s.hyperliquidStatus)
  const username = useAuthStore((s) => s.username)

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-[#1e2433] bg-[#0d1117]/80 backdrop-blur-sm">
      <h1 className="text-slate-200 font-semibold text-base tracking-tight">{title}</h1>

      <div className="flex items-center gap-4">
        {/* WS status */}
        <div className="flex items-center gap-2 text-xs">
          <div className={`flex items-center gap-1.5 ${
            hyperliquidStatus === 'connected' ? 'text-emerald-400' :
            hyperliquidStatus === 'reconnecting' ? 'text-amber-400' : 'text-slate-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              hyperliquidStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
              hyperliquidStatus === 'reconnecting' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'
            }`} />
            <span>
              {hyperliquidStatus === 'connected' ? 'Hyperliquid' :
               hyperliquidStatus === 'reconnecting' ? 'Reconectando...' : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* User pill */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white">
            {username?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="text-xs text-slate-300 font-medium">{username}</span>
        </div>
      </div>
    </header>
  )
}
