import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useBotStore } from '../../store/botStore'
import { useGridStore } from '../../store/gridStore'
import { botApi } from '../../api/bot'
import type { BotOrder } from '../../types'

// ── Status badge ─────────────────────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    activo: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    pausado: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    detenido: 'bg-slate-700/50 text-slate-400 border-slate-600/30',
  }
  const labels: Record<string, string> = {
    activo: 'Activo',
    pausado: 'Pausado',
    detenido: 'Detenido',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${map[estado] ?? map.detenido}`}>
      {labels[estado] ?? estado}
    </span>
  )
}

// ── Password modal ────────────────────────────────────────────────────────────
function PasswordModal({
  onConfirm,
  onClose,
  isLoading,
}: {
  onConfirm: (pw: string) => void
  onClose: () => void
  isLoading: boolean
}) {
  const [pw, setPw] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1117] border border-[#1e2433] rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-slate-200 font-semibold text-base">Contraseña maestra</h3>
        <p className="text-slate-400 text-sm">
          Ingresá tu contraseña maestra para descifrar la private key y conectar al exchange.
        </p>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && pw.length >= 8 && onConfirm(pw)}
          placeholder="Contraseña maestra"
          className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg text-sm transition-all">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(pw)}
            disabled={pw.length < 8 || isLoading}
            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-40">
            {isLoading ? 'Iniciando...' : 'Iniciar bot'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function BotPanel() {
  const qc = useQueryClient()
  const [showPwModal, setShowPwModal] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const selectedConfigId = useGridStore(s => s.selectedConfigId)

  const botStatus = useBotStore(s => s.status)
  const events = useBotStore(s => s.events)
  const updateStatus = useBotStore(s => s.updateStatus)

  const { data: status, refetch } = useQuery({
    queryKey: ['bot-status'],
    queryFn: botApi.getStatus,
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (status) updateStatus(status)
  }, [status, updateStatus])

  const currentStatus = status ?? botStatus
  const estado = currentStatus.estado ?? 'detenido'
  const isRunning = estado === 'activo'
  const isPaused = estado === 'pausado'
  const isStopped = estado === 'detenido'

  const startMutation = useMutation({
    mutationFn: ({ pw }: { pw: string }) =>
      botApi.start(selectedConfigId!, pw),
    onSuccess: (data) => {
      setShowPwModal(false)
      updateStatus({ session_id: data.session_id, estado: 'activo' })
      qc.invalidateQueries({ queryKey: ['bot-status'] })
    },
    onError: (err: any) => {
      setErrMsg(err.response?.data?.detail ?? 'Error iniciando bot')
      setTimeout(() => setErrMsg(''), 4000)
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => botApi.stop(currentStatus.session_id!),
    onSuccess: () => {
      updateStatus({ estado: 'detenido', session_id: null })
      qc.invalidateQueries({ queryKey: ['bot-status'] })
    },
  })

  const pauseMutation = useMutation({
    mutationFn: () => botApi.pause(currentStatus.session_id!),
    onSuccess: () => {
      updateStatus({ estado: 'pausado' })
      qc.invalidateQueries({ queryKey: ['bot-status'] })
    },
  })

  const resumeMutation = useMutation({
    mutationFn: () => botApi.resume(currentStatus.session_id!),
    onSuccess: () => {
      updateStatus({ estado: 'activo' })
      qc.invalidateQueries({ queryKey: ['bot-status'] })
    },
  })

  const openOrders: BotOrder[] = currentStatus.ordenes_abiertas ?? []
  const pnl = currentStatus.pnl_realizado ?? 0

  return (
    <>
      {showPwModal && (
        <PasswordModal
          onConfirm={(pw) => startMutation.mutate({ pw })}
          onClose={() => setShowPwModal(false)}
          isLoading={startMutation.isPending}
        />
      )}

      <div className="space-y-3">
        {/* Status bar */}
        <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Bot</p>
              <EstadoBadge estado={estado} />
              {isRunning && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-slate-500">live</span>
                </span>
              )}
            </div>
            <button onClick={() => refetch()} className="text-slate-600 hover:text-slate-400 text-xs transition-all">
              ↻
            </button>
          </div>

          {/* PnL */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-[#0b0e14] rounded-lg px-3 py-2.5">
              <p className="text-xs text-slate-500 mb-1">PnL realizado</p>
              <p className={`text-sm font-bold font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)} USDC
              </p>
            </div>
            <div className="bg-[#0b0e14] rounded-lg px-3 py-2.5">
              <p className="text-xs text-slate-500 mb-1">Órdenes abiertas</p>
              <p className="text-sm font-bold font-mono text-slate-200">{openOrders.length}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {isStopped && (
              <button
                onClick={() => {
                  if (!selectedConfigId) {
                    setErrMsg('Seleccioná una configuración guardada primero')
                    setTimeout(() => setErrMsg(''), 3000)
                    return
                  }
                  setShowPwModal(true)
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-500/20">
                <span>▶</span> Iniciar bot
              </button>
            )}

            {isRunning && (
              <>
                <button
                  onClick={() => pauseMutation.mutate()}
                  disabled={pauseMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-sm font-semibold py-2.5 rounded-lg transition-all disabled:opacity-40">
                  <span>⏸</span> Pausar
                </button>
                <button
                  onClick={() => stopMutation.mutate()}
                  disabled={stopMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-sm font-semibold py-2.5 rounded-lg transition-all disabled:opacity-40">
                  <span>■</span> Detener
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-sm font-semibold py-2.5 rounded-lg transition-all disabled:opacity-40">
                  <span>▶</span> Reanudar
                </button>
                <button
                  onClick={() => stopMutation.mutate()}
                  disabled={stopMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-sm font-semibold py-2.5 rounded-lg transition-all disabled:opacity-40">
                  <span>■</span> Detener
                </button>
              </>
            )}
          </div>

          {errMsg && (
            <p className="text-xs text-red-400 text-center mt-2">{errMsg}</p>
          )}
        </div>

        {/* Open orders */}
        {openOrders.length > 0 && (
          <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              Órdenes abiertas
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {openOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between bg-[#0b0e14] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      o.lado === 'buy'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}>
                      {o.lado.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500">Nv.{o.nivel}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-slate-200">
                      ${o.precio.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                    </p>
                    <p className="text-xs text-slate-600">{o.cantidad} cont.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event log */}
        {events.length > 0 && (
          <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              Eventos recientes
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {events.slice(0, 20).map((ev, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-slate-600 shrink-0 font-mono">
                    {new Date(ev.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`${ev.tipo === 'fill' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {ev.mensaje}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
