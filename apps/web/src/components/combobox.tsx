'use client'

import { Command as CommandPrimitive } from 'cmdk'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { normalize } from '@/lib/normalize'
import { cn } from '@/lib/utils'

export type ComboboxItem = {
  value: string
  label: string
  /** Código que va delante, en monoespaciada (un trabajo: «26-00101», UX5-11). */
  code?: string
  /** Texto secundario tras la etiqueta, en gris («Cobrado», «Debe $ 120.00»). */
  detail?: string
}

/** Todo el texto de un ítem, por el que se busca. */
const searchText = (item: ComboboxItem) =>
  [item.code, item.label, item.detail].filter(Boolean).join(' ')

/** El contenido de un ítem, igual en la opción y en el disparador: «26-00101 Ana Ruiz · Cobrado»,
 * con el código en monoespaciada. Los espacios y el «·» van en el texto, para que el nombre
 * accesible se lea igual que se ve. */
function itemContent(item: ComboboxItem) {
  return (
    <>
      {item.code && (
        <>
          <span className="font-mono whitespace-nowrap">{item.code}</span>{' '}
        </>
      )}
      <span>{item.label}</span>
      {item.detail && (
        <>
          {' '}
          <span className="whitespace-nowrap text-muted-foreground">· {item.detail}</span>
        </>
      )}
    </>
  )
}

/**
 * Select con buscador (UX2-12): un disparador con `role="combobox"` (mismo contrato accesible
 * que `Select` — nombre accesible fijo por `aria-label`/label asociado) abre un popover con un
 * campo de texto (`Command.Input` de cmdk) y una lista filtrable. El filtro es manual
 * (`shouldFilter={false}` + `items.filter(...)` propio, insensible a tildes) en vez del `filter`
 * interno de cmdk, para reutilizar el mismo criterio de búsqueda que el resto de la app
 * (`normalize`, como en `components/data-grid`). `Command.Input` también fija su propio
 * `role="combobox"` (no se puede sobreescribir, fuente de cmdk): eso es intencional, no un
 * choque con el disparador — mientras el popover está abierto conviven dos elementos con ese
 * rol, pero con nombres accesibles distintos («Clínica» en el disparador, el texto de
 * `searchPlaceholder` en el campo de búsqueda vía la propia `label` de `Command`), así que
 * `getByRole('combobox', { name: 'Clínica' })` sigue resolviendo a uno solo. Por eso el campo de
 * búsqueda usa `Command.Input` (no un `<input>` suelto): `Command` siempre renderiza una
 * etiqueta oculta `<label for={idDelInput}>` para asociarla a su `Input` — con un `<input>`
 * propio ese `for` quedaba huérfano (ningún elemento con ese id), lo que Chrome marcaba como
 * aviso de accesibilidad; con `Command.Input` los ids los genera y empareja la propia librería.
 * Se le pasa `label={searchPlaceholder}` a `Command` para que esa etiqueta oculta no quede
 * vacía (mismo aviso, por el otro lado: «campo sin nombre accesible»).
 *
 * El disparador **no** fija `aria-haspopup` ni `aria-expanded` a mano (I-2, revisión Tarea 13):
 * `PopoverPrimitive.Trigger` ya los inyecta (`"dialog"`, el estado real de `context.open`, y
 * `aria-controls` apuntando al id real del contenido) y, al venir por `asChild`/`Slot`, un
 * atributo puesto en el `<button>` hijo pisa el que trae Radix — un `aria-haspopup="listbox"`
 * propio anunciaba una lista y luego abría un diálogo sin nombre. El propio
 * `PopoverPrimitive.Content` recibe `aria-label={placeholder}` para que ese diálogo se anuncie
 * con el mismo rótulo del campo («Elegir clínica»/«Elegir producto»).
 */
export function Combobox({
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Buscar…',
  emptyMessage = 'Sin resultados',
  id,
  disabled = false,
  'aria-label': ariaLabelProp,
  'aria-invalid': ariaInvalid,
  className,
}: {
  items: ComboboxItem[]
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder: string
  searchPlaceholder?: string
  emptyMessage?: string
  id?: string
  disabled?: boolean
  'aria-label'?: string
  'aria-invalid'?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // M-2 (revisión Tarea 13): resaltado del `Command` (`aria-selected`, no el check visual),
  // controlado a mano para que al reabrir empiece en el valor ya elegido y no en el primer
  // ítem de la lista (comportamiento por defecto de cmdk al montar).
  const [highlighted, setHighlighted] = useState(value ?? '')
  const selected = items.find((item) => item.value === value)
  const ariaLabel = ariaLabelProp ?? placeholder

  const filtered = useMemo(() => {
    const needle = normalize(query.trim())
    if (!needle) return items
    return items.filter((item) => normalize(searchText(item)).includes(needle))
  }, [items, query])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setHighlighted(value ?? '')
    } else {
      setQuery('')
    }
  }

  function handleSelect(item: ComboboxItem) {
    onChange(item.value)
    handleOpenChange(false)
  }

  // M-1 (revisión Tarea 13): el patrón combobox de la APG espera que ↓ abra el desplegable con
  // foco en el disparador, como ya hacía el `Select` de Radix que este componente sustituye
  // (Enter/Espacio ya funcionan solos: activación nativa del `<button>`).
  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown' || open) return
    event.preventDefault()
    setOpen(true)
  }

  // M-3 (revisión Tarea 13): dentro del popover el único elemento tabulable es este campo (los
  // `Command.Item` se navegan con flechas, sin `tabIndex`); el `FocusScope` de Radix fija
  // `loop` a `true` siempre (no es configurable desde `Popover`), así que con un solo elemento
  // tabulable Tab se reenfoca a sí mismo en vez de salir — verificado en Chrome real antes de
  // este fix (el foco no se movía). Se corta el bucle a mano: Tab cierra el desplegable: Radix
  // devuelve el foco al disparador solo (`onCloseAutoFocus` de `Popover`), así que el siguiente
  // Tab sigue el orden natural del formulario. `stopPropagation` evita que el `onKeyDown` del
  // propio `FocusScope` (que sigue viendo el campo enfocado en este mismo evento, antes de que
  // React desmonte el popover) alcance a reenfocarlo de nuevo.
  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Tab') return
    event.preventDefault()
    event.stopPropagation()
    handleOpenChange(false)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          onKeyDown={handleTriggerKeyDown}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          data-slot="combobox-trigger"
          className={cn(
            'flex h-11 w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
            className,
          )}
        >
          <span
            className={cn('line-clamp-1 flex-1 text-left', !selected && 'text-muted-foreground')}
          >
            {selected ? itemContent(selected) : placeholder}
          </span>
          <ChevronsUpDown className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          aria-label={placeholder}
          className="z-50 w-(--radix-popover-trigger-width) min-w-56 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <CommandPrimitive
            shouldFilter={false}
            label={searchPlaceholder}
            value={highlighted}
            onValueChange={setHighlighted}
            className="flex flex-col"
          >
            <CommandPrimitive.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className="h-11 w-full border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <CommandPrimitive.List label="Resultados" className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <CommandPrimitive.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </CommandPrimitive.Empty>
              )}
              {filtered.map((item) => (
                <CommandPrimitive.Item
                  key={item.value}
                  value={item.value}
                  onSelect={() => handleSelect(item)}
                  className="relative flex min-h-11 w-full cursor-default items-center gap-2 rounded-md px-2 text-sm outline-hidden select-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      item.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="flex-1">{itemContent(item)}</span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
