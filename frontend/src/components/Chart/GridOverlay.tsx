import { useEffect, useRef, type RefObject } from 'react'
import type { ISeriesApi, IPriceLine } from 'lightweight-charts'
import { useGridStore } from '../../store/gridStore'

export function useGridOverlay(
  seriesRef: RefObject<ISeriesApi<'Candlestick'> | null>,
  enabled: boolean
) {
  const calcResult = useGridStore((s) => s.calcResult)
  const linesRef = useRef<IPriceLine[]>([])

  useEffect(() => {
    const series = seriesRef.current
    if (!series || !enabled) return

    // Limpiar líneas anteriores
    linesRef.current.forEach(line => { try { series.removePriceLine(line) } catch {} })
    linesRef.current = []

    if (!calcResult || calcResult.niveles.length === 0) return

    // Líneas de niveles
    calcResult.niveles.forEach(nivel => {
      const isBuy = nivel.tipo === 'buy'
      const line = series.createPriceLine({
        price: nivel.precio,
        color: isBuy ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)',
        lineWidth: 1,
        lineStyle: 3, // dashed
        axisLabelVisible: true,
        title: `${isBuy ? 'B' : 'S'}${nivel.nivel}`,
      })
      linesRef.current.push(line)
    })

    // Línea de liquidación
    const liqLine = series.createPriceLine({
      price: calcResult.precioLiquidacion,
      color: 'rgba(239, 68, 68, 1)',
      lineWidth: 2,
      lineStyle: 1, // dotted
      axisLabelVisible: true,
      title: '⚡ LIQ',
    })
    linesRef.current.push(liqLine)

    return () => {
      linesRef.current.forEach(line => { try { series.removePriceLine(line) } catch {} })
      linesRef.current = []
    }
  }, [seriesRef, calcResult, enabled])
}
