import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useCouriers } from './use-couriers'

/** Valor interno de la opción «todos» (`allLabel`); nunca sale del componente. */
const ALL = '__todos__'

/**
 * Selector de mensajero (recogida y envío, ENT-1/ENT-2): `Select` de los mensajeros activos.
 * Lista corta, así que `Select` y no `Combobox` (`docs/conventions.md` §5).
 *
 * Con un valor que la lista todavía no trae (cargando, o un mensajero ya dado de baja) se
 * pinta `selectedName` en vez de caer al marcador «Elegir mensajero» (lección de
 * `TechnicianSelect`, Tarea 4 de la ola): el disparador nunca dice «sin elegir» cuando hay uno.
 * Un fallo al cargar no se presenta como una lista vacía (UX3-02): lo dice y deja reintentar.
 *
 * `allLabel` (filtro de «Entregas», ENT-5): añade una primera opción para «todos» que equivale
 * al valor vacío (Radix no admite `''` como valor de un `SelectItem`, así que se traduce).
 */
export function CourierSelect({
  id,
  value,
  onChange,
  selectedName,
  invalid = false,
  disabled = false,
  allLabel,
}: {
  id: string
  value: string
  onChange: (id: string) => void
  selectedName?: string
  invalid?: boolean
  disabled?: boolean
  allLabel?: string
}) {
  const couriers = useCouriers()
  const known = couriers.data?.some((c) => c.id === value) ?? false
  const fallback = value && !known ? (selectedName ?? 'Mensajero elegido') : null
  const selectValue = allLabel && !value ? ALL : value

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v === ALL ? '' : v)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-label="Mensajero"
          aria-invalid={invalid}
          className="h-11 w-full"
        >
          <SelectValue placeholder="Elegir mensajero" />
        </SelectTrigger>
        <SelectContent>
          {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
          {fallback && <SelectItem value={value}>{fallback}</SelectItem>}
          {couriers.data?.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {couriers.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          <span>No se pudieron cargar los mensajeros.</span>
          <Button type="button" variant="outline" onClick={() => void couriers.refetch()}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  )
}
