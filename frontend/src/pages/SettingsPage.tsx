import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '../api/settings'

type Mode = 'testnet' | 'mainnet'

interface KeyFormState {
  wallet_address: string
  private_key: string
  master_password: string
  confirm_password: string
}

const EMPTY_FORM: KeyFormState = {
  wallet_address: '',
  private_key: '',
  master_password: '',
  confirm_password: '',
}

function KeyCard({ mode }: { mode: Mode }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<KeyFormState>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [showPk, setShowPk] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const { data: walletInfo, isLoading } = useQuery({
    queryKey: ['wallet-info'],
    queryFn: settingsApi.getWalletInfo,
  })

  const info = walletInfo?.[mode]
  const isConfigured = info?.configured ?? false

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  const saveMutation = useMutation({
    mutationFn: settingsApi.saveKey,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['wallet-info'] })
      flash(res.message, true)
      setShowForm(false)
      setForm(EMPTY_FORM)
    },
    onError: (err: any) => {
      flash(err.response?.data?.detail ?? 'Error guardando clave', false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => settingsApi.deleteKey(mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-info'] })
      flash('Clave eliminada', true)
    },
  })

  const handleSave = () => {
    if (!form.wallet_address.startsWith('0x'))
      return flash('La wallet address debe empezar con 0x', false)
    if (!form.private_key)
      return flash('Ingresá la private key', false)
    if (form.master_password.length < 8)
      return flash('La contraseña maestra debe tener al menos 8 caracteres', false)
    if (form.master_password !== form.confirm_password)
      return flash('Las contraseñas no coinciden', false)

    saveMutation.mutate({
      mode,
      master_password: form.master_password,
      private_key: form.private_key,
      wallet_address: form.wallet_address,
    })
  }

  const modeColors = {
    testnet: {
      badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      dot: 'bg-amber-400',
      btn: 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30',
    },
    mainnet: {
      badge: 'bg-red-500/15 text-red-400 border-red-500/30',
      dot: 'bg-red-400',
      btn: 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30',
    },
  }
  const c = modeColors[mode]

  return (
    <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${c.badge}`}>
            {mode.toUpperCase()}
          </span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConfigured ? c.dot : 'bg-slate-600'}`} />
            <span className="text-sm text-slate-400">
              {isLoading ? '...' : isConfigured ? 'Configurado' : 'Sin configurar'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {isConfigured && (
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs transition-all disabled:opacity-40">
              Eliminar
            </button>
          )}
          <button
            onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${c.btn}`}>
            {showForm ? 'Cancelar' : isConfigured ? 'Actualizar clave' : 'Configurar'}
          </button>
        </div>
      </div>

      {/* Wallet address display */}
      {isConfigured && info?.wallet_address && (
        <div className="bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2.5">
          <p className="text-xs text-slate-500 mb-1">Wallet address</p>
          <p className="text-xs font-mono text-slate-300 break-all">{info.wallet_address}</p>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Wallet Address (0x...)
            </label>
            <input
              type="text"
              value={form.wallet_address}
              onChange={e => setForm(f => ({ ...f, wallet_address: e.target.value }))}
              placeholder="0xabc..."
              className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Private Key
            </label>
            <div className="relative">
              <input
                type={showPk ? 'text' : 'password'}
                value={form.private_key}
                onChange={e => setForm(f => ({ ...f, private_key: e.target.value }))}
                placeholder="0x... o 64 hex chars"
                className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 pr-10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPk(!showPk)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">
                {showPk ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Contraseña maestra
              </label>
              <input
                type="password"
                value={form.master_password}
                onChange={e => setForm(f => ({ ...f, master_password: e.target.value }))}
                placeholder="Mín. 8 caracteres"
                className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={form.confirm_password}
                onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                placeholder="Repetir contraseña"
                className="w-full bg-[#0b0e14] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400 space-y-1">
            <p className="font-semibold">Seguridad</p>
            <p>La private key se cifra con Fernet (PBKDF2 + AES-128). La contraseña maestra <strong>nunca se guarda</strong> — se necesita cada vez que iniciás el bot.</p>
          </div>

          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-all disabled:opacity-40">
            {saveMutation.isPending ? 'Guardando...' : 'Guardar clave cifrada'}
          </button>
        </div>
      )}

      {msg && (
        <p className={`text-xs text-center font-medium ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {msg.text}
        </p>
      )}
    </div>
  )
}

export function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-slate-200 font-semibold text-lg">Ajustes</h2>
        <p className="text-slate-500 text-sm mt-1">
          Gestioná las claves privadas para operar en Hyperliquid.
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Claves privadas
        </p>
        <KeyCard mode="testnet" />
        <KeyCard mode="mainnet" />
      </div>

      <div className="bg-[#0d1117] border border-[#1e2433] rounded-xl p-5">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
          Cómo funciona la seguridad
        </p>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">✓</span>
            La private key se cifra con <strong className="text-slate-300">Fernet (AES-128-CBC + HMAC)</strong> derivado de tu contraseña maestra via PBKDF2 (480k iteraciones).
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">✓</span>
            La contraseña maestra <strong className="text-slate-300">nunca se guarda</strong> en ningún lado — la necesitás cada vez que iniciás el bot.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">✓</span>
            El salt Fernet se guarda en la base de datos (tabla <code className="text-slate-300">app_config</code>), no en el código.
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">!</span>
            Si olvidás la contraseña maestra, tenés que re-ingresar la private key y crear una nueva contraseña.
          </li>
        </ul>
      </div>
    </div>
  )
}
