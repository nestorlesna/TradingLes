import { useEffect, useRef } from 'react'
import { useGridStore } from '../store/gridStore'
import { useMarketStore } from '../store/marketStore'
import { calculateGridLevels } from '../utils/gridCalculations'

export function useGridCalc() {
  const form = useGridStore((s) => s.form)
  const setCalcResult = useGridStore((s) => s.setCalcResult)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const min = parseFloat(form.precioMin)
      const max = parseFloat(form.precioMax)
      const capital = parseFloat(form.capitalUsdc)

      if (!min || !max || !capital || min <= 0 || max <= min || capital <= 0) {
        setCalcResult(null)
        return
      }

      // Leer precio actual en el momento del cálculo, sin suscribirse a cambios
      const precioActual = useMarketStore.getState().prices[form.par]?.price

      const result = calculateGridLevels({
        par: form.par,
        precioMin: min,
        precioMax: max,
        cantidadNiveles: form.cantidadNiveles,
        tipoEspaciado: form.tipoEspaciado,
        capitalUsdc: capital,
        apalancamiento: form.apalancamiento,
        precioActual,
      })

      setCalcResult(result)
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [form, setCalcResult]) // prices NO está aquí — se lee con getState() en el callback
}
