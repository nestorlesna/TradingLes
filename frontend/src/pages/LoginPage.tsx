import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [isSetup, setIsSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' })

  useEffect(() => {
    if (isAuthenticated) { navigate('/dashboard'); return }
    authApi.hasUsers().then(({ has_users }) => {
      setIsSetup(!has_users)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (isSetup && form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    setSubmitting(true)
    try {
      if (isSetup) {
        await authApi.setup(form.username, form.password)
      }
      const { access_token } = await authApi.login(form.username, form.password)
      setAuth(access_token, form.username)
      navigate('/dashboard')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr.response?.data?.detail ?? 'Error al iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/5 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm mx-4">
        {/* Card */}
        <div className="bg-[#0d1117]/90 border border-[#1e2433] rounded-2xl shadow-2xl shadow-black/50 backdrop-blur-sm overflow-hidden">
          {/* Top accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

          <div className="p-8">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-500/30 mb-4">
                T
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">TradingLes</h1>
              <p className="text-slate-500 text-sm mt-1">
                {isSetup ? 'Crear cuenta de administrador' : 'Iniciar sesión'}
              </p>
            </div>

            {isSetup && (
              <div className="mb-6 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs text-center">
                Primera configuración — crea tu cuenta
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Usuario</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="tu_usuario"
                  required
                  autoFocus
                  className="w-full bg-[#131b2e] border border-[#1e2433] rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Contraseña</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#131b2e] border border-[#1e2433] rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {isSetup && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirmar contraseña</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    required
                    className="w-full bg-[#131b2e] border border-[#1e2433] rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isSetup ? 'Creando cuenta...' : 'Iniciando sesión...'}
                  </span>
                ) : (
                  isSetup ? 'Crear cuenta' : 'Iniciar sesión'
                )}
              </button>
            </form>
          </div>

          {/* Bottom accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
          <div className="px-8 py-4 text-center">
            <span className="text-slate-600 text-xs">Grid Trading Bot para Hyperliquid</span>
          </div>
        </div>
      </div>
    </div>
  )
}
