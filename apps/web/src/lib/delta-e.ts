import { parseHex } from './contrast'

/**
 * Diferencia de color CIE76 (ΔE*ab): distancia euclídea entre dos colores en CIELAB, con blanco
 * de referencia D65 (el de sRGB). Como `contrastRatio`, solo entiende hex (`#rgb`/`#rrggbb`).
 * Sirve para comprobar que dos colores que se ven juntos (los cubos de antigüedad, UX5-10) no se
 * confunden: por debajo de ~10 se leen como el mismo tono.
 */
export function deltaE76(hexA: string, hexB: string): number {
  const [l1, a1, b1] = toLab(parseHex(hexA))
  const [l2, a2, b2] = toLab(parseHex(hexB))
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

/** Blanco de referencia D65 (X, Y, Z). */
const WHITE = [0.95047, 1, 1.08883] as const

function toLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function labF(t: number): number {
  return t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29
}

function toLab(rgb: [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb.map(toLinear) as [number, number, number]
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE[0]
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / WHITE[1]
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE[2]
  const [fx, fy, fz] = [labF(x), labF(y), labF(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
