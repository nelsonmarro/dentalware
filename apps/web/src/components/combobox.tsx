'use client'

import { Command as CommandPrimitive } from 'cmdk'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export type ComboboxItem = {
  value: string
  label: string
}

/** Insensible a mayúsculas y acentos: «Híbrida» → «hibrida» (mismo criterio que el filtro del
 * DataGrid, `components/data-grid/lib/normalize.ts`, duplicado aquí en vez de importado: ese
 * módulo es interno del DataGrid y no forma parte de su barrel público). */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Select con buscador (UX2-12): un disparador con `role="combobox"` (mismo contrato accesible
 * que `Select` — nombre accesible fijo por `aria-label`/label asociado) abre un popover con un
 * campo de texto y una lista filtrable. El filtro es manual (`shouldFilter={false}` en cmdk) y
 * no el `filter`/`Command.Input` propios de la librería: `Command.Input` fija su propio
 * `role="combobox"` sin poder sobreescribirlo (fuente de cmdk), lo que chocaría con el
 * disparador; aquí el campo de búsqueda es un `<input>` normal (rol `textbox` por defecto,
 * como cualquier campo de texto) dentro del árbol de `Command`, así que la navegación por
 * teclado (flechas, Enter) de cmdk —atada al `onKeyDown` de la raíz, no al input concreto—
 * sigue funcionando igual.
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
  const listId = useId()
  const selected = items.find((item) => item.value === value)
  const ariaLabel = ariaLabelProp ?? placeholder

  const filtered = useMemo(() => {
    const needle = normalize(query.trim())
    if (!needle) return items
    return items.filter((item) => normalize(item.label).includes(needle))
  }, [items, query])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setQuery('')
  }

  function handleSelect(item: ComboboxItem) {
    onChange(item.value)
    handleOpenChange(false)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
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
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 w-(--radix-popover-trigger-width) min-w-56 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <CommandPrimitive shouldFilter={false} className="flex flex-col">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-11 w-full border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <CommandPrimitive.List id={listId} className="max-h-64 overflow-y-auto p-1">
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
                  className="relative flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm outline-hidden select-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      item.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
