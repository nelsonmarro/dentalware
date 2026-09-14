import { useGrid } from '../context'

/**
 * Monta los slots `toolbar` de las features registradas, en el orden de registro. Sin slots no
 * renderiza nada. `role="search"` solo cuando `filtering` está registrada: es la única feature
 * cuya toolbar es un formulario de búsqueda; el resto (orden en móvil, agrupar, columnas…) no lo es.
 */
export function GridToolbar() {
  const grid = useGrid<never>()
  const slots = grid.features.flatMap((f) =>
    f.slots?.toolbar ? [{ id: f.id, Slot: f.slots.toolbar }] : [],
  )
  if (slots.length === 0) return null
  return (
    <div
      role={grid.has('filtering') ? 'search' : undefined}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {slots.map(({ id, Slot }) => (
        <Slot key={id} />
      ))}
    </div>
  )
}
