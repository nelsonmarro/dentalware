import { useGrid } from '../context'

/** Monta los slots `toolbar` de las features registradas, en el orden de registro. Sin slots no renderiza nada. */
export function GridToolbar() {
  const grid = useGrid<never>()
  const slots = grid.features.flatMap((f) =>
    f.slots?.toolbar ? [{ id: f.id, Slot: f.slots.toolbar }] : [],
  )
  if (slots.length === 0) return null
  return (
    <div role="search" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {slots.map(({ id, Slot }) => (
        <Slot key={id} />
      ))}
    </div>
  )
}
