import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { backtestApi, type BacktestRunRequest } from '../api/backtest'

const PAIRS = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'ARB', 'OP', 'AVAX', 'MATIC', 'LINK']
const TIMEFRAMES = ['15m', '1h', '4h']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, color = 'text-slate-200' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0b0e14] rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1.5">{label}</p>
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
    </div>
  )
}

// ── Simple equity curve (canvas) ─────────────────────────────────────────────
function EquityCurve({ trades, capitalInicial }: { trades: any[]; capitalInicial: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || trades.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const w = canvas.width
    const h = canvas.height
    const pad = 10

    const points = trades.map(t => t.capital_acumulado as number)
    if (points.length === 0) return

    const minV = Math.min(capitalInicial, ...points)
    const maxV = Math.max(capitalInicial, ...points)
    const range = maxV - minV || 1

    ctx.clearRect(0, 0, w, h)

    // Grid lines
    ctx.strokeStyle = '#1e2433'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = pad + ((h - pad * 2) * i) / 4
      ctx.beginPath()
      ctx.moveTo(pad, y)
      ctx.lineTo(w - pad, y)
      ctx.stroke()
    }

    // Initial capital line
    const baseY = pad + ((maxV - capitalInicial) / range) * (h - pad * 2)
    ctx.strokeStyle = '#334155'
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pad, baseY)
    ctx.lineTo(w - pad, baseY)
    ctx.stroke()
    ctx.setLineDash([])

    // Equity curve
    const final = points[points.length - 1]
    ctx.strokeStyle = final >= capitalInicial ? '#22c55e' : '#ef4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    points.forEach((v, i) => {
      const x = pad + (i / (points.length - 1)) * (w - pad * 2)
      const y = pad + ((maxV - v) / range) * (h - pad * 2)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }, [trades, capitalInicial])

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={180}
      className="w-full h-44 rounded-lg bg-[#0b0e14]"
    />
  )
}

