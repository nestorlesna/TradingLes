from dataclasses import dataclass, field
from decimal import Decimal, ROUND_DOWN

# Comisiones Hyperliquid
COMMISSION_MAKER = Decimal("0.0001")   # 0.01%
COMMISSION_TAKER = Decimal("0.00035")  # 0.035%
MAINTENANCE_MARGIN = Decimal("0.005")  # 0.5%
MIN_CAPITAL_PER_LEVEL = Decimal("10")  # USDC mínimo por nivel


@dataclass
class GridLevel:
    nivel: int
    precio: Decimal
    tipo: str           # 'buy' | 'sell'
    capital: Decimal
    cantidad: Decimal
    ganancia_bruta: Decimal
    comision: Decimal
    ganancia_neta: Decimal


@dataclass
class GridCalcInput:
    par: str
    precio_min: Decimal
    precio_max: Decimal
    cantidad_niveles: int
    tipo_espaciado: str   # 'aritmetico' | 'geometrico'
    capital_usdc: Decimal
    apalancamiento: Decimal
    precio_actual: Decimal | None = None


@dataclass
class GridCalcResult:
    niveles: list[GridLevel]
    precio_liquidacion: Decimal
    ganancia_total_ciclo: Decimal
    roi_por_ciclo: Decimal
    capital_por_nivel: Decimal
    advertencias: list[str]


def calculate_grid_levels(cfg: GridCalcInput) -> GridCalcResult:
    advertencias: list[str] = []

    # --- Calcular precios de los niveles ---
    if cfg.tipo_espaciado == "aritmetico":
        step = (cfg.precio_max - cfg.precio_min) / (cfg.cantidad_niveles - 1)
        precios = [cfg.precio_min + step * i for i in range(cfg.cantidad_niveles)]
    else:  # geometrico
        ratio = (cfg.precio_max / cfg.precio_min) ** (Decimal(1) / (cfg.cantidad_niveles - 1))
        precios = [cfg.precio_min * (ratio ** i) for i in range(cfg.cantidad_niveles)]

    # --- Precio de liquidación (posición LONG con apalancamiento) ---
    # Usando precio_min como precio de entrada estimado (peor caso)
    precio_entrada = cfg.precio_min
    precio_liq = precio_entrada * (1 - Decimal(1) / cfg.apalancamiento + MAINTENANCE_MARGIN)

    # --- Capital por nivel ---
    capital_por_nivel = cfg.capital_usdc / cfg.cantidad_niveles
    capital_apalancado = capital_por_nivel * cfg.apalancamiento

    if capital_por_nivel < MIN_CAPITAL_PER_LEVEL:
        advertencias.append(
            f"Capital por nivel (${float(capital_por_nivel):.2f}) es menor al mínimo recomendado (${float(MIN_CAPITAL_PER_LEVEL)})"
        )

    # --- Construir niveles ---
    niveles: list[GridLevel] = []
    for i, precio in enumerate(precios):
        cantidad = (capital_apalancado / precio).quantize(Decimal("0.00001"), rounding=ROUND_DOWN)

        # Ganancia bruta: diferencia con el nivel siguiente (o anterior para el último)
        if i < len(precios) - 1:
            diff = abs(precios[i + 1] - precio)
        else:
            diff = abs(precio - precios[i - 1])

        ganancia_bruta = diff * cantidad
        comision = capital_apalancado * (COMMISSION_MAKER + COMMISSION_TAKER)
        ganancia_neta = ganancia_bruta - comision

        # Tipo: por debajo del precio actual → buy; por encima → sell
        if cfg.precio_actual is not None:
            tipo = "buy" if precio <= cfg.precio_actual else "sell"
        else:
            # Sin precio actual: mitad inferior buy, mitad superior sell
            mitad = (cfg.precio_min + cfg.precio_max) / 2
            tipo = "buy" if precio <= mitad else "sell"

        # Advertencia si nivel está por debajo del precio de liquidación
        if precio <= precio_liq:
            advertencias.append(
                f"Nivel {i + 1} (${float(precio):,.2f}) está por debajo del precio de liquidación"
            )

        niveles.append(GridLevel(
            nivel=i + 1,
            precio=precio,
            tipo=tipo,
            capital=capital_por_nivel,
            cantidad=cantidad,
            ganancia_bruta=ganancia_bruta,
            comision=comision,
            ganancia_neta=ganancia_neta,
        ))

    # --- Totales ---
    ganancia_total = sum(n.ganancia_neta for n in niveles)
    roi_ciclo = (ganancia_total / cfg.capital_usdc * 100) if cfg.capital_usdc > 0 else Decimal(0)

    if ganancia_total <= 0:
        advertencias.append("La ganancia neta por ciclo completo es negativa (comisiones superan ganancias)")

    return GridCalcResult(
        niveles=niveles,
        precio_liquidacion=precio_liq,
        ganancia_total_ciclo=ganancia_total,
        roi_por_ciclo=roi_ciclo,
        capital_por_nivel=capital_por_nivel,
        advertencias=list(dict.fromkeys(advertencias)),  # deduplica manteniendo orden
    )
