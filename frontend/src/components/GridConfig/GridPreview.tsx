import { useGridStore } from '../../store/gridStore'
import { useMarketStore } from '../../store/marketStore'

export function GridPreview() {
  const calcResult = useGridStore((s) => s.calcResult)
  const form = useGridStore((s) => s.form)
  const prices = useMarketStore((s) => s.prices)
  const precioActual = prices[form.par]?.price

  if (!calcResult || calcResult.niveles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center bg-[#0d1117] border border-[#1e2433] rounded-xl">
        <span className="text-2xl mb-2">📊</span>
        <p className="text-slate-500 text-sm">Completá los parámetros para ver el preview de la grilla</p>
      </div>
    )
  }

  const { niveles } = calcResult

  // Nivel más cercano al precio actual
  const closestIdx = precioActual
    ? niveles.reduce((best, n, i) =>
        Math.abs(n.precio - precioActual) < Math.abs(niveles[best].precio - precioActual) ? i : best, 0)
    : -1

  const totalCapital = niveles.reduce((s, n) => s + n.capital, 0)
  const totalGananciaNeta = niveles.reduce((s, n) => s + n.gananciaNeta, 0)
  const totalComision = niveles.reduce((s, n) => s + n.comision, 0)

  return (
    <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e2433] flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Preview — {niveles.length} niveles
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Buy ({niveles.filter(n => n.tipo === 'buy').length})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Sell ({niveles.filter(n => n.tipo === 'sell').length})
          </span>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[420px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d1117] border-b border-[#1e2433]">
            <tr className="text-slate-500">
              <th className="text-left px-4 py-2.5 font-medium">#</th>
              <th className="text-right px-4 py-2.5 font-medium">Precio</th>
              <th className="text-center px-3 py-2.5 font-medium">Tipo</th>
              <th className="text-right px-4 py-2.5 font-medium">Capital</th>
              <th className="text-right px-4 py-2.5 font-medium">Cantidad</th>
              <th className="text-right px-4 py-2.5 font-medium">Comisión</th>
              <th className="text-right px-4 py-2.5 font-medium">Ganancia neta</th>
            </tr>
          </thead>
          <tbody>
            {[...niveles].reverse().map((nivel, i) => {
              const isClosest = closestIdx === niveles.length - 1 - i
              const isLiq = nivel.precio <= calcResult.precioLiquidacion
              return (
                <tr
                  key={nivel.nivel}
                  className={`border-b border-[#1e2433]/50 transition-colors ${
                    isClosest ? 'bg-blue-500/10' :
                    isLiq ? 'bg-red-500/5' :
                    'hover:bg-white/[0.02]'
                  }`}
                >
                  <td className="px-4 py-2 text-slate-500">
                    {isClosest ? <span className="text-blue-400 font-bold">→</span> : nivel.nivel}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-200">
                    ${nivel.precio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      nivel.tipo === 'buy'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}>
                      {nivel.tipo.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-300">
                    ${nivel.capital.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-300">
                    {nivel.cantidad.toFixed(5)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-500">
                    ${nivel.comision.toFixed(4)}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono font-semibold ${
                    nivel.gananciaNeta > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    ${nivel.gananciaNeta.toFixed(4)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t border-[#2d3748] bg-[#131b2e]">
            <tr className="text-slate-400 font-semibold">
              <td colSpan={3} className="px-4 py-2.5 text-xs uppercase tracking-wide">Total</td>
              <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                ${totalCapital.toFixed(2)}
              </td>
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                ${totalComision.toFixed(4)}
              </td>
              <td className={`px-4 py-2.5 text-right font-mono font-bold ${
                totalGananciaNeta > 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                ${totalGananciaNeta.toFixed(4)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Precio de liquidación */}
      <div className="px-4 py-3 border-t border-[#1e2433] flex items-center gap-2 bg-red-500/5">
        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
        <span className="text-xs text-red-400">
          Precio de liquidación estimado:
          <span className="font-mono font-bold ml-1">
            ${calcResult.precioLiquidacion.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
        </span>
      </div>
    </div>
  )
}
