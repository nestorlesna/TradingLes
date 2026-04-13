import { useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { useMarketStore } from '../store/marketStore'
import { useBotStore } from '../store/botStore'
import type { WsMessage } from '../types'

let wsInstance: WebSocket | null = null
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
let backoff = 1000

function getWsUrl(token: string) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host
  return `${proto}://${host}/ws?token=${token}`
}

export function useWebSocket() {
  const token = useAuthStore((s) => s.token)
  const updatePrice = useMarketStore((s) => s.updatePrice)
  const setWsConnected = useMarketStore((s) => s.setWsConnected)
  const setHyperliquidStatus = useMarketStore((s) => s.setHyperliquidStatus)
  const updateBotStatus = useBotStore((s) => s.updateStatus)
  const addEvent = useBotStore((s) => s.addEvent)
  const isConnected = useMarketStore((s) => s.isWsConnected)

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'price_update':
        updatePrice(msg.par, msg.price)
        break
      case 'connection_status':
        setHyperliquidStatus(msg.hyperliquid)
        break
      case 'bot_state':
        updateBotStatus({
          estado: msg.estado as 'activo' | 'pausado' | 'detenido',
          pnl_realizado: msg.pnl_realizado,
          pnl_no_realizado: msg.pnl_no_realizado,
          precio_liquidacion: msg.precio_liquidacion,
        })
        break
      case 'fill_event':
        addEvent({
          tipo: 'fill',
          mensaje: `${msg.lado === 'buy' ? 'Compra' : 'Venta'} ejecutada nivel ${msg.nivel} @ $${msg.precio.toLocaleString()} (PnL: ${(msg as any).pnl >= 0 ? '+' : ''}${((msg as any).pnl ?? 0).toFixed(4)} USDC)`,
          timestamp: new Date().toISOString(),
        })
        if ((msg as any).pnl_acumulado !== undefined) {
          updateBotStatus({ pnl_realizado: (msg as any).pnl_acumulado })
        }
        break
      case 'order_update':
        updateBotStatus({ ordenes_abiertas: (msg as any).orders })
        break
    }
  }, [updatePrice, setHyperliquidStatus, updateBotStatus, addEvent])

  const connect = useCallback(() => {
    if (!token) return
    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) return

    wsInstance = new WebSocket(getWsUrl(token))

    wsInstance.onopen = () => {
      setWsConnected(true)
      backoff = 1000
    }

    wsInstance.onmessage = (e) => {
      try {
        handleMessage(JSON.parse(e.data))
      } catch {}
    }

    wsInstance.onclose = () => {
      setWsConnected(false)
      wsInstance = null
      reconnectTimeout = setTimeout(() => {
        backoff = Math.min(backoff * 2, 30000)
        connect()
      }, backoff)
    }

    wsInstance.onerror = () => {
      wsInstance?.close()
    }
  }, [token, handleMessage, setWsConnected])

  useEffect(() => {
    if (token) connect()
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [token, connect])

  const send = useCallback((data: object) => {
    if (wsInstance?.readyState === WebSocket.OPEN) {
      wsInstance.send(JSON.stringify(data))
    }
  }, [])

  return { isConnected, send }
}
