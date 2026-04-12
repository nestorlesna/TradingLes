import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useGridStore } from '../../store/gridStore'
import { useMarketStore } from '../../store/marketStore'
import { useGridCalc } from '../../hooks/useGridCalc'
import { calculateGridLevels } from '../../utils/gridCalculations'
import { gridApi } from '../../api/grid'
import type { GridConfig } from '../../types'

const PAIRS = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'ARB', 'OP', 'AVAX', 'MATIC', 'LINK']

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  )
}

function NumInput({ value, onChange, placeholder, step, min }: {
  value: string; onChange: (v: string) => void; placeholder?: string; step?: string; min?: string
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      step={step}
      className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
    />
  )
}

export function GridConfigForm() {
  useGridCalc()

  const form = useGridStore((s) => s.form)
  const setForm = useGridStore((s) => s.setForm)
  const calcResult = useGridStore((s) => s.calcResult)
  const setCalcResult = useGridStore((s) => s.setCalcResult)
  const selectedConfigId = useGridStore((s) => s.selectedConfigId)
  const setSelectedConfigId = useGridStore((s) => s.setSelectedConfigId)
  const resetForm = useGridStore((s) => s.resetForm)

  const prices = useMarketStore((s) => s.prices)
  const precioActual = prices[form.par]?.price

  const qc = useQueryClient()
  const [saveMsg, setSaveMsg] = useState('')

  const { data: savedConfigs = [] } = useQuery({
    queryKey: ['grid-configs'],
    queryFn: gridApi.listConfigs,
  })

  const createMutation = useMutation({
    mutationFn: gridApi.createConfig,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grid-configs'] }); setSaveMsg('✓ Guardado') },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GridConfig> }) => gridApi.updateConfig(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grid-configs'] }); setSaveMsg('✓ Actualizado') },
  })

  const deleteMutation = useMutation({
    mutationFn: gridApi.deleteConfig,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grid-configs'] }); resetForm() },
  })

  // Cálculo inmediato sin debounce
  const handleCalculate = () => {
    const min = parseFloat(form.precioMin)
    const max = parseFloat(form.precioMax)
    const capital = parseFloat(form.capitalUsdc)
    if (!min || !max || !capital || min <= 0 || max <= min || capital <= 0) return
    const result = calculateGridLevels({
      par: form.par,
      precioMin: min,
      precioMax: max,
      cantidadNiveles: form.cantidadNiveles,
      tipoEspaciado: form.tipoEspaciado,
      capitalUsdc: capital,
      apalancamiento: form.apalancamiento,
      precioActual: useMarketStore.getState().prices[form.par]?.price,
    })
    setCalcResult(result)
  }

  const canCalculate = !!(
    parseFloat(form.precioMin) > 0 &&
    parseFloat(form.precioMax) > parseFloat(form.precioMin) &&
    parseFloat(form.capitalUsdc) > 0
  )

  const handleSave = () => {
    if (!form.nombre.trim()) { setSaveMsg('⚠ Ingresá un nombre'); setTimeout(() => setSaveMsg(''), 2500); return }
    const payload = {
      nombre: form.nombre,
      par: form.par,
      precio_min: parseFloat(form.precioMin) || 0,
      precio_max: parseFloat(form.precioMax) || 0,
      cantidad_niveles: form.cantidadNiveles,
      tipo_espaciado: form.tipoEspaciado,
      capital_usdc: parseFloat(form.capitalUsdc) || 0,
      apalancamiento: form.apalancamiento,
      modo: form.modo,
      es_favorita: false,
    }
    if (selectedConfigId) {
      updateMutation.mutate({ id: selectedConfigId, data: payload })
    } else {
      createMutation.mutate(payload as Omit<GridConfig, 'id' | 'created_at' | 'updated_at'>)
    }
    setTimeout(() => setSaveMsg(''), 2500)
  }

  const loadConfig = (cfg: GridConfig) => {
    setForm({
      nombre: cfg.nombre, par: cfg.par,
      precioMin: String(cfg.precio_min), precioMax: String(cfg.precio_max),
      cantidadNiveles: cfg.cantidad_niveles,
      tipoEspaciado: cfg.tipo_espaciado as 'aritmetico' | 'geometrico',
      capitalUsdc: String(cfg.capital_usdc),
      apalancamiento: cfg.apalancamiento,
      modo: cfg.modo as 'testnet' | 'mainnet',
    })
    setSelectedConfigId(cfg.id)
  }

  return (
    <div className="space-y-4">

      {/* Configs guardadas */}
      {savedConfigs.length > 0 && (
        <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Guardadas</p>
          <div className="flex flex-wrap gap-2">
            {savedConfigs.map(cfg => (
              <button key={cfg.id} onClick={() => loadConfig(cfg)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedConfigId === cfg.id
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-transparent'
                }`}>
                {cfg.es_favorita && <span>★</span>}
                {cfg.nombre} <span className="text-slate-600">·</span> <span className="text-slate-500">{cfg.par}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Formulario */}
      <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl p-4 space-y-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Parámetros</p>

        {/* Par + precio actual */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Par">
            <select value={form.par} onChange={e => setForm({ par: e.target.value })}
              className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50">
              {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Precio actual">
            <div className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm font-mono text-emerald-400">
              {precioActual ? `$${precioActual.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : <span className="text-slate-600">Sin datos</span>}
            </div>
          </Field>
        </div>

        {/* Rango de precios */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio mínimo">
            <NumInput value={form.precioMin} onChange={v => setForm({ precioMin: v })} placeholder="ej: 90000" />
          </Field>
          <Field label="Precio máximo">
            <NumInput value={form.precioMax} onChange={v => setForm({ precioMax: v })} placeholder="ej: 100000" />
          </Field>
        </div>

        {/* Niveles + espaciado */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Niveles" hint="Mínimo 2">
            <input type="number" min="2" step="1" value={form.cantidadNiveles}
              onChange={e => setForm({ cantidadNiveles: Math.max(2, parseInt(e.target.value) || 2) })}
              className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono" />
          </Field>
          <Field label="Espaciado">
            <select value={form.tipoEspaciado} onChange={e => setForm({ tipoEspaciado: e.target.value as 'aritmetico' | 'geometrico' })}
              className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50">
              <option value="geometrico">Geométrico</option>
              <option value="aritmetico">Aritmético</option>
            </select>
          </Field>
        </div>

        {/* Capital */}
        <Field label="Capital USDC">
          <NumInput value={form.capitalUsdc} onChange={v => setForm({ capitalUsdc: v })} placeholder="ej: 500" />
        </Field>

        {/* Apalancamiento */}
        <Field label={`Apalancamiento — ${form.apalancamiento}x`}>
          <div className="flex items-center gap-3 pt-1">
            {[1, 2, 3, 5, 7, 10].map(x => (
              <button key={x} onClick={() => setForm({ apalancamiento: x })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  form.apalancamiento === x
                    ? 'bg-blue-500/25 text-blue-400 border border-blue-500/40'
                    : 'bg-white/5 text-slate-500 hover:bg-white/10'
                }`}>
                {x}x
              </button>
            ))}
          </div>
          <input type="range" min="1" max="10" step="0.5" value={form.apalancamiento}
            onChange={e => setForm({ apalancamiento: parseFloat(e.target.value) })}
            className="w-full mt-2 accent-blue-500" />
        </Field>

        {/* Modo */}
        <div className="flex gap-2">
          {(['testnet', 'mainnet'] as const).map(m => (
            <button key={m} onClick={() => setForm({ modo: m })}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                form.modo === m
                  ? m === 'testnet' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white/5 text-slate-500 border border-transparent hover:bg-white/10'
              }`}>
              {m === 'mainnet' ? '⚠️ ' : ''}
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {/* Botón calcular */}
        <button onClick={handleCalculate} disabled={!canCalculate}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
          <span>⚡</span> Calcular Preview
        </button>
      </div>

      {/* Métricas — visibles apenas hay resultado */}
      {calcResult && (
        <div className="bg-[#0d1117] border border-blue-500/20 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Métricas estimadas</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Ganancia / ciclo', value: `$${calcResult.gananciaTotalCiclo.toFixed(4)}`, color: calcResult.gananciaTotalCiclo > 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'ROI / ciclo', value: `${calcResult.roiPorCiclo.toFixed(4)}%`, color: calcResult.roiPorCiclo > 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Liq. estimada', value: `$${calcResult.precioLiquidacion.toLocaleString('en-US', { maximumFractionDigits: 2 })}`, color: 'text-red-400' },
              { label: 'Capital / nivel', value: `$${calcResult.capitalPorNivel.toFixed(2)}`, color: 'text-slate-200' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#0b0e14] rounded-lg px-3 py-2.5">
                <div className="text-xs text-slate-500 mb-1">{label}</div>
                <div className={`text-sm font-bold font-mono ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {calcResult.advertencias.length > 0 && (
            <div className="space-y-1.5">
              {calcResult.advertencias.map((w, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400">
                  <span className="shrink-0">⚠️</span><span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guardar */}
      <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl p-4 space-y-3">
        <Field label="Nombre de la configuración">
          <input type="text" value={form.nombre} onChange={e => setForm({ nombre: e.target.value })}
            placeholder="ej: BTC Rango Estrecho"
            className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all" />
        </Field>

        <div className="flex gap-2">
          <button onClick={handleSave}
            disabled={!calcResult || createMutation.isPending || updateMutation.isPending}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
            {selectedConfigId ? 'Actualizar' : 'Guardar configuración'}
          </button>
          {selectedConfigId && (
            <button onClick={() => deleteMutation.mutate(selectedConfigId)}
              className="px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm transition-all">
              🗑
            </button>
          )}
          {(selectedConfigId || calcResult) && (
            <button onClick={resetForm}
              className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg text-sm transition-all">
              ✕
            </button>
          )}
        </div>

        {saveMsg && (
          <p className={`text-xs text-center font-medium ${saveMsg.startsWith('⚠') ? 'text-amber-400' : 'text-emerald-400'}`}>
            {saveMsg}
          </p>
        )}
      </div>
    </div>
  )
}
