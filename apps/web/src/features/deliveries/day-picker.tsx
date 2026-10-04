import { toIsoDate } from '@dentalware/shared'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Fecha local de un `YYYY-MM-DD` (sin pasar por UTC: `new Date('2026-10-03')` sería el 2 en
 * Ecuador). */
function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

function shift(iso: string, days: number): string {
  const date = localDate(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

const LONG_DAY = new Intl.DateTimeFormat('es-EC', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/**
 * Selector del día de «Entregas» (ENT-5): el día con palabras («Hoy · sábado, 3 de octubre»),
 * flechas al anterior y al siguiente, «Hoy» y una fecha. Botones de 44 px. Borrar la fecha no
 * hace nada: la pantalla siempre muestra un día.
 */
export function DayPicker({ day, onChange }: { day: string; onChange: (day: string) => void }) {
  const today = toIsoDate(new Date())
  const inputId = useId()
  const label = LONG_DAY.format(localDate(day))

  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg font-medium first-letter:uppercase" aria-live="polite">
        {day === today ? `Hoy · ${label}` : label}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Día anterior"
          onClick={() => onChange(shift(day, -1))}
        >
          <ChevronLeft />
        </Button>
        <label htmlFor={inputId} className="sr-only">
          Día
        </label>
        <Input
          id={inputId}
          type="date"
          lang="es-EC"
          value={day}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value)
          }}
          className="h-11 min-w-0 flex-1 font-mono sm:w-44 sm:flex-none"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Día siguiente"
          onClick={() => onChange(shift(day, 1))}
        >
          <ChevronRight />
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={day === today}
          onClick={() => onChange(today)}
        >
          Hoy
        </Button>
      </div>
    </div>
  )
}
