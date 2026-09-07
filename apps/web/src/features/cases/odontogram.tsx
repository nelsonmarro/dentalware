import { FDI_QUADRANTS, toothLabel, type FdiTooth } from '@dentalware/shared'
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
  // Cada arcada son dos cuadrantes de 8 piezas. Por debajo de `sm` cada cuadrante es su
  // propia fila de 8 columnas elásticas (`grid-cols-8`) con celdas cuadradas sin ancho
  // fijo (`w-full aspect-square`): así 8 piezas siempre caben en el ancho del diálogo
  // (≈ 42 px en 390 px, ≈ 38 px en 360 px) sin recortar la última ni superponer botones
  // — la superposición de antes venía de celdas de ancho FIJO dentro de columnas `1fr`
  // que se encogían por debajo de ese ancho. Desde `sm` los cuadrantes pasan a
  // `sm:contents` (dejan de generar caja propia) y sus botones se vuelven hijos directos
  // de la fila de 16 columnas fijas de 44 px más el separador; si esa fila no cabe, se
  // desplaza dentro de `overflow-x-auto`.
  const cell =
    size === 'md' ? 'aspect-square w-full min-w-0 sm:aspect-auto sm:size-11' : 'size-7 text-[10px]'
  const quadrantCols =
    size === 'md' ? 'grid-cols-8 gap-0.5 sm:gap-1' : 'grid-cols-[repeat(8,1.75rem)] gap-1'
  const fullRowCols =
    size === 'md'
      ? 'sm:grid-cols-[repeat(8,2.75rem)_4px_repeat(8,2.75rem)]'
      : 'sm:grid-cols-[repeat(8,1.75rem)_4px_repeat(8,1.75rem)]'

  const tooth = (n: FdiTooth) => (
    <button
      key={n}
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
      <svg viewBox="0 0 16 20" className={size === 'md' ? 'h-4 w-3' : 'h-3 w-2'} aria-hidden>
        <path
          d={TOOTH_PATH}
          fill={selected.has(n) ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
      {n}
    </button>
  )

  const row = (right: readonly FdiTooth[], left: readonly FdiTooth[], label: string) => (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {/* `min-w-0`: sin esto, un `div` dentro de ancestros `flex flex-col` no se encoge
          por debajo del contenido de sus hijos (el ancho fijo de 348 px de cada
          cuadrante), así que `overflow-x-auto` nunca llega a recortar/desplazar nada:
          el ancestro simplemente crece con el hijo y el desborde termina reventando el
          diálogo entero. Con `min-w-0` este contenedor sí se limita al ancho disponible
          y es el que scrollea si hace falta. */}
      <div className="min-w-0 overflow-x-auto">
        <div className={cn('flex flex-col gap-1 sm:grid sm:w-fit sm:gap-1', fullRowCols)}>
          <div
            role="group"
            aria-label={`${label} derecho`}
            className={cn('grid sm:contents', quadrantCols)}
          >
            {right.map((n) => tooth(n))}
          </div>
          <span
            aria-hidden
            className="hidden w-1 self-stretch justify-self-center rounded bg-border sm:block"
          />
          <div
            role="group"
            aria-label={`${label} izquierdo`}
            className={cn('grid sm:contents', quadrantCols)}
          >
            {left.map((n) => tooth(n))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="odontogram">
      {row(FDI_QUADRANTS[1], FDI_QUADRANTS[2], 'Superior')}
      {row(FDI_QUADRANTS[4], FDI_QUADRANTS[3], 'Inferior')}
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
