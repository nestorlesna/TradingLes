import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { historyApi } from '../api/history'

type FillItem = {
  id: string
  timestamp: string
  par: string
  lado: 'buy' | 'sell'
  precio: number
  cantidad: number
  comision: number
  pnl: number
}

type Session = {
  id: string
  grid_config_id: string
  estado: string
  capital_inicial: number
  pnl_realizado: number
  modo: string
  started_at: string | null
  stopped_at: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function exportCsv(fills: FillItem[]) {
  const header = 'Fecha,Par,Lado,Precio,Cantidad,Comision,PnL\n'
  const rows = fills.map(f =>
    `${f.timestamp},${f.par},${f.lado},${f.precio},${f.cantidad},${f.comision},${f.pnl}`
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'tradingles_fills.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function HistoryPage() {
  const [activeTab, setActiveTab] = useState<'fills' | 'sessions'>('fills')
  const [sessionFilter, setSessionFilter] = useState<string | undefined>()
  const [ladoFilter, setLadoFilter] = useState<string | undefined>()
  const [page, setPage] = useState(1)

  const { data: fillsData, isLoading: fillsLoading } = useQuery({
    queryKey: ['fills', sessionFilter, ladoFilter, page],
    queryFn: () => historyApi.getFills({
      session_id: sessionFilter,
      lado: ladoFilter,
      page,
      limit: 50,
    }),
  })

  const { data: summary } = useQuery({
    queryKey: ['history-summary', sessionFilter],
    queryFn: () => historyApi.getSummary(sessionFilter),
  })

  const { data: sessions } = useQuery({
    queryKey: ['history-sessions'],
    queryFn: historyApi.getSessions,
  })

  const fills: FillItem[] = fillsData?.items ?? []
  const totalPages = fillsData?.pages ?? 1
  const totalFills = fillsData?.total ?? 0

  const tabs = [
    { id: 'fills', label: 'Operaciones' },
    { id: 'sessions', label: 'Sesiones' },
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-slate-200 font-semibold text-lg">Historial</h2>
        {fills.length > 0 && (
          <button
            onClick={() => exportCsv(fills)}
            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-slate-400 border border-[#1e2433] rounded-lg transition-all">
            Exportar CSV
          </button>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total trades', value: String(summary.total_trades), color: 'text-slate-200' },
            { label: 'PnL realizado', value: `${summary.pnl_realizado >= 0 ? '+' : ''}$${summary.pnl_realizado.toFixed(4)}`, color: summary.pnl_realizado >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Comisiones', value: `$${summary.comisiones_totales.toFixed(4)}`, color: 'text-amber-400' },
            { label: 'PnL neto', value: `${summary.pnl_neto >= 0 ? '+' : ''}$${summary.pnl_neto.toFixed(4)}`, color: summary.pnl_neto >= 0 ? 'text-emerald-400' : 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#0d1117] border border-[#1e2433] rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-sm font-bold font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0d1117] border border-[#1e2433] rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Fills tab */}
      {activeTab === 'fills' && (
        <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl overflow-hidden">
          {/* Filters */}
          <div className="flex gap-3 px-4 py-3 border-b border-[#1e2433] flex-wrap">
            <select
              value={ladoFilter ?? ''}
              onChange={e => { setLadoFilter(e.target.value || undefined); setPage(1) }}
              className="bg-[#0b0e14] border border-[#1e2433] rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="">Todos (buy + sell)</option>
              <option value="buy">Solo compras</option>
              <option value="sell">Solo ventas</option>
            </select>
            {sessions && sessions.length > 0 && (
              <select
                value={sessionFilter ?? ''}
                onChange={e => { setSessionFilter(e.target.value || undefined); setPage(1) }}
                className="bg-[#0b0e14] border border-[#1e2433] rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
              >
                <option value="">Todas las sesiones</option>
                {sessions.map((s: Session) => (
                  <option key={s.id} value={s.id}>
                    {s.started_at ? formatDate(s.started_at) : s.id.slice(0, 8)} · {s.modo}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs text-slate-600 self-center ml-auto">{totalFills} operaciones</span>
          </div>

          {/* Table */}
          {fillsLoading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Cargando...</div>
          ) : fills.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No hay operaciones para los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-[#1e2433]">
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Par</th>
                    <th className="px-4 py-3 text-left">Lado</th>
                    <th className="px-4 py-3 text-right">Precio</th>
                    <th className="px-4 py-3 text-right">Cantidad</th>
                    <th className="px-4 py-3 text-right">Comisión</th>
                    <th className="px-4 py-3 text-right">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {fills.map((f) => (
                    <tr key={f.id} className="border-b border-[#1e2433]/50 hover:bg-white/3">
                      <td className="px-4 py-2.5 text-slate-500 font-mono">{formatDate(f.timestamp)}</td>
                      <td className="px-4 py-2.5 text-slate-300 font-semibold">{f.par}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded font-semibold ${
                          f.lado === 'buy' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                          {f.lado.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                        ${f.precio.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-400">{f.cantidad.toFixed(5)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-amber-400">${f.comision.toFixed(4)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-semibold ${
                        f.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {f.pnl >= 0 ? '+' : ''}{f.pnl.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-[#1e2433]">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg disabled:opacity-40 transition-all">
                ←
              </button>
              <span className="text-xs text-slate-500">Pág {page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg disabled:opacity-40 transition-all">
                →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sessions tab */}
      {activeTab === 'sessions' && (
        <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl overflow-hidden">
          {!sessions?.length ? (
            <div className="py-12 text-center text-slate-500 text-sm">No hay sesiones registradas.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-[#1e2433]">
                  <th className="px-4 py-3 text-left">Inicio</th>
                  <th className="px-4 py-3 text-left">Fin</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Modo</th>
                  <th className="px-4 py-3 text-right">Capital inicial</th>
                  <th className="px-4 py-3 text-right">PnL realizado</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: Session) => (
                  <tr key={s.id} className="border-b border-[#1e2433]/50 hover:bg-white/3 cursor-pointer"
                    onClick={() => { setSessionFilter(s.id); setActiveTab('fills'); setPage(1) }}>
                    <td className="px-4 py-2.5 font-mono text-slate-400">
                      {s.started_at ? formatDate(s.started_at) : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">
                      {s.stopped_at ? formatDate(s.stopped_at) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${
                        s.estado === 'activo' ? 'bg-emerald-500/15 text-emerald-400' :
                        s.estado === 'pausado' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-slate-700/50 text-slate-400'
                      }`}>
                        {s.estado}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        s.modo === 'mainnet' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {s.modo}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-300">${s.capital_inicial.toFixed(2)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${
                      s.pnl_realizado >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {s.pnl_realizado >= 0 ? '+' : ''}{s.pnl_realizado.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
