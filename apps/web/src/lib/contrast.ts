/**
 * Contraste WCAG 2.x entre dos colores, usando la fórmula de luminancia relativa
 * (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance) y la razón de contraste
 * (https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio).
 *
 * Solo entiende colores hexadecimales (`#rgb` o `#rrggbb`). No interpreta `oklch()`,
 * `rgb()`, `hsl()` ni nombres de color CSS: para esos casos usar el color hex
 * equivalente o verificar el contraste manualmente (p. ej. con Chrome DevTools).
 */

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function parseHex(hex: string): [number, number, number] {
  const match = HEX_RE.exec(hex.trim())
  if (!match) {
    throw new Error(
      `contrastRatio: "${hex}" no es un color hexadecimal (#rgb o #rrggbb); oklch/rgb/hsl/nombres no están soportados`,
    )
  }
  let digits = match[1]!
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((c) => c + c)
      .join('')
  }
  const n = Number.parseInt(digits, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function channelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rl, gl, bl] = [r, g, b].map(channelToLinear)
  return 0.2126 * rl! + 0.7152 * gl! + 0.0722 * bl!
}

/** Razón de contraste WCAG entre dos colores hex, de 1 (sin contraste) a 21 (negro/blanco). */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(parseHex(hexA))
  const lumB = relativeLuminance(parseHex(hexB))
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA]
  return (lighter + 0.05) / (darker + 0.05)
}
