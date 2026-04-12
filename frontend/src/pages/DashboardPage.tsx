import { useMarketStore } from '../store/marketStore'
import { CandlestickChart } from '../components/Chart/CandlestickChart'
import { TimeframeSelector } from '../components/Chart/TimeframeSelector'
import { PairSelector } from '../components/Chart/PairSelector'

export function DashboardPage() {
  const selectedPair = useMarketStore((s) => s.selectedPair)
  const selectedTimeframe = useMarketStore((s) => s.selectedTimeframe)
  const prices = useMarketStore((s) => s.prices)
  const priceData = prices[selectedPair]

  const priceColor =
    priceData?.direction === 'up' ? 'text-emerald-400' :
    priceData?.direction === 'down' ? 'text-red-400' : 'text-slate-200'

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <PairSelector />

          {priceData && (
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold font-mono tabular-nums ${priceColor}`}>
                ${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                priceData.direction === 'up' ? 'bg-emerald-500/15 text-emerald-400' :
                priceData.direction === 'down' ? 'bg-red-500/15 text-red-400' : 'bg-slate-800 text-slate-400'
              }`}>
                {priceData.direction === 'up' ? '▲' : priceData.direction === 'down' ? '▼' : '—'}
              </span>
            </div>
          )}
        </div>

        <TimeframeSelector />
      </div>

      {/* Chart */}
      <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl overflow-hidden">
        <CandlestickChart par={selectedPair} timeframe={selectedTimeframe} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Par', value: `${selectedPair}-PERP` },
          { label: 'Timeframe', value: selectedTimeframe.toUpperCase() },
          { label: 'Precio', value: priceData ? `$${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '—' },
          { label: 'Estado', value: 'Conectado', color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0d1117] border border-[#1e2433] rounded-xl px-4 py-3">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className={`text-sm font-semibold font-mono ${color ?? 'text-slate-200'}`}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
