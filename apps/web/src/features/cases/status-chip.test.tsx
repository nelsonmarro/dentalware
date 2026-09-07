import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CASE_STATUSES } from '@dentalware/shared'
import { contrastRatio } from '@/lib/contrast'
import { STATUS_COLOR, StatusChip } from './status-chip'

describe('StatusChip', () => {
  it('muestra el texto en español y el color del estado', () => {
    render(<StatusChip status="en_proceso" />)
    const chip = screen.getByText('En proceso')
    expect(chip).toHaveAttribute('data-status', 'en_proceso')
    expect(chip).toHaveStyle({ '--chip': '#0F766E' })
  })
})

/**
 * Contraste AA del texto de cada chip de estado sobre su propio fondo real
 * (`bg-[color:var(--chip)]/NN` sobre la tarjeta blanca `--card`, que es donde
 * `StatusChip` se usa hoy: filas de la tabla de trabajos y la ficha). La
 * opacidad de fondo se lee del propio componente, no se asume, para que el
 * test siga siendo válido si alguien cambia el `/10` por otro valor.
 */
function extractChipBackgroundAlpha(): number {
  const source = readFileSync(join(import.meta.dirname, './status-chip.tsx'), 'utf8')
  const match = /bg-\[color:var\(--chip\)\]\/(\d+)/.exec(source)
  if (!match) throw new Error('No se encontró "bg-[color:var(--chip)]/NN" en status-chip.tsx')
  return Number.parseInt(match[1]!, 10) / 100
}

function extractCardToken(): string {
  const css = readFileSync(join(import.meta.dirname, '../../index.css'), 'utf8')
  const start = css.indexOf(':root {')
  const end = css.indexOf('}', start)
  const block = css.slice(start, end)
  const match = /--card:\s*(#[0-9a-fA-F]{3,6})/.exec(block)
  if (!match) throw new Error('No se encontró el token "--card" en index.css')
  return match[1]!
}

function extractDestructiveToken(): string {
  const css = readFileSync(join(import.meta.dirname, '../../index.css'), 'utf8')
  const start = css.indexOf(':root {')
  const end = css.indexOf('}', start)
  const block = css.slice(start, end)
  const match = /--destructive:\s*(#[0-9a-fA-F]{3,6})/.exec(block)
  if (!match) throw new Error('No se encontró el token "--destructive" en index.css')
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

describe('STATUS_COLOR (contraste AA del texto de cada chip de estado)', () => {
  const alpha = extractChipBackgroundAlpha()
  const card = extractCardToken()

  for (const status of CASE_STATUSES) {
    it(`${status}: el color de texto cumple AA (>= 4.5:1) sobre el fondo real del chip`, () => {
      const color = STATUS_COLOR[status]
      const chipBackground = mixHex(color, alpha, card)
      expect(contrastRatio(color, chipBackground)).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('cancelado usa el mismo rojo que el token --destructive, no un hex propio', () => {
    expect(STATUS_COLOR.cancelado.toUpperCase()).toBe(extractDestructiveToken().toUpperCase())
  })
})
