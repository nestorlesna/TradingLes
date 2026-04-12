import { useMarketStore } from '../../store/marketStore'

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d']

export function TimeframeSelector() {
  const selected = useMarketStore((s) => s.selectedTimeframe)
  const setTimeframe = useMarketStore((s) => s.setSelectedTimeframe)

  return (
    <div className="flex items-center gap-1 bg-[#0d1117] border border-[#1e2433] rounded-lg p-1">
      {TIMEFRAMES.map(tf => (
        <button
          key={tf}
          onClick={() => setTimeframe(tf)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
            selected === tf
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
        >
          {tf.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
