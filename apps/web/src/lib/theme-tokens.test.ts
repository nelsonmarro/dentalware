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

/** Extrae la opacidad de fondo real que usa `Badge variant="destructive"` en modo claro
 * (p. ej. `bg-destructive/10`, sin el prefijo `dark:`), para componer el color real de la insignia. */
function extractBadgeDestructiveAlpha(): number {
  const badgeSource = readFileSync(join(import.meta.dirname, '../components/ui/badge.tsx'), 'utf8')
  const match = /(?<!dark:)bg-destructive\/(\d+)/.exec(badgeSource)
  if (!match) throw new Error('No se encontró "bg-destructive/NN" en badge.tsx')
  return Number.parseInt(match[1]!, 10) / 100
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
})
