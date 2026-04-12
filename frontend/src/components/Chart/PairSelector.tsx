import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { marketApi } from '../../api/market'
import { useMarketStore } from '../../store/marketStore'

const POPULAR = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'ARB']

export function PairSelector() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = useMarketStore((s) => s.selectedPair)
  const setPair = useMarketStore((s) => s.setSelectedPair)
  const prices = useMarketStore((s) => s.prices)

  const { data: pairs = [] } = useQuery({
    queryKey: ['pairs'],
    queryFn: marketApi.getPairs,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = pairs.filter(p => p.toLowerCase().includes(search.toLowerCase()))
  const currentPrice = prices[selected]
  const direction = prices[selected]?.direction

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 bg-[#0d1117] border border-[#1e2433] hover:border-blue-500/30 rounded-xl px-4 py-2.5 transition-all duration-150"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
            {selected[0]}
          </div>
          <div className="text-left">
            <div className="text-white font-bold text-base leading-none">{selected}<span className="text-slate-500 font-normal text-sm">-PERP</span></div>
            {currentPrice && (
              <div className={`text-xs font-mono mt-0.5 ${direction === 'up' ? 'text-emerald-400' : direction === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
                ${currentPrice.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </div>
            )}
          </div>
        </div>
        <span className={`text-slate-500 text-xs ml-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-[#0d1117] border border-[#1e2433] rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <div className="p-2 border-b border-[#1e2433]">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar par..."
              autoFocus
              className="w-full bg-[#131b2e] border border-[#1e2433] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40"
            />
          </div>

          {!search && (
            <div className="p-2 border-b border-[#1e2433]">
              <div className="text-xs text-slate-600 px-2 mb-1">Populares</div>
              <div className="flex flex-wrap gap-1">
                {POPULAR.filter(p => pairs.includes(p)).map(p => (
                  <button
                    key={p}
                    onClick={() => { setPair(p); setOpen(false); setSearch('') }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      p === selected ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-52 overflow-y-auto">
            {filtered.slice(0, 50).map(p => {
              const price = prices[p]
              return (
                <button
                  key={p}
                  onClick={() => { setPair(p); setOpen(false); setSearch('') }}
                  className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-all hover:bg-white/5 ${
                    p === selected ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300'
                  }`}
                >
                  <span className="font-medium">{p}</span>
                  {price && (
                    <span className={`text-xs font-mono ${
                      price.direction === 'up' ? 'text-emerald-400' :
                      price.direction === 'down' ? 'text-red-400' : 'text-slate-500'
                    }`}>
                      ${price.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
