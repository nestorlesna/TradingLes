export interface GridCalcInput {
  par: string
  precioMin: number
  precioMax: number
  cantidadNiveles: number
  tipoEspaciado: 'aritmetico' | 'geometrico'
  capitalUsdc: number
  apalancamiento: number
  precioActual?: number
}

export interface GridLevel {
  nivel: number
  precio: number
  tipo: 'buy' | 'sell'
  capital: number
  cantidad: number
  gananciaBruta: number
  comision: number
  gananciaNeta: number
}

export interface GridCalcResult {
  niveles: GridLevel[]
  precioLiquidacion: number
  gananciaTotalCiclo: number
  roiPorCiclo: number
  capitalPorNivel: number
  advertencias: string[]
}

const COMMISSION_MAKER = 0.0001
const COMMISSION_TAKER = 0.00035
const MAINTENANCE_MARGIN = 0.005
const MIN_CAPITAL = 10

export function calculateGridLevels(cfg: GridCalcInput): GridCalcResult {
  const advertencias: string[] = []

  if (cfg.precioMin <= 0 || cfg.precioMax <= cfg.precioMin || cfg.cantidadNiveles < 2) {
    return { niveles: [], precioLiquidacion: 0, gananciaTotalCiclo: 0, roiPorCiclo: 0, capitalPorNivel: 0, advertencias }
  }

  // Calcular precios de niveles
  const precios: number[] = []
  if (cfg.tipoEspaciado === 'aritmetico') {
    const step = (cfg.precioMax - cfg.precioMin) / (cfg.cantidadNiveles - 1)
    for (let i = 0; i < cfg.cantidadNiveles; i++) {
      precios.push(cfg.precioMin + step * i)
    }
  } else {
    const ratio = Math.pow(cfg.precioMax / cfg.precioMin, 1 / (cfg.cantidadNiveles - 1))
    for (let i = 0; i < cfg.cantidadNiveles; i++) {
      precios.push(cfg.precioMin * Math.pow(ratio, i))
    }
  }

  // Precio de liquidación
  const precioLiquidacion = cfg.precioMin * (1 - 1 / cfg.apalancamiento + MAINTENANCE_MARGIN)

  // Capital por nivel
  const capitalPorNivel = cfg.capitalUsdc / cfg.cantidadNiveles
  const capitalApalancado = capitalPorNivel * cfg.apalancamiento

  if (capitalPorNivel < MIN_CAPITAL) {
    advertencias.push(`Capital por nivel ($${capitalPorNivel.toFixed(2)}) es menor al mínimo recomendado ($${MIN_CAPITAL})`)
  }

  const mitad = (cfg.precioMin + cfg.precioMax) / 2

  const niveles: GridLevel[] = precios.map((precio, i) => {
    const cantidad = parseFloat((capitalApalancado / precio).toFixed(5))
    const diff = i < precios.length - 1 ? Math.abs(precios[i + 1] - precio) : Math.abs(precio - precios[i - 1])
    const gananciaBruta = diff * cantidad
    const comision = capitalApalancado * (COMMISSION_MAKER + COMMISSION_TAKER)
    const gananciaNeta = gananciaBruta - comision
    const tipo: 'buy' | 'sell' = cfg.precioActual !== undefined
      ? precio <= cfg.precioActual ? 'buy' : 'sell'
      : precio <= mitad ? 'buy' : 'sell'

    if (precio <= precioLiquidacion) {
      advertencias.push(`Nivel ${i + 1} ($${precio.toLocaleString()}) está por debajo del precio de liquidación`)
    }

    return { nivel: i + 1, precio, tipo, capital: capitalPorNivel, cantidad, gananciaBruta, comision, gananciaNeta }
  })

  const gananciaTotalCiclo = niveles.reduce((sum, n) => sum + n.gananciaNeta, 0)
  const roiPorCiclo = cfg.capitalUsdc > 0 ? (gananciaTotalCiclo / cfg.capitalUsdc) * 100 : 0

  if (gananciaTotalCiclo <= 0) {
    advertencias.push('La ganancia neta por ciclo completo es negativa (comisiones superan ganancias)')
  }

  // Deduplicar advertencias
  return {
    niveles,
    precioLiquidacion,
    gananciaTotalCiclo,
    roiPorCiclo,
    capitalPorNivel,
    advertencias: [...new Set(advertencias)],
  }
}
