import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts'
import { useMarketStore } from '../../store/marketStore'
import { marketApi } from '../../api/market'
import type { Candle } from '../../types'

interface Props {
  par: string
  timeframe: string
}

function toChartCandle(c: Candle): CandlestickData<Time> {
  return {
    time: Math.floor(c.timestamp / 1000) as Time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }
}

export function CandlestickChart({ par, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastCandleRef = useRef<CandlestickData<Time> | null>(null)

  const prices = useMarketStore((s) => s.prices)
  const currentPrice = prices[par]?.price

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#64748b',
        fontSize: 11,
        fontFamily: "'Inter', system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: '#1e2433' },
        horzLines: { color: '#1e2433' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3b82f6', labelBackgroundColor: '#1e40af' },
        horzLine: { color: '#3b82f6', labelBackgroundColor: '#1e40af' },
      },
      rightPriceScale: {
        borderColor: '#1e2433',
        textColor: '#64748b',
      },
      timeScale: {
        borderColor: '#1e2433',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: 480,
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Load historical candles when pair/timeframe changes
  useEffect(() => {
    if (!seriesRef.current) return
    let cancelled = false

    seriesRef.current.setData([])
    lastCandleRef.current = null

    marketApi.getCandles(par, timeframe).then(candles => {
      if (cancelled || !seriesRef.current) return
      const data = candles.map(toChartCandle)
      seriesRef.current.setData(data)
      if (data.length > 0) {
        lastCandleRef.current = data[data.length - 1]
      }
      chartRef.current?.timeScale().fitContent()
    }).catch(console.error)

    return () => { cancelled = true }
  }, [par, timeframe])

  // Update last candle with real-time price
  useEffect(() => {
    if (!seriesRef.current || !currentPrice || !lastCandleRef.current) return

    const updatedCandle = {
      ...lastCandleRef.current,
      close: currentPrice,
      high: Math.max(lastCandleRef.current.high as number, currentPrice),
      low: Math.min(lastCandleRef.current.low as number, currentPrice),
    }
    seriesRef.current.update(updatedCandle)
    lastCandleRef.current = updatedCandle
  }, [currentPrice])

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />
    </div>
  )
}
