import { FDI_QUADRANTS, toothLabel, type FdiTooth } from '@dentalware/shared'
import { Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const UPPER: readonly FdiTooth[] = [...FDI_QUADRANTS[1], ...FDI_QUADRANTS[2]]
const LOWER: readonly FdiTooth[] = [...FDI_QUADRANTS[4], ...FDI_QUADRANTS[3]]
const TOOTH_PATH =
  'M8 1c3 0 6 2 6 6 0 3-1 5-1 9 0 2-1 3-2 3s-1-3-3-3-2 3-3 3-2-1-2-3c0-4-1-6-1-9 0-4 3-6 6-6z'

export function Odontogram({
  value,
  onChange,
  readOnly = false,
  size = 'md',
}: {
  value: readonly number[]
  onChange?: (teeth: number[]) => void
  readOnly?: boolean
  size?: 'sm' | 'md'
}) {
  const selected = new Set(value)
  const toggle = (n: FdiTooth) => {
    if (readOnly || !onChange) return
    const next = new Set(selected)
    if (next.has(n)) next.delete(n)
    else next.add(n)
    onChange([...next].sort((a, b) => a - b))
  }
  const setMany = (teeth: readonly FdiTooth[], on: boolean) => {
    if (readOnly || !onChange) return
    const next = new Set(selected)
    teeth.forEach((t) => (on ? next.add(t) : next.delete(t)))
    onChange([...next].sort((a, b) => a - b))
  }
  const allOn = (teeth: readonly FdiTooth[]) => teeth.every((t) => selected.has(t))
  const cell = size === 'md' ? 'size-11' : 'size-7 text-[10px]'
  // Ancho fijo por columna (igual al tamaño de la celda) en vez de `minmax(0,1fr)`: con
  // columnas elásticas, en una pantalla angosta (390 px) las 16 celdas de 44 px se
  // encogían por debajo de su tamaño real y los botones vecinos quedaban superpuestos
  // (el clic en uno activaba el de al lado). Con columnas de ancho fijo la fila no se
  // encoge; si no cabe, se desplaza horizontalmente dentro de `overflow-x-auto`.
  const trackSize = size === 'md' ? '2.75rem' : '1.75rem'
  const row = (teeth: readonly FdiTooth[], label: string) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="overflow-x-auto">
        <div
          className="grid w-fit gap-1"
          style={{ gridTemplateColumns: `repeat(8, ${trackSize}) 4px repeat(8, ${trackSize})` }}
        >
          {teeth.map((n, i) => (
            <Fragment key={n}>
              {i === 8 && (
                <span
                  aria-hidden
                  className="w-1 self-stretch justify-self-center rounded bg-border"
                />
              )}
              <button
                type="button"
                disabled={readOnly}
                aria-pressed={selected.has(n)}
                aria-label={toothLabel(n)}
                onClick={() => toggle(n)}
                className={cn(
                  'flex flex-col items-center justify-center rounded-md border font-mono text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default motion-reduce:transition-none',
                  cell,
                  selected.has(n)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent/60',
                )}
              >
                <svg
                  viewBox="0 0 16 20"
                  className={size === 'md' ? 'h-4 w-3' : 'h-3 w-2'}
                  aria-hidden
                >
                  <path
                    d={TOOTH_PATH}
                    fill={selected.has(n) ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
                {n}
              </button>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
  return (
    <div className="flex flex-col gap-3" data-testid="odontogram">
      {row(UPPER, 'Superior')}
      {row(LOWER, 'Inferior')}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMany(UPPER, !allOn(UPPER))}
          >
            Arcada superior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMany(LOWER, !allOn(LOWER))}
          >
            Arcada inferior
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange?.([])}>
            Limpiar
          </Button>
        </div>
      )}
    </div>
  )
}