// ── Results panel ─────────────────────────────────────────────────────────────
function BacktestResults({ results }: { results: any }) {
  const [showTrades, setShowTrades] = useState(false)
  const r = results.resultados
  const cfg = results.config

  if (!r) {
    return (
      <div className="bg-[#0d1117] border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
        {results.error_msg ?? 'Error desconocido'}
      </div>
    )
  }

  const winRate = r.total_trades > 0 ? ((r.trades_ganadores / r.total_trades) * 100).toFixed(1) : '0'
  const pnlColor = r.pnl_total >= 0 ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="space-y-4">
      {/* Summary text */}
      <div className={`rounded-xl p-4 border ${r.fue_liquidado ? 'bg-red-500/10 border-red-500/30' : r.pnl_total >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
        {r.fue_liquidado ? (
          <p className="text-red-400 font-semibold text-sm">
            El bot fue liquidado el {r.timestamp_liquidacion ? formatDate(r.timestamp_liquidacion) : '—'} (precio de liq: ${r.precio_liquidacion.toFixed(2)})
          </p>
        ) : (
          <p className={`font-semibold text-sm ${pnlColor}`}>
            {r.pnl_total >= 0 ? 'Ganancia' : 'Pérdida'}: {r.pnl_total >= 0 ? '+' : ''}${r.pnl_total.toFixed(2)} ({r.pnl_porcentaje >= 0 ? '+' : ''}{r.pnl_porcentaje.toFixed(2)}%)
            {' '}entre {formatDate(cfg.fecha_inicio)} y {formatDate(cfg.fecha_fin)}
          </p>
        )}
        <p className="text-slate-400 text-xs mt-1">
          {cfg.par} · {cfg.cantidad_niveles} niveles · capital ${cfg.capital_usdc} · {cfg.apalancamiento}x · {cfg.timeframe_simulacion}
          · Completado en {r.duracion_segundos.toFixed(1)}s
        </p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard
          label="PnL total"
          value={`${r.pnl_total >= 0 ? '+' : ''}$${r.pnl_total.toFixed(2)}`}
          color={pnlColor}
        />
        <MetricCard
          label="ROI"
          value={`${r.pnl_porcentaje >= 0 ? '+' : ''}${r.pnl_porcentaje.toFixed(2)}%`}
          color={pnlColor}
        />
        <MetricCard
          label="Total trades"
          value={String(r.total_trades)}
        />
        <MetricCard
          label="Win rate"
          value={`${winRate}%`}
          color={parseFloat(winRate) >= 50 ? 'text-emerald-400' : 'text-red-400'}
        />
        <MetricCard
          label="Max drawdown"
          value={`$${r.max_drawdown.toFixed(2)} (${r.max_drawdown_porcentaje.toFixed(1)}%)`}
          color="text-red-400"
        />
        <MetricCard
          label="Comisiones"
          value={`$${r.comisiones_totales.toFixed(4)}`}
          color="text-amber-400"
        />
        {r.sharpe_ratio !== null && (
          <MetricCard
            label="Sharpe ratio"
            value={r.sharpe_ratio.toFixed(2)}
            color={r.sharpe_ratio >= 1 ? 'text-emerald-400' : r.sharpe_ratio >= 0 ? 'text-slate-200' : 'text-red-400'}
          />
        )}
        <MetricCard
          label="Capital final"
          value={`$${r.capital_final.toFixed(2)}`}
        />
      </div>

      {/* Equity curve */}
      {results.trades?.length > 0 && (
        <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Curva de equity
          </p>
          <EquityCurve trades={results.trades} capitalInicial={cfg.capital_usdc} />
        </div>
      )}

      {/* Trades table (collapsible) */}
      {results.trades?.length > 0 && (
        <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowTrades(!showTrades)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hover:bg-white/5 transition-all"
          >
            <span>Trades ({results.trades.length})</span>
            <span>{showTrades ? '▲' : '▼'}</span>
          </button>
          {showTrades && (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0d1117]">
                  <tr className="text-slate-500 border-b border-[#1e2433]">
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Lado</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                    <th className="px-3 py-2 text-right">PnL</th>
                    <th className="px-3 py-2 text-right">Capital</th>
                  </tr>
                </thead>
                <tbody>
                  {results.trades.map((t: any, i: number) => (
                    <tr key={i} className="border-b border-[#1e2433]/50 hover:bg-white/3">
                      <td className="px-3 py-1.5 text-slate-500 font-mono">
                        {new Date(t.timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${t.lado === 'buy' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                          {t.lado.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-300">
                        ${t.precio.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                        {t.cantidad.toFixed(5)}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(4)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                        ${t.capital_acumulado.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── History item ──────────────────────────────────────────────────────────────
function HistoryItem({ item, onSelect, onDelete }: { item: any; onSelect: () => void; onDelete: () => void }) {
  const pnlColor = item.pnl_total === null ? 'text-slate-500' : item.pnl_total >= 0 ? 'text-emerald-400' : 'text-red-400'
  return (
    <div
      className="flex items-center justify-between bg-[#0b0e14] rounded-xl px-3 py-2.5 hover:bg-white/5 cursor-pointer transition-all"
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <p className="text-xs font-medium text-slate-300">
            {item.par} · {item.cantidad_niveles}nv · ${item.capital_usdc} · {item.apalancamiento}x
          </p>
          <p className="text-xs text-slate-600">
            {formatDate(item.fecha_inicio)} → {formatDate(item.fecha_fin)} · {item.timeframe_simulacion}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {item.estado === 'ejecutando' || item.estado === 'pendiente' ? (
          <span className="text-xs text-amber-400 animate-pulse">Ejecutando...</span>
        ) : item.pnl_total !== null ? (
          <span className={`text-sm font-bold font-mono ${pnlColor}`}>
            {item.pnl_total >= 0 ? '+' : ''}${item.pnl_total.toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-red-400">Error</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="text-slate-600 hover:text-red-400 transition-all text-sm px-1"
        >
          ×
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function BacktestPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'config' | 'results' | 'history'>('config')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  // Listen to WS progress events
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const msg = e.detail
      if (msg.type === 'backtest_progress' && msg.backtest_id === selectedId) {
        setProgress(msg.progreso)
        if (msg.completado) {
          setRunning(false)
          setActiveTab('results')
          qc.invalidateQueries({ queryKey: ['backtest-list'] })
          qc.invalidateQueries({ queryKey: ['backtest-results', msg.backtest_id] })
        }
      }
    }
    window.addEventListener('ws_message' as any, handler)
    return () => window.removeEventListener('ws_message' as any, handler)
  }, [selectedId, qc])

  // Form state
  const [form, setForm] = useState({
    par: 'BTC',
    precio_min: '',
    precio_max: '',
    cantidad_niveles: 10,
    tipo_espaciado: 'geometrico',
    capital_usdc: '',
    apalancamiento: 3,
    fecha_inicio: '',
    fecha_fin: '',
    timeframe: '1h',
  })

  const setField = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Preset date ranges
  const setPreset = (months: number) => {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - months)
    setField('fecha_inicio', start.toISOString().split('T')[0])
    setField('fecha_fin', end.toISOString().split('T')[0])
  }

  const runMutation = useMutation({
    mutationFn: (req: BacktestRunRequest) => backtestApi.run(req),
    onSuccess: (data) => {
      setSelectedId(data.backtest_id)
      setRunning(true)
      setProgress(0)
      qc.invalidateQueries({ queryKey: ['backtest-list'] })
    },
    onError: (err: any) => {
      setErrMsg(err.response?.data?.detail ?? 'Error iniciando backtest')
      setTimeout(() => setErrMsg(''), 4000)
    },
  })

  const handleRun = () => {
    if (!form.precio_min || !form.precio_max || !form.capital_usdc || !form.fecha_inicio || !form.fecha_fin) {
      setErrMsg('Completá todos los campos')
      setTimeout(() => setErrMsg(''), 3000)
      return
    }
    runMutation.mutate({
      par: form.par,
      precio_min: parseFloat(form.precio_min),
      precio_max: parseFloat(form.precio_max),
      cantidad_niveles: form.cantidad_niveles,
      tipo_espaciado: form.tipo_espaciado,
      capital_usdc: parseFloat(form.capital_usdc),
      apalancamiento: form.apalancamiento,
      fecha_inicio: new Date(form.fecha_inicio).toISOString(),
      fecha_fin: new Date(form.fecha_fin + 'T23:59:59Z').toISOString(),
      timeframe_simulacion: form.timeframe,
    })
  }

  // History
  const { data: historyData } = useQuery({
    queryKey: ['backtest-list'],
    queryFn: () => backtestApi.list(),
    refetchInterval: running ? 3000 : false,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => backtestApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backtest-list'] }),
  })

  // Results
  const { data: resultsData } = useQuery({
    queryKey: ['backtest-results', selectedId],
    queryFn: () => backtestApi.getResults(selectedId!),
    enabled: !!selectedId && !running,
  })

  const tabs = [
    { id: 'config', label: 'Configurar' },
    { id: 'results', label: 'Resultados' },
    { id: 'history', label: 'Historial' },
  ] as const

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-slate-200 font-semibold text-lg">Backtesting</h2>
        {running && (
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Ejecutando... {progress}%
          </div>
        )}
      </div>

      {/* Progress bar */}
      {running && (
        <div className="w-full bg-[#1e2433] rounded-full h-1.5">
          <div
            className="bg-gradient-to-r from-blue-500 to-cyan-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0d1117] border border-[#1e2433] rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === t.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Config tab */}
      {activeTab === 'config' && (
        <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl p-5 space-y-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Parámetros del backtest</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Par</label>
              <select value={form.par} onChange={e => setField('par', e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50">
                {PAIRS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Timeframe simulación</label>
              <select value={form.timeframe} onChange={e => setField('timeframe', e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50">
                {TIMEFRAMES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Precio mínimo', key: 'precio_min', ph: 'ej: 90000' },
              { label: 'Precio máximo', key: 'precio_max', ph: 'ej: 100000' },
              { label: 'Capital USDC', key: 'capital_usdc', ph: 'ej: 500' },
            ].map(({ label, key, ph }) => (
              <div key={key}>
                <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
                <input
                  type="text" inputMode="decimal"
                  value={(form as any)[key]}
                  onChange={e => setField(key, e.target.value)}
                  placeholder={ph}
                  className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Niveles</label>
              <input type="number" min="2" value={form.cantidad_niveles}
                onChange={e => setField('cantidad_niveles', parseInt(e.target.value) || 10)}
                className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
              />
            </div>
          </div>

          {/* Leverage & spacing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Espaciado</label>
              <select value={form.tipo_espaciado} onChange={e => setField('tipo_espaciado', e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50">
                <option value="geometrico">Geométrico</option>
                <option value="aritmetico">Aritmético</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Apalancamiento — {form.apalancamiento}x</label>
              <input type="range" min="1" max="10" step="0.5" value={form.apalancamiento}
                onChange={e => setField('apalancamiento', parseFloat(e.target.value))}
                className="w-full mt-2 accent-blue-500"
              />
            </div>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Período</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {[
                { label: '1 mes', months: 1 },
                { label: '3 meses', months: 3 },
                { label: '6 meses', months: 6 },
                { label: '1 año', months: 12 },
              ].map(p => (
                <button key={p.months} onClick={() => setPreset(p.months)}
                  className="px-2.5 py-1 text-xs bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg transition-all">
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={form.fecha_inicio} onChange={e => setField('fecha_inicio', e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" />
              <input type="date" value={form.fecha_fin} onChange={e => setField('fecha_fin', e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>

          {errMsg && (
            <p className="text-xs text-red-400 text-center">{errMsg}</p>
          )}

          <button
            onClick={handleRun}
            disabled={running || runMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-sm font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
            {running ? (
              <><span className="animate-spin">⟳</span> Ejecutando backtest ({progress}%)...</>
            ) : (
              <><span>▶</span> Ejecutar backtest</>
            )}
          </button>
        </div>
      )}

      {/* Results tab */}
      {activeTab === 'results' && (
        <div>
          {!selectedId ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Ejecutá un backtest para ver los resultados aquí.
            </div>
          ) : running ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Simulación en progreso... {progress}%
            </div>
          ) : resultsData ? (
            <BacktestResults results={resultsData} />
          ) : null}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          {!historyData?.items?.length ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No hay backtests anteriores.
            </div>
          ) : (
            historyData.items.map((item: any) => (
              <HistoryItem
                key={item.id}
                item={item}
                onSelect={() => {
                  setSelectedId(item.id)
                  setActiveTab('results')
                  qc.invalidateQueries({ queryKey: ['backtest-results', item.id] })
                }}
                onDelete={() => deleteMutation.mutate(item.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
