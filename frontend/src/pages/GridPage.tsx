import { useGridStore } from '../store/gridStore'
import { useMarketStore } from '../store/marketStore'
import { GridConfigForm } from '../components/GridConfig/GridConfigForm'
import { GridPreview } from '../components/GridConfig/GridPreview'
import { CandlestickChart } from '../components/Chart/CandlestickChart'
import { TimeframeSelector } from '../components/Chart/TimeframeSelector'
import { BotPanel } from '../components/BotPanel/BotPanel'

export function GridPage() {
  const form = useGridStore((s) => s.form)
  const calcResult = useGridStore((s) => s.calcResult)
  const selectedTimeframe = useMarketStore((s) => s.selectedTimeframe)
  const prices = useMarketStore((s) => s.prices)
  const priceData = prices[form.par]

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-slate-200 font-semibold">Grid Trading</h2>
          {priceData && (
            <span className={`text-lg font-bold font-mono tabular-nums ${
              priceData.direction === 'up' ? 'text-emerald-400' :
              priceData.direction === 'down' ? 'text-red-400' : 'text-slate-300'
            }`}>
              ${priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
          )}
          {calcResult && (
            <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded-full px-2.5 py-0.5">
              {calcResult.niveles.length} niveles calculados
            </span>
          )}
        </div>
        <TimeframeSelector />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
        {/* Columna izquierda: gráfico + preview */}
        <div className="space-y-4 min-w-0">
          <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl overflow-hidden">
            <CandlestickChart
              par={form.par}
              timeframe={selectedTimeframe}
              showGridOverlay={true}
            />
          </div>
          <GridPreview />
        </div>

        {/* Columna derecha: formulario + bot */}
        <div className="space-y-4 overflow-y-auto">
          <GridConfigForm />
          <BotPanel />
        </div>
      </div>
    </div>
  )
}
