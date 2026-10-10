import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from './contrast'

/**
 * Lee los tokens de color del tema claro directamente de `index.css` (no de
 * `@theme inline`, que solo los referencia) para verificar contraste WCAG AA
 * (≥ 4.5:1 para texto normal) sin depender de un navegador.
 *
 * El bloque `.dark` usa `oklch()`, que `contrastRatio` no interpreta a propósito
 * (ver `contrast.ts`); su contraste se verifica a mano en Chrome DevTools
 * (`emulate` con `colorScheme: 'dark'`), no aquí.
 */

const cssPath = join(import.meta.dirname, '../index.css')
const css = readFileSync(cssPath, 'utf8')

function extractBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`No se encontró el bloque "${selector}" en index.css`)
  const end = css.indexOf('}', start)
  return css.slice(start, end)
}

function extractToken(block: string, name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,6})`).exec(block)
  if (!match) throw new Error(`No se encontró el token "${name}" (¿usa oklch()?)`)
  return match[1]!
}

const lightBlock = extractBlock(css, ':root')
const destructive = extractToken(lightBlock, '--destructive')
const background = extractToken(lightBlock, '--background')
const foreground = extractToken(lightBlock, '--foreground')
const card = extractToken(lightBlock, '--card')
const waxAmber = extractToken(lightBlock, '--wax-amber')
const waxAmberInk = extractToken(lightBlock, '--wax-amber-ink')

/** Extrae la opacidad de fondo real que usa `Badge variant="destructive"` en modo claro
 * (p. ej. `bg-destructive/10`, sin el prefijo `dark:`), para componer el color real de la insignia. */
function extractBadgeDestructiveAlpha(): number {
  const badgeSource = readFileSync(join(import.meta.dirname, '../components/ui/badge.tsx'), 'utf8')
  const match = /(?<!dark:)bg-destructive\/(\d+)/.exec(badgeSource)
  if (!match) throw new Error('No se encontró "bg-destructive/NN" en badge.tsx')
  return Number.parseInt(match[1]!, 10) / 100
}

/** Las clases de la variante `destructive-solid` de `Button` (UX5-07), leídas de `button.tsx`. */
function solidDestructiveClasses(): string {
  const source = readFileSync(join(import.meta.dirname, '../components/ui/button.tsx'), 'utf8')
  const match = /'destructive-solid':\s*'([^']+)'/.exec(source)
  if (!match) throw new Error('No se encontró la variante "destructive-solid" en button.tsx')
  return match[1]!
}

function mixHex(foreground: string, alpha: number, background: string): string {
  const parse = (hex: string) => {
    const n = Number.parseInt(hex.replace('#', ''), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const [fr, fg, fb] = parse(foreground)
  const [br, bg, bb] = parse(background)
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha))
  return `#${[mix(fr!, br!), mix(fg!, bg!), mix(fb!, bb!)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`
}

describe('tokens de color del tema claro (index.css)', () => {
  it('foreground sobre background cumple AA (>= 4.5:1)', () => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5)
  })

  it('el texto destructivo (mensajes de error, "text-destructive") cumple AA sobre background', () => {
    expect(contrastRatio(destructive, background)).toBeGreaterThanOrEqual(4.5)
  })

  it('la insignia destructiva ("Bloqueado" de Usuarios, Badge variant="destructive") cumple AA sobre su propio fondo', () => {
    const alpha = extractBadgeDestructiveAlpha()
    const badgeBackground = mixHex(destructive, alpha, background)
    expect(contrastRatio(destructive, badgeBackground)).toBeGreaterThanOrEqual(4.5)
  })

  // I-3 (ronda de fixes 1, T12): `--wax-amber` (#d99a16) es un acento, no un color de texto —
  // como texto sobre su propio fondo (`bg-[color:var(--wax-amber)]/10`, los tres avisos "Vence
  // hoy" en `my-cases.tsx` y "En espera"/"Para aceptar falta" en `case-header.tsx`, siempre
  // dentro de una `Card`/tarjeta con `bg-card`) da 2,25:1, muy por debajo de AA. `--wax-amber-ink`
  // es la tinta oscura para ese mismo texto; el fondo real que compone la insignia es
  // `--wax-amber` al 10 % sobre `--card` (no sobre `--background`: los tres usos viven dentro de
  // una tarjeta), igual que la insignia destructiva de arriba compone sobre su propio fondo.
  it('el texto "Vence hoy"/"En espera"/"Para aceptar falta" (--wax-amber-ink) cumple AA sobre su propio fondo', () => {
    const badgeBackground = mixHex(waxAmber, 0.1, card)
    expect(contrastRatio(waxAmberInk, badgeBackground)).toBeGreaterThanOrEqual(4.5)
  })

  // UX3-01: el icono "Vence hoy" de `cases-table.tsx` (tabla de trabajos) no es texto sino
  // un gráfico (WCAG 1.4.11, contraste de componentes no textuales >= 3:1), y se pinta
  // directo sobre `--card` (la fila/tarjeta), no sobre el fondo ámbar al 10 % de las
  // insignias de arriba. `--wax-amber` (#d99a16) solo da 2,45:1 ahí, por debajo del 3:1
  // exigido; `--wax-amber-ink`, la misma tinta que ya cumple AA como texto, también resuelve
  // el icono.
  it('el icono "Vence hoy" (--wax-amber-ink) cumple el contraste gráfico AA (>= 3:1) sobre --card', () => {
    expect(contrastRatio(waxAmberInk, card)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(waxAmber, card)).toBeLessThan(3)
  })

  // UX5-07: el botón que confirma una acción destructiva es rojo sólido con texto blanco. El
  // texto cumple AA sobre el rojo y sobre el rojo del hover (compuesto sobre el pie blanco del
  // diálogo, `--card`).
  it('el texto blanco del destructivo sólido cumple AA sobre su fondo, también en hover', () => {
    const classes = solidDestructiveClasses().split(/\s+/)
    expect(classes).toContain('bg-destructive')
    expect(classes).toContain('text-white')
    expect(contrastRatio('#ffffff', destructive)).toBeGreaterThanOrEqual(4.5)
    const hover = classes.find((c) => /^hover:bg-destructive\/\d+$/.test(c))
    expect(hover).toBeDefined()
    const alpha = Number.parseInt(hover!.split('/')[1]!, 10) / 100
    expect(contrastRatio('#ffffff', mixHex(destructive, alpha, card))).toBeGreaterThanOrEqual(4.5)
  })
})
