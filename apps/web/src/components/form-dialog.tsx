import { useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function FormDialog({
  open,
  onOpenChange,
  title,
  context,
  description,
  children,
  footer,
  size = 'default',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Sobre qué se actúa («26-00087 · Clínica Sur», UX4-12): abre la descripción, para que quien
   * tiene la lista tapada por el diálogo compruebe que eligió el bueno. */
  context?: string
  description?: string
  children: ReactNode
  footer: ReactNode
  /**
   * `wide`: para contenido ancho como el odontograma de `TeethDialog`. En móvil deja solo
   * 8 px de margen a cada lado (`max-w-[calc(100%-1rem)]`) y en escritorio `sm:max-w-4xl`.
   */
  size?: 'default' | 'wide'
}) {
  // Quien abrió el diálogo. Se abre controlado (sin `DialogTrigger`), así que Radix no sabe a
  // quién devolver el foco y lo dejaba en el `body`. Se toma en un efecto de layout, que corre
  // antes de que Radix mueva el foco dentro del diálogo.
  const opener = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Al cerrar, el foco vuelve a quien lo abrió; si ya no está (la acción lo quitó, p. ej.
        // la tarjeta que dejó de estar pendiente), al `h1` de la página, nunca al `body`.
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const target = opener.current?.isConnected ? opener.current : pageHeading()
          target?.focus()
        }}
        className={cn(
          'max-h-[90svh] overflow-x-hidden overflow-y-auto',
          size === 'wide' ? 'max-w-[calc(100%-1rem)] sm:max-w-4xl' : 'sm:max-w-lg',
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {(context || description) && (
            <DialogDescription>
              {context && (
                <span className="block font-mono font-medium text-foreground">{context}</span>
              )}
              {context && description && ' '}
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        {children}
        <DialogFooter className="gap-2">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** El `h1` de la página, enfocable por programa (`tabIndex=-1`) sin entrar en el orden del
 * tabulador. */
function pageHeading(): HTMLElement | null {
  const h1 = document.querySelector<HTMLElement>('h1')
  if (h1 && !h1.hasAttribute('tabindex')) h1.tabIndex = -1
  return h1
}
